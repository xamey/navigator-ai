from app.api.services.storage_service import StorageService
from app.api.services.task_service import TaskService
from app.models.dom import DOMUpdate, DOMUpdateResponse
from app.models.tasks import TaskCreate, TaskResponse
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/create", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """Create a new navigation task"""
    try:
        return TaskService.create_task(task)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=DOMUpdateResponse)
async def update_task(update: DOMUpdate):
    """Update a task with DOM data"""
    try:
        # Log the update (for debugging)
        print(f"Received DOM update for task {update.task_id}")
        print(f"URL: {update.dom_data.url}")
        print(f"Title: {update.dom_data.title}")
        print(f"Timestamp: {update.dom_data.timestamp}")
        print(f"Iterations: {update.iterations}")

        # Store the update
        files = StorageService.save_dom_snapshot(update)

        return DOMUpdateResponse(
            status="success",
            message="DOM update received and stored",
            files=files
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
