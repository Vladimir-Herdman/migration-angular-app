from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any, Optional

# New model for Service Information
class ServiceRecommendation(BaseModel):
  service_id: str = Field(..., description="Unique identifier for the service")
  name: str = Field(..., description="Name of the recommended service")
  description: str = Field(..., description="Description of the recommended service")
  url: str = Field(..., description="URL for the recommended service")

# Pydantic model for the structure of a single relocation task
class RelocationTask(BaseModel):
  task_description: str = Field(..., description="Clear description of the task")
  priority: Literal['High', 'Medium', 'Low'] = Field(..., description="Priority level")
  due_date: str = Field(..., description="Suggested due date or timeframe (e.g., '8 weeks before move', 'YYYY-MM-DD')")

# Pydantic model for the expected output structure from the LLM
class TaskListOutput(BaseModel):
  predeparture: List[RelocationTask] = Field(..., description="List of pre-departure tasks")
  departure: List[RelocationTask] = Field(..., description="List of departure tasks")
  arrival: List[RelocationTask] = Field(..., description="List of arrival tasks")

# Pydantic model for the input data from the Ionic quiz form
class QuizFormData(BaseModel):
  moveType: Literal['international', 'domestic']
  destination: str
  moveDate: str # Assuming date is sent as a string, e.g., "YYYY-MM-DD"
  hasHousing: bool
  family: Dict[str, bool] # e.g., {'children': True, 'pets': False}
  vehicle: Literal['bring', 'rent', 'none']
  currentHousing: Literal['own', 'rent', ''] # What should our default be?
  newHousing: Literal['own', 'rent', 'temporary', ''] # What should our default be?
  services: Dict[str, bool] # e.g., {'internet': True, 'utilities': False, ...}
  hasJob: bool