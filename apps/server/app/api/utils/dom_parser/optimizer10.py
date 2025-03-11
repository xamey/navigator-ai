import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from app.api.utils.llm import GenerateResponse

logger = logging.getLogger("dom-mapper")

class TokenEfficientDOMMapper:
    """
    Creates a highly token-efficient representation of DOM for LLM consumption.
    Instead of full HTML structure, uses a compact format with indexed elements
    and explicit parent-child relationships.
    """

    def __init__(self):
        # Essential attributes to keep
        self.essential_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'src', 
            'role', 'aria-label', 'checked', 'selected', 'disabled'
        ]
        
        # Priority attributes for selectors (order matters)
        self.selector_attributes = [
            'id', 'data-testid', 'data-id', 'data-cy', 'data-test', 
            'name', 'class'
        ]
        
        # Text length cap to reduce tokens
        self.max_text_length = 80
        
        # Element id mapping for referencing
        self.element_map = {}
        self.next_id = 1
        
        # XPath mapping
        self.xpath_map = {}
        
        # CSS selector mapping
        self.selector_map = {}
        
        # Track processed elements to avoid cycles
        self.processed_elements = set()

    def create_compact_representation(self, dom_hashmap: Dict) -> Tuple[str, Dict, Dict]:
        """
        Generate a token-efficient representation of the DOM.
        
        Returns:
            Tuple of (compact_representation, xpath_map, selector_map)
        """
        if not dom_hashmap:
            return "Empty DOM", {}, {}
        
        # Reset all mappings
        self.element_map = {}
        self.xpath_map = {}
        self.selector_map = {}
        self.next_id = 1
        self.processed_elements = set()
        
        # Preprocess to collect interactive elements
        self._preprocess_elements(dom_hashmap)
        
        # Find the root element
        root_id = self._find_root_element(dom_hashmap)
        if not root_id:
            return "Could not determine root element", {}, {}
        
        # Build the compact representation
        compact_output = []
        compact_output.append("# Page Elements (ID: description [type] {key attributes})")
        
        # Process elements in a breadth-first manner to keep related elements together
        queue = [(root_id, 0)]  # (element_id, depth)
        while queue:
            elem_id, depth = queue.pop(0)
            
            if elem_id in self.processed_elements:
                continue
                
            self.processed_elements.add(elem_id)
            element = dom_hashmap.get(elem_id)
            
            if not element or self._is_text_node(element):
                continue
                
            # Skip non-visible elements except for structural or interactive ones
            is_visible = self._get_attr(element, 'isVisible', False)
            is_interactive = self._get_attr(element, 'isInteractive', False)
            tag_name = self._get_attr(element, 'tagName', '').lower()
            
            structural_tags = ['html', 'body', 'div', 'section', 'main', 'form', 'nav']
            form_tags = ['input', 'select', 'textarea', 'button', 'option']
            
            # Skip non-visible, non-interactive, non-structural elements
            if not is_visible and tag_name not in structural_tags and tag_name not in form_tags and not is_interactive:
                continue
                
            # Skip purely decorative elements
            if tag_name in ['style', 'script', 'svg', 'path', 'rect', 'circle']:
                continue
                
            # Process this element
            element_repr = self._process_element(elem_id, element, depth, dom_hashmap)
            if element_repr:
                compact_output.append(element_repr)
            
            # Add children to the queue
            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(child_id, int) else child_id
                queue.append((child_id_str, depth + 1))
        
        # Add a legend to help the LLM understand the format
        legend = [
            "Format: [element_id] description [tag] {attributes} (children)",
            "Interactive elements have element_id in format E1, E2, etc.",
            "Use element_id to reference elements in your actions.",
            ""
        ]
        
        return "\n".join(legend + compact_output), self.xpath_map, self.selector_map
    
    def _preprocess_elements(self, dom_hashmap: Dict):
        """Pre-process all elements to collect info on interactive ones."""
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue
                
            is_interactive = self._get_attr(element, 'isInteractive', False)
            if is_interactive:
                # Assign an ID for this element
                element_idx = f"E{self.next_id}"
                self.next_id += 1
                
                # Store XPath if available
                xpath = self._get_attr(element, 'xpath', '')
                if xpath:
                    self.xpath_map[element_idx] = xpath
                
                # Generate and store selector
                tag_name = self._get_attr(element, 'tagName', '').lower()
                attributes = self._get_attr(element, 'attributes', {})
                selector = self._generate_selector(tag_name, attributes)
                if selector:
                    self.selector_map[element_idx] = selector
                
                # Store the mapping
                self.element_map[elem_id] = element_idx
    
    def _is_text_node(self, element: Any) -> bool:
        """Check if element is a text node."""
        if hasattr(element, 'type'):
            return element.type == 'TEXT_NODE'
        elif isinstance(element, dict):
            return element.get('type') == 'TEXT_NODE'
        return False

    def _get_attr(self, element: Any, attr_name: str, default=None):
        """Get attribute from element regardless of its structure."""
        if hasattr(element, attr_name):
            return getattr(element, attr_name)
        elif isinstance(element, dict):
            return element.get(attr_name, default)
        return default
    
    def _find_root_element(self, dom_hashmap: Dict) -> Optional[str]:
        """Find the root element (body or html) in the DOM."""
        # First look for the body tag
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            tag_name = self._get_attr(element, 'tagName', '').lower()
            if tag_name == 'body':
                return elem_id

        # If no body, look for html
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            tag_name = self._get_attr(element, 'tagName', '').lower()
            if tag_name == 'html':
                return elem_id

        # If no html/body, find an element with no parent
        parent_map = {}
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                parent_map[child_id_str] = elem_id

        # Find elements without parents
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            if elem_id not in parent_map:
                return elem_id

        # If all else fails, return the first non-text element
        for elem_id, element in dom_hashmap.items():
            if not self._is_text_node(element):
                return elem_id

        return None
    
    def _generate_selector(self, tag_name: str, attributes: Dict) -> str:
        """Generate a CSS selector from element attributes."""
        if not tag_name:
            return ""
            
        # Try each selector attribute in priority order
        for attr in self.selector_attributes:
            if attr in attributes and attributes[attr]:
                value = attributes[attr]
                
                if attr == 'id':
                    return f"{tag_name}#{value}"
                elif attr == 'class':
                    # Take first class if multiple
                    classes = value.split()
                    if classes:
                        return f"{tag_name}.{classes[0]}"
                else:
                    return f"{tag_name}[{attr}=\"{value}\"]"
        
        # If no good selector, just return the tag
        return tag_name
    
    def _get_important_attributes(self, element: Any) -> Dict:
        """Extract important attributes and format them for display."""
        attributes = self._get_attr(element, 'attributes', {})
        result = {}
        
        # Extract essential attributes
        for attr in self.essential_attributes:
            if attr in attributes and attributes[attr]:
                value = attributes[attr]
                # Truncate long values
                if isinstance(value, str) and len(value) > 30:
                    value = value[:27] + "..."
                result[attr] = value
                
        # Special handling for form elements
        tag_name = self._get_attr(element, 'tagName', '').lower()
        if tag_name in ['input', 'textarea', 'select']:
            # Check if there's a placeholder or value
            if 'placeholder' in result and result['placeholder']:
                result['placeholder'] = f"'{result['placeholder']}'"
            if 'value' in result and result['value']:
                result['value'] = f"'{result['value']}'"
            # Add state attributes
            for state_attr in ['checked', 'selected', 'disabled']:
                if state_attr in attributes and attributes[state_attr]:
                    result[state_attr] = True
                    
        return result
    
    def _get_element_text(self, element: Any, dom_hashmap: Dict) -> str:
        """Get the visible text content for an element."""
        # First check if this element has text content
        if self._is_text_node(element):
            if self._get_attr(element, 'isVisible', False):
                text = self._get_attr(element, 'text', '').strip()
                if text:
                    return text[:self.max_text_length] + ("..." if len(text) > self.max_text_length else "")
            return ""
            
        # Next, look for text nodes in children
        text_parts = []
        children = self._get_attr(element, 'children', [])
        
        for child_id in children:
            child_id_str = str(child_id) if isinstance(child_id, int) else child_id
            child = dom_hashmap.get(child_id_str)
            
            if child and self._is_text_node(child) and self._get_attr(child, 'isVisible', False):
                text = self._get_attr(child, 'text', '').strip()
                if text:
                    text_parts.append(text)
        
        if text_parts:
            combined_text = " ".join(text_parts)
            if len(combined_text) > self.max_text_length:
                combined_text = combined_text[:self.max_text_length] + "..."
            return combined_text
            
        return ""
    
    def _get_interactive_children(self, element: Any, dom_hashmap: Dict) -> List[str]:
        """Get IDs of interactive child elements."""
        result = []
        children = self._get_attr(element, 'children', [])
        
        for child_id in children:
            child_id_str = str(child_id) if isinstance(child_id, int) else child_id
            
            # Check if this child is in our element map (interactive)
            if child_id_str in self.element_map:
                result.append(self.element_map[child_id_str])
            else:
                # Otherwise check its children recursively
                child = dom_hashmap.get(child_id_str)
                if child and not self._is_text_node(child):
                    nested_children = self._get_interactive_children(child, dom_hashmap)
                    result.extend(nested_children)
                    
        return result
    
    def _process_element(self, elem_id: str, element: Any, depth: int, dom_hashmap: Dict) -> str:
        """Process an element and return its string representation."""
        tag_name = self._get_attr(element, 'tagName', '').lower()
        is_interactive = self._get_attr(element, 'isInteractive', False)
        
        # Get element's text content
        element_text = self._get_element_text(element, dom_hashmap)
        
        # Get important attributes
        attrs = self._get_important_attributes(element)
        
        # Format attributes string
        attrs_str = ""
        if attrs:
            attrs_parts = []
            for key, value in attrs.items():
                if isinstance(value, bool):
                    attrs_parts.append(key)
                else:
                    attrs_parts.append(f"{key}={value}")
            attrs_str = " {" + ", ".join(attrs_parts) + "}"
        
        # Determine element identifier
        element_id = self.element_map.get(elem_id, "")
        
        # Get interactive children
        interactive_children = self._get_interactive_children(element, dom_hashmap)
        children_str = ""
        if interactive_children:
            children_str = f" (children: {', '.join(interactive_children)})"
            
        # Create the element representation
        indent = "  " * depth
        
        # For interactive elements, include ID and more details
        if is_interactive:
            # For input field, show value/placeholder in description
            description = ""
            if element_text:
                description = f"'{element_text}'"
            elif tag_name == 'input' and attrs.get('placeholder'):
                description = f"Input with placeholder: {attrs.get('placeholder')}"
            elif tag_name == 'input' and attrs.get('value'):
                description = f"Input with value: {attrs.get('value')}"
            elif tag_name in ['button', 'a']:
                description = f"'{element_text or 'Unlabeled ' + tag_name}'"
            elif tag_name == 'select':
                description = "Dropdown selector"
            else:
                description = element_text or f"{tag_name} element"
                
            # Include the element ID for reference
            return f"{indent}{element_id}: {description} [{tag_name}]{attrs_str}{children_str}"
            
        # For structural elements with interactive children, include them
        elif interactive_children:
            description = element_text or f"{tag_name} container"
            return f"{indent}- {description} [{tag_name}]{attrs_str}{children_str}"
            
        # Skip non-interactive elements with no interactive children
        # unless they have significant text content or are close to interactive elements
        elif element_text and depth <= 3:  # Only include text within 3 levels of depth
            return f"{indent}- {element_text} [{tag_name}]{attrs_str}"
            
        return None


def generate_token_efficient_dom_for_llm(dom_state):
    """Generate a token-efficient DOM representation for LLM consumption."""
    mapper = TokenEfficientDOMMapper()
    
    compact_repr, xpath_map, selector_map = mapper.create_compact_representation(
        dom_state.element_tree)
    
    return compact_repr, xpath_map, selector_map


def process_element_references(response_json: GenerateResponse, xpath_map, selector_map):
    """Process element references in LLM response to map them to XPaths or selectors."""
    if not response_json or not hasattr(response_json, 'actions'):
        return response_json
        
    actions = response_json.actions
    
    for action in actions:
        # First check for element_id (primary field from system prompt)
        if hasattr(action, 'element_id') and action.element_id:
            element_id = action.element_id
            
            # Check if it's in our maps
            if element_id in xpath_map:
                action.xpath_ref = xpath_map[element_id]
                
            if element_id in selector_map:
                action.selector = selector_map[element_id]
        
        # Backward compatibility with xpath_ref
        elif hasattr(action, 'xpath_ref') and action.xpath_ref:
            element_id = action.xpath_ref
            if element_id in xpath_map:
                action.xpath = xpath_map[element_id]
            if element_id in selector_map:
                action.selector = selector_map[element_id]
    
    return response_json