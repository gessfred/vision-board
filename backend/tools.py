from base64 import b64encode, b64decode
from io import BytesIO
import torch
import numpy as np
import cv2
import potrace
from torch import Tensor
from PIL import Image

###########UTILS
def pil_to_base64(org):
  img = None
  with BytesIO() as j:
    org.convert('RGB').save(j, format='JPEG')
    img = b64encode(j.getvalue()).decode('utf-8')
  return img

def base64_to_pil(x):
  return Image.open(BytesIO(b64decode(x)))

def to_np(i): return np.array(i * 255).astype(np.uint8)

def segment(image, masks, num_classes=4):
  maskColor = {0: [0,255,0], 1: [255,255,0], 2: [255,0,255], 3: [0,0,255]}
  #if not isinstance(image, np.ndarray):
  #  image = to_np(image[0])
  #print("segments", masks.shape, masks.max())
  masks = np.stack([(1. - (masks.sum(0)))]+list(masks))
  #print(masks)
  annotatedImage = np.stack((image,)*3, axis=-1)
  masks = masks.argmax(axis=0)
  for i in range(1, num_classes):
    color = np.array(maskColor[i], dtype=np.uint8)
    mask = masks == i
    colorMask = np.where(mask[...,None], color, annotatedImage)
    annotatedImage = cv2.addWeighted(annotatedImage, 0.5, colorMask, 0.5,0)
  #res =  transforms.functional.to_tensor((annotatedImage / 255.).astype(np.float32))
  #return res
  return annotatedImage

def reconstruct_annotation(sample):
  image = np.array(base64_to_pil(sample["image"]))[:,:,0]
  labels = map(lambda x: np.array(base64_to_pil(x))[:,:,0] / 255., sample["labels"])
  labels = np.array(list(labels))
  print("reconstruct", image.shape, labels.shape)
  return Image.fromarray(segment(image, labels))

#######THRESHOLD#######
"""
image: torch.Tensor[torch.float] or np.ndarray[np.uint8]
"""
def extract_threshold_cc(image: np.ndarray, topK:int=1, **kwargs):
  thresh = cv2.threshold(image, kwargs.get("threshold", 180), 255, cv2.THRESH_TOZERO)[1]
  nb_components, output, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=kwargs.get("connectivity", 8))
  masks = []
  print("area", (3.5 * kwargs.get("radius", 70)**2 / 100), kwargs.get("radius"))
  """
    x = stats[i, cv2.CC_STAT_LEFT]
    y = stats[i, cv2.CC_STAT_TOP]
    w = stats[i, cv2.CC_STAT_WIDTH]
    h = stats[i, cv2.CC_STAT_HEIGHT]
  """
  strategy = "largest" # alternative: centermost, all > f(radius)
  idx=[]
  if topK == 1:
    if strategy == "largest":
      idx = [stats[1:,cv2.CC_STAT_AREA].argmax(0) + 1]
  else:
    idx = range(1, nb_components)
  #print("stats")#, stats[:,cv2.CC_STAT_TOP] + stats[:, cv2.CC_STAT_HEIGHT]/2)
  for i in idx:
    area = stats[i, cv2.CC_STAT_AREA]
    #if area > (3.5 * kwargs.get("radius", 70)**2 / 100) or nb_components == 1 or topK < 0:
    if topK == 1 or area > 10:
      masks.append((output == i).astype("uint8") * 255)
      if topK > 0 and len(masks) > topK:
        break
  return masks


def target_threshold(image, area_min=None, components=None, granularity=None):
  if not isinstance(image, np.ndarray):
    image = np.array(image[0] * 255).astype(np.uint8)#cv2.imread(img)[:,:,0]
  def f(x):
    threshold = cv2.threshold(image, x, 255, cv2.THRESH_TOZERO)[1]
    stats = cv2.connectedComponentsWithStats(threshold, connectivity=8)[2]
    return len(list(filter(lambda stat: stat[cv2.CC_STAT_WIDTH] > 3, stats)))
  
  return list(map(f, range(120, 255)))

def mask_to_svg(mask: Tensor):
  mask = np.where(mask > 0, 1. , 0.)
  bmp = potrace.Bitmap((mask))
  path = bmp.trace()
  ds = []
  for curve in path:
    x0, y0 = curve.start_point
    cmds = []
    cmds.append(f"M {x0} {y0}") 
    for segment in curve:
      #print (segment)
      end_point_x, end_point_y = segment.end_point
      if segment.is_corner:
        c_x, c_y = segment.c
        cmds.append(f"L {c_x} {c_y} L {end_point_x} {end_point_y}")
        #raise Exception("Not implemented")
      else:
        c1_x, c1_y = segment.c1
        c2_x, c2_y = segment.c2
        cmd = f"C {(c1_x)} {(c1_y)} {(c2_x)} {(c2_y)} {(end_point_x)} {(end_point_y)}"
        cmds.append(cmd)
    ds.append(' '.join(cmds))
  return ds

#import onnx

#onnx_model = onnx.load("test.onnx")
#onnx.checker.check_model(onnx_model)