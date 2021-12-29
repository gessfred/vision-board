from typing import Optional, List, Dict, Any
from fastapi import FastAPI
import uvicorn
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from random import choices, choice
from io import BytesIO
from PIL import Image

import cv2
from torchvision.transforms import RandomCrop, Compose, Resize, ToTensor, Grayscale
from torchvision.transforms.functional import to_tensor, to_pil_image, adjust_gamma, gaussian_blur
import random

from base64 import b64encode, b64decode
from tools import mask_to_svg, extract_threshold_cc, pil_to_base64, base64_to_pil, segment
from storage import Storage, MongoStorage
from jsontypes import *
import math
from skimage.segmentation import slic

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage: Storage = None

HEAD = {}
SESSION = {}

T = Compose([
  Resize((128, 128)),
  Grayscale(),
  ToTensor()
])

class FileSystem:
  def __init__(self):
    self.cache = {}
  
  def __call__(self, url):
    if url in self.cache:
      return self.cache[url]
    img = Image.open(url)
    self.cache[url] = img
    return img

"""class ThresholdConnectedComponents:
  def __init__(self, fs):
    self.fs = fs
    self.cache = {}

  def __call__(self, url, threshold=180):
    if url in self.cache:
      return self.cache[url]
    print("CACHE MISS", self.fs.cache)
    img = self.fs(url)
"""


fs = FileSystem()

from glob import glob

import onnxruntime
import numpy as np
import torch

def to_numpy(tensor):
  return tensor.detach().cpu().numpy() if tensor.requires_grad else tensor.cpu().numpy()

@app.get("/preview")
def get_preview(pattern: str, modelpath: Optional[str] = None):
  files = glob(pattern)
  random.shuffle(files)
  return {"files": files, "previews": preview_samples(files[:3], modelpath)}

@app.get("/datasets")
def get_datasets():
  return storage.get_datasets()

"""
returns dataset object and relevant status statistics (model performance, annotation progress, ETA)
"""
@app.get("/datasets/{datasetId}")
def get_dataset(datasetId: str):
  return storage.get_dataset(datasetId)

def preview_samples(paths, model=None):
  images = map(fs,paths)
  images = map(RandomCrop(256), images)
  
  if model is not None:
    #if model.endsWith(".ckpt"):
    #  UnsupervisedAsbestosSegmentation_DeepLab.load_from_checkpoint("./checkpoints/deeplabv3_mobilnetv2persimmon_mule-epoch119.ckpt")
    if model.endswith(".onnx"):
      ort_session = onnxruntime.InferenceSession(model)
      def infer(x): 
        masks = ort_session.run(None, {ort_session.get_inputs()[0].name: to_numpy(T(x).unsqueeze(0))})[0]
        masks = torch.tensor(masks).squeeze()
        return to_pil_image(segment(T(x), masks))
      images = list(map(infer, images))
      # compute ONNX Runtime output prediction
  images = map(pil_to_base64, images)
  return list(images)


@app.get("/datasets/{datasetId}/head/image")
def get_head_image(datasetId: str):
  url = storage.get_dataset_head_url(datasetId)
  lastK = storage.get_last_k_annotations(datasetId)
  return {"image": pil_to_base64(fs(url)), "lastK": list(map(pil_to_base64, lastK)), "url": url}
  
def func(x, y, c=(0,0),r=2):
  c_x, c_y = c
  graph = r**2 - ((x-c_x)**2 + (y-c_y)**2)
  return np.where(graph > 0, 1., 0.)
    
def circle(center, radius, W=256, H=256):
  xaxis = np.linspace(0 , W, W)
  yaxis = np.linspace(0, H, H)
  res = func(xaxis[:,None], yaxis[None,:], c=center, r=radius)
  return np.uint8(res)

def threshold_on_brush(img, x, y, r):
  img = np.array(img)
  m = circle((y, x), r, W=img.shape[0], H=img.shape[1])
  return img * m

def brush(datasetId: str, x: int, y: int, radius: int, threshold: int = 180, smoothing: int = 0, gamma: int = 0):
  url = storage.get_dataset_head_url(datasetId)
  #url = "../../../amiscan/asbestos-patch/maskv2/3_vdi-suva-2573_4746.tif"#3_vdi-suva-2570_5191.tif"
  img = fs(url)
  if gamma > 0:
    img = adjust_gamma(img, gamma=gamma)
  if smoothing > 0:
    img = gaussian_blur(img, kernel_size=3, sigma=5.)
  res = threshold_on_brush(img, x, y, radius)
  cc = extract_threshold_cc(res, threshold=threshold, radius=radius)
  if len(cc) > 0:
    return cc[0]
  return None

@app.get("/datasets/{datasetId}/head/brush")
def get_brush(datasetId: str, x: int, y: int, radius: int, threshold: int = 180):
  cc = brush(datasetId, x, y, radius, threshold, smoothing=1)
  svg = ""
  if cc is not None:
    svg = mask_to_svg(cc)[0]
  return {"components": svg}

@app.get("/datasets/{datasetId}/head/superpix")
def get_head_superpix(datasetId: str, segments: int = 200, gamma: int = 0):
  url = storage.get_dataset_head_url(datasetId)
  img = fs(url)
  if gamma > 0:
    img = adjust_gamma(img, gamma=gamma)
  segs = slic(img, n_segments = segments, sigma = 5, compactness=0.1, enforce_connectivity=True)
  segs = [mask_to_svg(segs == k)[0] for k in range(segs.max())]
  return {"segments": segs}

def mask_to_cc(m):
  cc = extract_threshold_cc(m)
  if len(cc) < 1: return None
  cc = cc[0]
  return cc

def auto_brush(datasetId:str, x:int, y:int, side:int, labelFilter:int):
  ds = storage.get_dataset(datasetId)
  ds["modelUrl"] = "/Users/fredericgessler/Documents/bootstrap/mescal/data/deeplabv3_mobilnetv2persimmon_mule-epoch119.onnx"
  url = storage.get_dataset_head_url(datasetId)
  #url = "../../../amiscan/asbestos-patch/maskv2/3_vdi-suva-2573_4746.tif"#3_vdi-suva-2570_5191.tif"
  img = fs(url)
  original_format = np.array(img).shape
  if ds["modelUrl"] not in SESSION:
    SESSION[ds["modelUrl"]] = onnxruntime.InferenceSession(ds["modelUrl"])
  session = SESSION[ds["modelUrl"]]
  
  n = session.get_inputs()[0].name
  #crop
  crop = img.crop((x-side, y-side, x+side, y+side))
  crop = T(crop)
  gamma=math.log(255*0.5)/math.log(np.mean(crop.numpy()))
  target_gamma = -4
  f = lambda x: adjust_gamma(x, gamma=gamma/target_gamma)
  #pad the crop if 
  # infer on image crop - apply transform(resize, totensor)
  masks = session.run(None, {n: to_numpy(f(crop).unsqueeze(0))})[0][0] #Shape here: (3, 128, 128)
  masks = masks # ignore background mask
  #encode masks (turn probabilities to one-zero)
  masks = torch.tensor(masks).exp().argmax(0)
  R = Resize((2*side, 2*side))
  masks = [torch.where(masks == dim, 1., 0.) for dim in [labelFilter]]
  masks = torch.stack(masks)
  masks = R(masks)
  masks = np.uint8(np.array(masks * 255))
  #masks = torch.tensor(masks)
  #print(masks.shape, masks.dtype, masks.min(), masks.max(), masks)
  #put masks crops in original format
  left = max(0, x - side)
  top = max(0, y - side)
  right = min(256, x + side)
  bottom = min(256, y + side)
  masks_ = np.zeros((masks.shape[0], 256, 256), dtype=np.uint8)
  left_ = max(0, -(x - side))
  top_ = max(0, -(y - side))
  right_ = 2*side-max(0,(x+side) - 256)
  bottom_ = 2*side-max(0,(y+side) - 256)
  masks_[:,top:bottom,left:right] = masks[:,top_:bottom_,left_:right_]
  #extract CC for each mask
  #paths = list(map(mask_to_path, list(masks_)))
  #return {"paths": paths}
  return mask_to_cc(masks_[0])
  #convert to SVG


@app.get("/datasets/{datasetId}/head/reset")
def get_head_reset(datasetId: str):
  if datasetId in HEAD:
    del HEAD[datasetId]
  return {"segmentation": []}

@app.get("/datasets/{datasetId}/head/auto")
def get_sample_auto(datasetId: str, x: float, y: float, side: float, labelFilter: int = 1):
  cc = auto_brush(datasetId, int(x), int(y), int(side), labelFilter)
  if cc is None: return {"paths": [""]}
  svg = mask_to_svg(cc)
  if len(svg) < 1: svg = ""
  else: svg = svg[0]
  return {"paths": [svg]}

@app.get("/datasets/{datasetId}/head/brush/commit")
def commit_brush(datasetId: str, x: float, y: float, radius: float, label: int, threshold:int=180):
  cc = brush(datasetId, x, y, radius, threshold, smoothing=1)
  if datasetId not in HEAD:
    print("initializing HEAD")
    HEAD[datasetId] = [np.zeros(cc.shape, dtype=np.uint8) for _ in range(4)]
  labels = HEAD[datasetId]
  print(cc.sum(), type(cc))
  labels[label] = cv2.bitwise_or(cc, labels[label])
  #print("@pixels", labels[label].sum())
  L = []
  for mask in labels:
    print(np.unique(mask))
    masks = extract_threshold_cc(mask, topK=-1)
    masks = list(map(lambda x: mask_to_svg(x), masks))
    #paths = mask_to_svg(mask)
    #print(len(paths))
    L.append(masks)
  return {"segmentation": L}

@app.get("/datasets/{datasetId}/head/auto/commit")
def commit_auto(datasetId: str, x: float, y: float, radius: float, label: int):
  cc = auto_brush(datasetId, int(x), int(y), int(radius), label)
  if datasetId not in HEAD:
    HEAD[datasetId] = [np.zeros(cc.shape, dtype=np.uint8) for _ in range(4)]
  labels = HEAD[datasetId]
  labels[label] = cv2.bitwise_or(mask, labels[label])
  L = []
  for mask in labels:
    masks = extract_threshold_cc(mask)
    masks = list(map(lambda x: mask_to_svg(x), masks))
    L.append(masks)
  return {"segmentation": L}

@app.get("/datasets/{datasetId}/head/skip")
def get_skip_head(datasetId: str):
  if datasetId in HEAD:
    del HEAD[datasetId]
  next_head = storage.skip_head(datasetId)
  lastK = storage.get_last_k_annotations(datasetId)
  ds = storage.get_dataset(datasetId, flush_cache=True)
  return {"url": next_head, "image": pil_to_base64(fs(next_head)), "lastK": list(map(pil_to_base64, lastK)), "dataset": ds}

#@app.get("/datasets/{datasetId}/head/discard")
#def get_discard_head(datasetId: str):

@app.get("/datasets/{datasetId}/head/commit")
def get_commit_head(datasetId: str):
  if datasetId not in HEAD:
    HEAD[datasetId] = [np.zeros((256,256), dtype=np.uint8) for _ in range(4)]
  labels = HEAD[datasetId]
  labels = list(map(lambda x: pil_to_base64(Image.fromarray(x)), labels))

  storage.insert_labels(datasetId, labels)

  url = storage.get_dataset_head_url(datasetId)

  lastK = storage.get_last_k_annotations(datasetId)
  ds = storage.get_dataset(datasetId, flush_cache=True)
  del HEAD[datasetId]
  return {"image": pil_to_base64(fs(url)), "lastK": list(map(pil_to_base64, lastK)), "dataset": ds, "url": url}

@app.post("/datasets")
def post_dataset(descriptor: DatasetDescriptor):
  return storage.insert_dataset(descriptor)

@app.patch("/datasets/{datasetId}")
def patch_dataset(datasetId: str, datasetUpdates: DatasetUpdates):
  updated = storage.update_dataset(datasetId, datasetUpdates)
  return {"dataset": updated}

@app.on_event("startup")
def startup():
  storage.setup()

@app.on_event("shutdown")
def shutdown():
  storage.close()

if __name__ == '__main__':
  storage = MongoStorage(addr="mongodb://localhost:27017")
  uvicorn.run(app, port=8001)

#/Users/fredericgessler/Documents/bootstrap/mescal/data/deeplabv3_mobilnetv2persimmon_mule-epoch119.onnx