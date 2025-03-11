from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class DOMData(BaseModel):
    url: str
    html: str
    title: str
    timestamp: str


class DOMCoordinates(BaseModel):
    x: float
    y: float


class CoordinateSet(BaseModel):
    topLeft: DOMCoordinates
    topRight: DOMCoordinates
    bottomLeft: DOMCoordinates
    bottomRight: DOMCoordinates
    center: DOMCoordinates
    width: float
    height: float


class ViewportInfo(BaseModel):
    scrollX: float
    scrollY: float
    width: float
    height: float


class DOMElementNode(BaseModel):
    tagName: str
    attributes: Dict[str, str]
    xpath: str
    children: List[int]
    isInteractive: bool
    isVisible: bool
    isTopElement: bool
    highlightIndex: Optional[int] = None
    shadowRoot: Optional[bool] = None
    viewportCoordinates: Optional[CoordinateSet] = None
    pageCoordinates: Optional[CoordinateSet] = None
    viewport: Optional[ViewportInfo] = None


class DOMTextNode(BaseModel):
    type: str = "TEXT_NODE"
    text: str
    isVisible: bool


class DOMUpdate(BaseModel):
    task_id: str
    dom_data: DOMData
    result: List[Dict] = Field(default_factory=list)
    iterations: int = 0
    structure: Dict[str, Any] = Field(default_factory=dict)


class DOMUpdateResponse(BaseModel):
    status: str
    message: str
    result: Any


class DOMState(BaseModel):
    url: str
    element_tree: Dict[str, Union[DOMElementNode, DOMTextNode]]


DOMNode = Union[DOMElementNode, DOMTextNode]
DOMHashMap = Dict[str, DOMNode]
