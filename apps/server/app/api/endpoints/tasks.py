import json
import os

from app.api.services.storage_service import StorageService
from app.api.services.task_service import TaskService
from app.api.utils.prompts import build_system_prompt, build_user_message
from app.api.utils.dom_parser.optimizerdome12 import process_element_references
from app.config import settings
from app.models.dom import DOMState, DOMUpdate, DOMUpdateResponse
from app.models.tasks import TaskCreate, TaskResponse
from fastapi import APIRouter, HTTPException

from app.api.utils.llm import generate

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
        files = StorageService.save_dom_snapshot(update)
        dom_state = DOMState(
            url=update.dom_data.url,
            element_tree=update.structure
        )
        
        task_text = TaskService.get_task(update.task_id)
        task_history = TaskService.get_task_history(update.task_id)
        
        user_message, xpath_map, selector_map = build_user_message(
            dom_state=dom_state,
            task=task_text,
            result=update.result,
            history=task_history
        )

        system_message = build_system_prompt()
        result = generate(user_message, system_message)
        processed_result = process_element_references(result, xpath_map, selector_map)
        
        try:
            os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
            snapshot_file = os.path.join(
                settings.SNAPSHOTS_DIR, 
                f"task_{update.task_id}_dom_snapshot_prompt.txt"
            )
            
            with open(snapshot_file, "w", encoding='utf-8') as f:
                content = f"{system_message}\n\n{user_message}\n\n{processed_result.model_dump_json()}"
                f.write(content)
                f.flush()
                
        except Exception:
            pass

        return DOMUpdateResponse(
            status="success",
            message="DOM update received and stored",
            result=processed_result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
