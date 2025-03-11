import json
import os

from app.api.services.storage_service import StorageService
from app.api.services.task_service import TaskService
from app.api.utils.prompts import build_system_prompt, build_user_message
from app.api.utils.dom_parser.optimizer10 import process_element_references
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
        
        # Get task and task history from Redis
        task_text = TaskService.get_task(update.task_id)
        task_history = TaskService.get_task_history(update.task_id)
        
        # Build user message with task and history - now returns selector_map too
        user_message, xpath_map, selector_map = build_user_message(
            dom_state=dom_state,
            task=task_text,
            result=update.result,
            history=task_history
        )

        system_message = build_system_prompt()

        # Get LLM response
        # result_text = generate(user_message, system_message)
        result = generate(user_message, system_message)
        
        print('LLM call complete')
        # Parse response and process element references
        try:
            # result_json = json.loads(result_text)
            processed_result = process_element_references(result, xpath_map, selector_map)
            # Convert back to string for storage and return
            result_2 = processed_result
            print(result_2)
        except json.JSONDecodeError:
            # If JSON parsing fails, keep the original result
            print("Warning: Failed to process element references. Using original response.")
            # result = result

        # write this to a file in the snapshots directory
        try:
            # Ensure the snapshots directory exists
            os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
            
            # Construct the full file path
            snapshot_file = os.path.join(
                settings.SNAPSHOTS_DIR, 
                f"task_{update.task_id}_dom_snapshot_prompt.txt"
            )
            
            # Write the content with proper formatting
            with open(snapshot_file, "w", encoding='utf-8') as f:
                content = f"{system_message}\n\n{user_message}\n\n{result_2.model_dump_json()}\n\n{result.model_dump_json()}\n\n{xpath_map}\n\n{selector_map}"
                f.write(content)
                f.flush()  # Ensure content is written to disk
                
            print(f"Successfully wrote snapshot to: {snapshot_file}")
            
        except Exception as e:
            print(f"Error writing snapshot file: {str(e)}")
            # You might want to log this error or handle it appropriately

        return DOMUpdateResponse(
            status="success",
            message="DOM update received and stored",
            result=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
