from app.api.endpoints import dom_parser, health, tasks
from fastapi import APIRouter

# Main router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, tags=["health"])
api_router.include_router(dom_parser.router, prefix="/dom", tags=["dom"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
