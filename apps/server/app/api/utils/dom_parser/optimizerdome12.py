import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from app.api.utils.llm import GenerateResponse

logger = logging.getLogger("dom-mapper")

class HighlightStyleMapper:
    """
    Creates a DOM representation similar to the clickable_elements_to_string method
    with highlight indices. Uses E-ids instead and provides both XPath and selector maps.
    """

    def __init__(self, include_attributes=None):
        # Attributes to include in the output if requested
        self.include_attributes = include_attributes or ['id', 'name', 'type', 'value', 'placeholder', 'href']
        
        # Element ID mapping (DOM ID -> E1, E2, etc.)
        self.element_map = {}
        self.next_id = 1
        
        # XPath and selector maps
        self.xpath_map = {}
        self.selector_map = {}
        
        # Track parent relationships for text context
        self.parent_map = {}
        
        # Track interactive elements
        self.interactive_elements = set()
        
        # Max text length for truncation
        self.max_text_length = 100

    def create_highlight_representation(self, dom_hashmap: Dict) -> Tuple[str, Dict, Dict]:
        """
        Generate a representation similar to clickable_elements_to_string.
        
        Returns:
            Tuple of (highlight_representation, xpath_map, selector_map)
        """
        if not dom_hashmap:
            return "No elements found on page", {}, {}
        
        # Reset state
        self.element_map = {}
        self.xpath_map = {}
        self.selector_map = {}
        self.parent_map = {}
        self.interactive_elements = set()
        self.next_id = 1
        
        # Build parent mapping and identify interactive elements
        self._preprocess_dom(dom_hashmap)
        
        # Find the root element
        root_id = self._find_root_element(dom_hashmap)
        if not root_id:
            return "Could not determine root element", {}, {}
        
        # Process DOM and generate output lines
        output_lines = []
        text_nodes_to_include = []
        
        # Process all interactive elements
        for elem_id in sorted(self.interactive_elements, key=lambda x: int(self.element_map[x][1:])):
            element = dom_hashmap.get(elem_id)
            if not element or self._is_text_node(element):
                continue
                
            # Format this interactive element
            element_line = self._format_interactive_element(elem_id, element, dom_hashmap)
            if element_line:
                output_lines.append(element_line)
        
        # Add important standalone text (not part of interactive elements)
        standalone_text = self._extract_standalone_text(dom_hashmap)
        if standalone_text:
            if output_lines:
                output_lines.append("")  # Add separator
            output_lines.append("# Additional Page Text")
            output_lines.extend(standalone_text)
        
        # Format and return the output
        if not output_lines:
            return "No interactive elements found on page", {}, {}
            
        output = "\n".join(output_lines)
        return output, self.xpath_map, self.selector_map
    
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
        
    def _preprocess_dom(self, dom_hashmap: Dict):
        """Build parent mapping and identify interactive elements."""
        # Build parent map
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue
                
            children = self._get_attr(element, 'children', [])
            for child_id in children:
                # Ensure consistent key format
                child_id_str = str(child_id)
                # Skip if child doesn't exist in dom_hashmap
                if child_id_str not in dom_hashmap and child_id not in dom_hashmap:
                    continue
                # Add to parent map
                self.parent_map[child_id_str] = elem_id
        
        # Identify interactive elements and assign IDs
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue
                
            # Skip non-visible elements
            is_visible = self._get_attr(element, 'isVisible', False)
            if not is_visible:
                continue
                
            # Track interactive elements
            is_interactive = self._get_attr(element, 'isInteractive', False)
            tag_name = self._get_attr(element, 'tagName', '').lower()
            
            # Consider element interactive if it has the flag or is a key form control
            form_tags = ['input', 'select', 'textarea', 'button', 'a']
            if is_interactive or tag_name in form_tags:
                # It's interactive - assign an ID
                element_id = f"E{self.next_id}"
                self.next_id += 1
                
                # Store mappings
                self.element_map[elem_id] = element_id
                self.interactive_elements.add(elem_id)
                
                # Store XPath
                xpath = self._get_attr(element, 'xpath', '')
                if xpath:
                    self.xpath_map[element_id] = xpath
                
                # Generate and store CSS selector
                attributes = self._get_attr(element, 'attributes', {})
                selector = self._generate_selector(tag_name, attributes, dom_hashmap, elem_id)
                if selector:
                    self.selector_map[element_id] = selector
    
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
                
        # If no clear root, use any element with no parent
        for elem_id in dom_hashmap:
            if elem_id not in self.parent_map:
                return elem_id
                
        # Fallback to first element
        if dom_hashmap:
            return next(iter(dom_hashmap))
            
        return None
    
    def _has_highlighted_parent(self, elem_id: str) -> bool:
        """Check if the element has a parent that is interactive (has a highlight ID)."""
        current_id = self.parent_map.get(elem_id)
        while current_id:
            if current_id in self.interactive_elements:
                return True
            current_id = self.parent_map.get(current_id)
        return False
    
    def _get_text_till_next_highlighted(self, elem_id: str, dom_hashmap: Dict, max_depth: int = -1) -> str:
        """Get all text from this element until the next highlighted element."""
        text_parts = []
        
        def collect_text(node_id: str, current_depth: int) -> None:
            # Check depth limit
            if max_depth != -1 and current_depth > max_depth:
                return
                
            # Skip if node doesn't exist
            if node_id not in dom_hashmap:
                return
                
            node = dom_hashmap[node_id]
            
            # Skip if this is a highlighted element (except the starting one)
            if node_id != elem_id and node_id in self.interactive_elements:
                return
                
            # If it's a text node, add its text
            if self._is_text_node(node) and self._get_attr(node, 'isVisible', False):
                text = self._get_attr(node, 'text', '').strip()
                if text:
                    text_parts.append(text)
            # If it's an element, process its children
            elif not self._is_text_node(node):
                children = self._get_attr(node, 'children', [])
                for child_id in children:
                    # Ensure consistent ID format
                    child_id_str = str(child_id)
                    collect_text(child_id_str if child_id_str in dom_hashmap else child_id, current_depth + 1)
        
        # Start collection from this element
        collect_text(elem_id, 0)
        
        # Join text parts
        text = ' '.join(text_parts).strip()
        
        # Truncate if too long
        if text and len(text) > self.max_text_length:
            text = text[:self.max_text_length - 3] + "..."
            
        return text
    
    def _format_interactive_element(self, elem_id: str, element: Any, dom_hashmap: Dict) -> str:
        """Format an interactive element in the highlight style."""
        # Get element ID (E1, E2, etc.)
        element_id = self.element_map.get(elem_id)
        if not element_id:
            return None
            
        # Get basic element info
        tag_name = self._get_attr(element, 'tagName', '').lower()
        attributes = self._get_attr(element, 'attributes', {})
        
        # Get all text within this element until the next highlighted element
        element_text = self._get_text_till_next_highlighted(elem_id, dom_hashmap)
        
        # Format attributes string if requested
        attributes_str = ''
        if self.include_attributes:
            attr_values = []
            for key, value in attributes.items():
                if key in self.include_attributes and value and value != tag_name:
                    # If it's the same as the element text, don't duplicate
                    if value != element_text:
                        attr_values.append(str(value))
            
            # If element text is in attributes, remove it to avoid duplication
            if element_text in attr_values:
                attr_values.remove(element_text)
                
            if attr_values:
                attributes_str = ';'.join(attr_values)
        
        # Build the output line
        line = f"[{element_id}]<{tag_name} "
        
        if attributes_str:
            line += f"{attributes_str}"
            
        if element_text:
            if attributes_str:
                line += f">{element_text}"
            else:
                line += f"{element_text}"
                
        line += "/>"
        
        return line
    
    def _extract_standalone_text(self, dom_hashmap: Dict) -> List[str]:
        """Extract important text content not part of interactive elements."""
        text_sections = []
        text_nodes_processed = set()
        
        # For each text node that's visible
        for elem_id, element in dom_hashmap.items():
            if not self._is_text_node(element) or not self._get_attr(element, 'isVisible', False):
                continue
                
            # Skip if already processed
            if elem_id in text_nodes_processed:
                continue
            
            # Skip if part of an interactive element
            if self._has_highlighted_parent(elem_id):
                text_nodes_processed.add(elem_id)
                continue
                
            # Skip if not substantial
            text = self._get_attr(element, 'text', '').strip()
            if not text or len(text) < 15:  # Skip very short text
                continue
                
            # Include this text
            if len(text) > self.max_text_length:
                text = text[:self.max_text_length] + "..."
            
            text_sections.append(f"- {text}")
            text_nodes_processed.add(elem_id)
        
        return text_sections
        
    def _generate_selector(self, tag_name: str, attributes: Dict, dom_hashmap: Dict, elem_id: str) -> str:
        """Generate a robust CSS selector for the element."""
        if not tag_name:
            return ""
            
        # Start with tag name
        selector = tag_name
        
        # Try ID selector (most reliable)
        if 'id' in attributes and attributes['id']:
            return f"#{attributes['id']}"
        
        # Try data attributes for testing
        for attr in ['data-testid', 'data-cy', 'data-test', 'data-qa']:
            if attr in attributes and attributes[attr]:
                return f"[{attr}='{attributes[attr]}']"
        
        # For inputs, use name and type
        if tag_name == 'input':
            selector_parts = [tag_name]
            
            if 'type' in attributes:
                selector_parts.append(f"[type='{attributes['type']}']")
                
            if 'name' in attributes:
                selector_parts.append(f"[name='{attributes['name']}']")
                
            if len(selector_parts) > 1:
                return ''.join(selector_parts)
        
        # For links, use href if it's not too complex
        if tag_name == 'a' and 'href' in attributes:
            href = attributes['href']
            if len(href) < 50 and not href.startswith('javascript:'):
                return f"a[href='{href}']"
        
        # Use class if available and not too complex
        if 'class' in attributes and attributes['class']:
            classes = attributes['class'].split()
            # Find classes that are specific (not utility classes)
            specific_classes = [c for c in classes if len(c) > 3 and not c.startswith('js-')]
            if specific_classes:
                return f"{tag_name}.{specific_classes[0]}"
        
        # If we have a parent mapping, try to create a more specific selector
        parent_id = self.parent_map.get(elem_id)
        if parent_id and parent_id in dom_hashmap:
            parent = dom_hashmap.get(parent_id)
            if parent:
                parent_tag = self._get_attr(parent, 'tagName', '').lower()
                
                # Check if parent has an ID
                parent_attrs = self._get_attr(parent, 'attributes', {})
                if 'id' in parent_attrs and parent_attrs['id']:
                    # Use parent ID with child selector
                    return f"#{parent_attrs['id']} > {selector}"
                
                # Try to find sibling position
                siblings = []
                parent_children = self._get_attr(parent, 'children', [])
                
                for child_id in parent_children:
                    # Convert to string for consistency and check existence
                    child_id_str = str(child_id)
                    child = None
                    if child_id_str in dom_hashmap:
                        child = dom_hashmap[child_id_str]
                    elif child_id in dom_hashmap:
                        child = dom_hashmap[child_id]
                        
                    if child and not self._is_text_node(child):
                        child_tag = self._get_attr(child, 'tagName', '').lower()
                        if child_tag == tag_name:
                            # Use string format for consistency
                            siblings.append(str(child_id))
                
                if siblings:
                    try:
                        # Find position of this element among siblings
                        elem_id_str = str(elem_id)
                        if elem_id_str in siblings:
                            position = siblings.index(elem_id_str) + 1
                            if position > 0:
                                return f"{parent_tag} > {selector}:nth-of-type({position})"
                    except ValueError:
                        # Element not found in siblings, use tag only
                        pass
        
        # Fallback to tag name only
        return selector


def generate_highlight_style_dom(dom_state, include_attributes=None):
    """Generate a highlight-style DOM representation with both XPath and selector maps."""
    mapper = HighlightStyleMapper(include_attributes=include_attributes)
    
    highlight_repr, xpath_map, selector_map = mapper.create_highlight_representation(
        dom_state.element_tree)
    
    return highlight_repr, xpath_map, selector_map


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