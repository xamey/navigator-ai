import json
import os
from datetime import datetime

from app.config import settings
from app.models.dom import DOMUpdate


class StorageService:
    """Service for storing DOM snapshots and metadata"""

    @staticmethod
    def ensure_snapshots_directory():
        """Ensure the snapshots directory exists"""
        os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)

    @staticmethod
    def save_dom_snapshot(update: DOMUpdate) -> dict:
        """Save DOM snapshot and metadata to disk"""
        StorageService.ensure_snapshots_directory()

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

        return {
            "html": html_filename,
            "metadata": metadata_filename,
            "structure": f"{settings.SNAPSHOTS_DIR}/{base_filename}_structure.json" if update.structure else None
        }
