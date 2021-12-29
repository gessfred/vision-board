from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class DatasetDescriptor(BaseModel):
  pattern: str 
  name: str
  model: Optional[str]

class Job(BaseModel):
  image: str
  annotation: Optional[List[str]]

class LabellingTool(BaseModel):
  toolId: str
  params: Dict[str, Any]

class LabelledComponent(BaseModel):
  key: int
  label: int
  labellingTool: LabellingTool

class LabelledComponents(BaseModel):
  components: List[LabelledComponent]

class DatasetUpdates(BaseModel):
  modelUrl: Optional[str]