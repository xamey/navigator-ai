from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    task: str


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class TaskStatus(BaseModel):
    task_id: str
    status: str
    progress: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    results: Optional[List[Dict]] = None
