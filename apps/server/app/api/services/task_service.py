import uuid
from datetime import datetime

from app.models.tasks import TaskCreate, TaskResponse


class TaskService:
    """Service for handling tasks"""

    @staticmethod
    def create_task(task: TaskCreate) -> TaskResponse:
        """Create a new task"""
        # Generate a unique task ID with timestamp
        task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        # In a real application, you would store this in a database

        return TaskResponse(
            task_id=task_id,
            status="created",
            message=f"Task created successfully: {task.task[:50]}"
        )
