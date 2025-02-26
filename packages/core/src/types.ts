export interface DOMCoordinates {
    x: number;
    y: number;
}

// Set of coordinates describing element position
export interface CoordinateSet {
    topLeft: DOMCoordinates;
    topRight: DOMCoordinates;
    bottomLeft: DOMCoordinates;
    bottomRight: DOMCoordinates;
    center: DOMCoordinates;
    width: number;
    height: number;
}

// Viewport information
export interface ViewportInfo {
    scrollX: number;
    scrollY: number;
    width: number;
    height: number;
}

// Element node representation
export interface DOMElementNode {
    tagName: string;
    attributes: Record<string, string>;
    xpath: string;
    children: number[]; // Array of IDs referencing other nodes in the map
    isInteractive: boolean;
    isVisible: boolean;
    isTopElement: boolean;
    highlightIndex?: number; // Optional, only present for interactive elements
    shadowRoot?: boolean; // Optional, only present if element has shadow DOM
    viewportCoordinates?: CoordinateSet; // Coordinates relative to viewport
    pageCoordinates?: CoordinateSet; // Coordinates relative to page
    viewport?: ViewportInfo; // Information about viewport and scroll position
}

// Text node representation
export interface DOMTextNode {
    type: "TEXT_NODE";
    text: string;
    isVisible: boolean;
}

// Union type for any node
export type DOMNode = DOMElementNode | DOMTextNode;

// The complete DOM hash map
export interface DOMHashMap {
    [id: string]: DOMNode;
}

export type NodeType = Element | Text;