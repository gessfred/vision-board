from pymongo import MongoClient
from rethinkdb import RethinkDB
from jsontypes import *
from glob import glob
from uuid import uuid4
from datetime import datetime
from tools import reconstruct_annotation, pil_to_base64
from PIL import Image
import random

class Storage:
  def __init__(self): pass

  def setup(self): pass

  def close(self): pass

  def get_dataset(self, datasetId: str): return {}

  def get_datasets(self): return []

  def get_dataset_head_url(self, datasetId: str): return ""

class MongoStorage(Storage):
  def __init__(self, addr):
    super().__init__()
    self.client = MongoClient(addr, socketTimeoutMS=3000, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000)
    self.db = self.client["dev"]
    self.cache = {}
    self.last_timestamp = None
    self.head = None

  def get_dataset(self, datasetId: str, flush_cache=False): 
    if datasetId in self.cache and not flush_cache:
      return self.cache[datasetId]
    ds = self.db.datasets.find({"datasetId": datasetId}, {"_id": False})
    ds = next(ds)
    ds["files"] = glob(ds["url"])
    annotated = self.db.samples.find({"datasetId": datasetId, "status": "labelled"}).count()
    skipped = self.db.samples.find({"datasetId": datasetId, "status": "skipped"}).count()
    ds["stats"] = {
      "annotated": annotated,
      "skipped": skipped
    }
    try:
      ds["avgLabelDuration"] = self.get_annotation_time(datasetId)
    except:
      ds["avgLabelDuration"] = -1
    self.cache[datasetId] = ds
    return ds

  def get_annotation_time(self, datasetId: str):
    match = {"$match": {"datasetId": datasetId}}
    diff = {"$project": {"sampleId": 1, "datasetId": 2, "annotationTime": {"$subtract": ["$endTime", "$startTime"]}}}
    avg = {"$group": {"_id": "$datasetId", "avgLabelDuration": {"$avg": "$annotationTime"}}}
    s = self.db.samples.aggregate([match, diff, avg])
    s = next(s)
    print(s)
    return s["avgLabelDuration"]


  def insert_dataset(self, descriptor: DatasetDescriptor):
    dataset_id = uuid4().hex
    data = {
      "datasetId": dataset_id,
      "url": descriptor.pattern,
      "name": descriptor.name,
      "creationDate": datetime.now()
    }
    if descriptor.model is not None:
      data["model_url"] = descriptor.model
    self.db["datasets"].insert_one(data)
    return {"datasetId": dataset_id}

  def update_dataset(self, datasetId: str, updates: DatasetUpdates):
    self.db.datasets.update_one({"datasetId": datasetId}, {
      "$set": dict(updates)
    })
    del self.cache[datasetId]
    return self.get_dataset(datasetId)

  def insert_labels(self, datasetId: str, labels: list):
    now = datetime.now()
    url = self.get_dataset_head_url(datasetId)
    img = pil_to_base64(Image.open(url))
    sample = {
      "datasetId": datasetId,
      "labels": labels,
      "url": url,
      "image": img,
      "status": "labelled"
    }
    if self.last_timestamp is not None:
      sample["startTime"] = self.last_timestamp
      sample["endTime"] = now
    self.last_timestamp = datetime.now()
    self.db["samples"].insert_one(sample)
    self.head = None

  def get_datasets(self):
    datasets = self.db["datasets"].find({}, {"_id": False})
    return list(datasets)

  def get_samples(self, datasetId: str):
    samples = self.db["samples"].find({"datasetId": datasetId}, {"_id": False})
    return list(samples)
  
  def get_dataset_head_url(self, datasetId: str):
    if self.head is None:
      ds = self.get_dataset(datasetId)
      samples = self.get_samples(datasetId)
      samples_urls = list(map(lambda s: s["url"], samples))
      files = list(filter(lambda f: f not in samples_urls, ds["files"]))
      random.shuffle(files)
      #files.sort()
      self.head = files[0]
    return self.head

  def get_last_k_annotations(self, datasetId: str, k: int = 4):
    samples = self.db["samples"].find({"datasetId": datasetId, "status": "labelled"}, {"_id": False})
    N = samples.count()
    samples = samples.skip(N - k).limit(k)
    samples = list(map(reconstruct_annotation, samples))
    return samples


  def commit_head(self, datasetId: str):
    pass

  def skip_head(self, datasetId: str):
    head = self.get_dataset_head_url(datasetId)
    self.db["samples"].insert_one({
      "datasetId": datasetId,
      "url": head,
      "sampleId": uuid4().hex,
      "status": "skipped"
    })
    self.last_timestamp = datetime.now()
    self.head = None
    return self.get_dataset_head_url(datasetId)

class RethinkDB(Storage):
  def __init__(self):
    super().__init__()
    conf = {
      "tables": ["datasets", "samples"]
    }
    self.r = RethinkDB()
    self.rdb = self.r.connect( "localhost", 28015)
    for table in conf["tables"]:
      if table not in self.r.db("test").table_list().run(self.rdb): 
        self.r.db("test").table_create(table).run(self.rdb)

  def get_dataset(self, datasetId: str):
    ds = r.table("datasets").filter(r.row["datasetId"] == datasetId).run(rdb)
    ds = next(ds)
    ds["files"] = glob(ds["url"]) #TODO do asynchronously
    return ds

  def insert_dataset(self, descriptor: DatasetDescriptor):
    dataset_id = uuid4().hex
    data = {
      "datasetId": dataset_id,
      "url": descriptor.pattern,
      "name": descriptor.name,
      "creationDate": self.r.now()
    }
    if descriptor.model is not None:
      data["model_url"] = descriptor.model
    self.r.table("datasets").insert(data).run(self.rdb)
    return {"datasetId": dataset_id}

  def get_datasets(self):
    datasets = self.r.table("datasets").run(self.rdb)
    datasets = list(datasets)
    return datasets

  def get_dataset_head_url(self, datasetId: str):
    ds = self.r.table("datasets").filter(self.r.row["datasetId"] == datasetId).run(self.rdb)
    samples = self.r.table("samples").filter(self.r.row["datasetId"] == datasetId)["url"].run(self.rdb)
    samples = list(samples)
    ds = next(ds)
    files = glob(ds["url"])
    files = list(filter(lambda f: f not in samples, files))
    files.sort()
    return files[0]

  def skip_head(self, datasetId: str):
    head = self.get_dataset_head_url(datasetId)
    self.r.table("samples").insert({
      "datasetId": datasetId,
      "url": head,
      "sampleId": uuid4().hex,
      "status": "discarded"
    }).run(self.rdb)
    return self.get_dataset_head_url(datasetId)
