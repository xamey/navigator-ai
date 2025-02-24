import uuid
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    task: str


class DOMUpdate(BaseModel):
    task_id: str
    dom_data: Dict
    result: List


@app.get("/")
async def root():
    return {"message": "Navigator AI API"}


@app.post("/tasks/create")
async def create_task(request: TaskRequest):
    try:
        # Generate a unique task ID using UUID
        task_id = str(uuid.uuid4())
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tasks/update")
async def update_task(update: DOMUpdate):
    try:
        # For now, just log the data
        print(f"Received DOM update for task {update.task_id}")
        print(f"DOM data: {update.dom_data}")
        print(f"Results: {update.result}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
