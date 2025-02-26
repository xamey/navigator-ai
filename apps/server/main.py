import json
import os
import uuid
from datetime import datetime
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


class DOMData(BaseModel):
    url: str
    html: str
    title: str
    timestamp: str


class DOMUpdate(BaseModel):
    task_id: str
    dom_data: DOMData
    result: List[Dict] = []
    iterations: int = 0
    structure: object = {}


class TaskCreate(BaseModel):
    task: str


@app.get("/")
async def root():
    return {"message": "Navigator AI API"}


@app.post("/tasks/create")
async def create_task(task: TaskCreate):
    try:
        # Generate a unique task ID (you might want to use UUID or your own logic)
        task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Here you would typically store the task in a database
        # For now, we'll just return the task_id
        return {"task_id": task_id, "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tasks/update")
async def update_task(update: DOMUpdate):
    try:
        # Log the update (you would typically store this in a database)
        print(f"Received DOM update for task {update.task_id}")
        print(f"URL: {update.dom_data.url}")
        print(f"Title: {update.dom_data.title}")
        print(f"Timestamp: {update.dom_data.timestamp}")
        print(f"Iterations: {update.iterations}")
        print(f"Structure: {update.structure}")
        # print(update.dom_data)

        # Store the HTML content in a file for debugging/analysis
        # Create a directory for storing DOM snapshots if it doesn't exist
        snapshots_dir = "dom_snapshots"
        os.makedirs(snapshots_dir, exist_ok=True)

        # Create a filename based on task ID and timestamp
        timestamp = datetime.fromisoformat(
            update.dom_data.timestamp.replace('Z', '+00:00'))
        filename = f"{snapshots_dir}/task_{update.task_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}.html"

        # Save metadata separately
        metadata_filename = f"{snapshots_dir}/task_{update.task_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}_metadata.json"
        metadata = {
            "task_id": update.task_id,
            "url": update.dom_data.url,
            "title": update.dom_data.title,
            "timestamp": update.dom_data.timestamp,
            "results": update.result
        }

        return {
            "status": "success",
            "message": "DOM update received and stored",
            "files": {
                "html": filename,
                "metadata": metadata_filename
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
