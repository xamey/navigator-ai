import json
import os
from datetime import datetime

import redis

from app.config import settings
from app.models.dom import DOMUpdate


class StorageService:
    """Service for storing DOM snapshots and metadata"""
    
    # Initialize Redis connection
    _redis_client = None
    
    @classmethod
    def get_redis(cls):
        """Get or create Redis connection"""
        if cls._redis_client is None:
            cls._redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True
            )
        return cls._redis_client

    @staticmethod
    def ensure_snapshots_directory():
        """Ensure the snapshots directory exists"""
        os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)

    @classmethod
    def save_dom_snapshot(cls, update: DOMUpdate) -> dict:
        """Save DOM snapshot and metadata to disk"""
        cls.ensure_snapshots_directory()

        # Parse timestamp
        timestamp = datetime.fromisoformat(
            update.dom_data.timestamp.replace('Z', '+00:00'))

        # Create base filename
        base_filename = f"task_{update.task_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}"

        # HTML file path
        html_filename = f"{settings.SNAPSHOTS_DIR}/{base_filename}.html"

        # Save HTML content
        with open(html_filename, "w", encoding="utf-8") as f:
            f.write(update.dom_data.html)

        # Create metadata
        metadata = {
            "task_id": update.task_id,
            "url": update.dom_data.url,
            "title": update.dom_data.title,
            "timestamp": update.dom_data.timestamp,
            "results": update.result,
            "iterations": update.iterations
        }

        # Metadata file path
        metadata_filename = f"{settings.SNAPSHOTS_DIR}/{base_filename}_metadata.json"

        # Save metadata
        with open(metadata_filename, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        # Save DOM structure if available
        if update.structure:
            structure_filename = f"{settings.SNAPSHOTS_DIR}/{base_filename}_structure.json"
            with open(structure_filename, "w", encoding="utf-8") as f:
                json.dump(update.structure, f, indent=2)

        # Update task history in Redis
        if update.result:
            cls.append_task_history(update.task_id, {
                "url": update.dom_data.url,
                "timestamp": update.dom_data.timestamp,
                "actions": update.result
            })

        return {
            "html": html_filename,
            "metadata": metadata_filename,
            "structure": f"{settings.SNAPSHOTS_DIR}/{base_filename}_structure.json" if update.structure else None
        }
        
    @classmethod
    def store_task(cls, task_id: str, task_text: str) -> bool:
        """Store a task in Redis"""
        redis_key = f"{settings.REDIS_PREFIX}{settings.REDIS_TASK_PREFIX}{task_id}"
        return cls.get_redis().set(
            redis_key, 
            task_text,
            ex=settings.REDIS_TASK_TTL
        )
    
    @classmethod
    def get_task(cls, task_id: str) -> str:
        """Get a task from Redis"""
        redis_key = f"{settings.REDIS_PREFIX}{settings.REDIS_TASK_PREFIX}{task_id}"
        return cls.get_redis().get(redis_key)
    
    @classmethod
    def append_task_history(cls, task_id: str, action_data: dict) -> bool:
        """Append action history for a task"""
        redis_key = f"{settings.REDIS_PREFIX}{settings.REDIS_TASK_HISTORY_PREFIX}{task_id}"
        history_list = cls.get_redis().lrange(redis_key, 0, -1)
        
        # Convert string items back to dicts
        history = [json.loads(item) for item in history_list] if history_list else []
        
        # Append new action
        history.append(action_data)
        
        # Clear the list and add updated history
        pipe = cls.get_redis().pipeline()
        pipe.delete(redis_key)
        
        # Add all items to list
        for item in history:
            pipe.rpush(redis_key, json.dumps(item))
            
        # Set expiration
        pipe.expire(redis_key, settings.REDIS_TASK_TTL)
        
        # Execute pipeline
        pipe.execute()
        return True
    
    @classmethod
    def get_task_history(cls, task_id: str) -> list:
        """Get action history for a task"""
        redis_key = f"{settings.REDIS_PREFIX}{settings.REDIS_TASK_HISTORY_PREFIX}{task_id}"
        history_list = cls.get_redis().lrange(redis_key, 0, -1)
        
        # Convert string items back to dicts
        return [json.loads(item) for item in history_list] if history_list else []
