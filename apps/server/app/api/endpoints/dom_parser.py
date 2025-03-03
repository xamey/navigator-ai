from app.api.utils.dom_parser.processor import parse_dom
from app.models.dom import DOMHashMap
from fastapi import APIRouter

router = APIRouter()


@router.post("/parse")
async def dom_parse(document: str):
    """Parse the DOM state and return the updated DOM state"""
    parsed_dom_state = parse_dom(document)
    return parsed_dom_state
