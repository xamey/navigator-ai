from app.api.services.storage_service import StorageService
from app.api.services.task_service import TaskService
from app.api.utils.prompts import build_system_prompt, build_user_message
from app.config import settings
from app.models.dom import DOMState, DOMUpdate, DOMUpdateResponse
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
        dom_state = DOMState(
            url=update.dom_data.url,
            element_tree=update.structure
        )
        # Build user message
        user_message, xpath_map = build_user_message(dom_state)

        system_message = build_system_prompt()

        # write this to a file in the snapshots directory
        with open(f"{settings.SNAPSHOTS_DIR}/{update.task_id}_dom_snapshot_prompt.txt", "w") as f:
            print("Writing to file to - ",
                  f"{settings.SNAPSHOTS_DIR}/{update.task_id}_dom_snapshot_prompt.txt")
            f.write(system_message + "\n" + user_message)

        print("Done writing to file")

        return DOMUpdateResponse(
            status="success",
            message="DOM update received and stored",
            files={}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
