# src/backend/models.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal, Dict, Any, Optional

class ServiceRecommendation(BaseModel):
    service_id: str = Field(..., description="Unique identifier for the service")
    name: str = Field(..., description="Name of the recommended service")
    description: str = Field(..., description="Description of the recommended service")
    url: str = Field(..., description="URL for the recommended service")

class ProcessedRelocationTask(BaseModel):
    task_id: str
    task_description: str
    priority: Literal['High', 'Medium', 'Low']
    due_date: str
    importance_explanation: str
    recommended_services: List[ServiceRecommendation]
    stage: str
    category: str

    @field_validator('priority')
    def validate_priority(cls, value):
        if value not in ['High', 'Medium', 'Low']:
            raise ValueError('Priority must be High, Medium, or Low')
        return value

# Represents a task stored in Firestore (includes state)
class FirestoreRelocationTask(BaseModel):
    task_id: str  # Unique ID (from YAML or custom_timestamp)
    task_description: str
    priority: Literal['High', 'Medium', 'Low']
    due_date: str
    importance_explanation: Optional[str] = None
    recommended_services: List[ServiceRecommendation] = []
    stage: str
    category: str
    # State fields managed per user
    completed: bool = False
    isImportant: bool = False
    notes: Optional[str] = ""
    # Metadata
    is_custom: bool = False  # Flag to distinguish generated vs user-added

    @field_validator('priority')
    def validate_priority(cls, value):
        if value not in ['High', 'Medium', 'Low']:
            raise ValueError('Priority must be High, Medium, or Low')
        return value

# Payload for updating task state (PATCH request)
class UpdateTaskStatePayload(BaseModel):
    completed: Optional[bool] = None
    isImportant: Optional[bool] = None
    notes: Optional[str] = None
    task_description: Optional[str] = None  # Allow editing description
    due_date: Optional[str] = None         # Allow editing due date

# Payload for creating a new custom task (POST request)
class CustomTaskPayload(BaseModel):
    task_description: str
    priority: Literal['High', 'Medium', 'Low'] = 'Medium'
    due_date: str  # Expecting ISO date string from frontend modal
    stage: Literal['predeparture', 'departure', 'arrival']
    category: str  # Can be new or existing

# QuizFormData remains the same
class QuizFormData(BaseModel):
    moveType: Literal['international', 'domestic']
    destination: str
    moveDate: str
    hasHousing: bool
    family: Dict[str, bool]  # e.g., {'children': True, 'pets': False}
    vehicle: Literal['bring', 'rent', 'none']
    currentHousing: Literal['own', 'rent', '']
    newHousing: Literal['own', 'rent', 'temporary', '']
    services: Dict[str, bool]  # e.g., {'internet': True, 'utilities': False, ...}
    hasJob: bool

# For Chat endpoint
class ChatPayload(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

class ChatResponse(BaseModel):
    response: str

# Structure returned by GET /checklist
class ChecklistApiResponse(BaseModel):
    predeparture: List[FirestoreRelocationTask]
    departure: List[FirestoreRelocationTask]
    arrival: List[FirestoreRelocationTask]
