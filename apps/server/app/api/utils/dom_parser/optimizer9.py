import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("dom-mapper")


class StructuredDOMMapper:
    """Creates a cleaned up but structurally accurate HTML representation of the DOM."""

    def __init__(self):
        # Essential attributes to keep
        self.essential_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'src',
            'role', 'aria-label', 'checked', 'selected', 'disabled', 'for',
            'class', 'title', 'alt', 'data-testid', 'data-id', 'data-cy', 
            'data-test', 'data-qa', 'data-e2e', 'data-automation'
        ]
        
        # CSS-friendly attributes that are useful for selectors
        self.selector_attributes = [
            'id', 'class', 'name', 'data-testid', 'data-id', 'data-cy', 
            'data-test', 'data-qa', 'data-e2e', 'data-automation'
        ]

        # XPath mapping for interactive elements
        self.xpath_map = {}
        self.next_idx = 1
        
        # Maximum text length to keep page size reasonable
        self.max_text_length = 100
        
        # Track elements we've already processed
        self.processed_elements = set()
        
        # Track interactive elements
        self.interactive_elements = {}

    def create_structured_html(self, dom_hashmap: Dict) -> Tuple[str, Dict]:
        """
        Generate a structured HTML representation with essential elements and attributes.

        Returns:
            Tuple of (html_output, xpath_map)
        """
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>", {}

        # Reset mapping
        self.xpath_map = {}
        self.next_idx = 1
        self.processed_elements = set()
        self.interactive_elements = {}

        # Pre-scan to find interactive elements and their attributes
        self._pre_scan_interactive_elements(dom_hashmap)

        # Find the root element (typically body)
        root_id = self._find_root_element(dom_hashmap)
        if not root_id:
            return "<html><body><p>Could not determine root element</p></body></html>", {}

        # Generate HTML starting from the root
        html_output = self._generate_html(root_id, dom_hashmap, depth=0)

        # Wrap in html/body if needed
        if not html_output.startswith("<html>"):
            html_output = f"<html>\n<body>\n{html_output}\n</body>\n</html>"

        return html_output, self.xpath_map

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
    
    def _pre_scan_interactive_elements(self, dom_hashmap: Dict):
        """Scan DOM to identify interactive elements and collect their attributes."""
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue
                
            # Check if interactive
            is_interactive = self._get_attr(element, 'isInteractive', False)
            
            if is_interactive:
                # Store all attributes that could be used for selectors
                attributes = self._get_attr(element, 'attributes', {})
                tag_name = self._get_attr(element, 'tagName', '').lower()
                
                # Build a selector-attributes map for this element
                selector_data = {'tag': tag_name}
                
                for attr_name in self.selector_attributes:
                    if attr_name in attributes and attributes[attr_name]:
                        selector_data[attr_name] = attributes[attr_name]
                
                # Store the element's xpath and selector data
                xpath = self._get_attr(element, 'xpath', '')
                if xpath:
                    self.interactive_elements[elem_id] = {
                        'xpath': xpath,
                        'selector_data': selector_data
                    }

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
    
    def _generate_css_selector(self, selector_data: Dict) -> str:
        """Generate a CSS selector from selector data."""
        if not selector_data:
            return ""
            
        # Start with the tag
        selector = selector_data.get('tag', '')
        
        # Add ID if available (most specific)
        if 'id' in selector_data:
            return f"{selector}#{selector_data['id']}"
            
        # Otherwise try data attributes
        for attr in ['data-testid', 'data-id', 'data-cy', 'data-test', 'data-qa', 'data-e2e', 'data-automation']:
            if attr in selector_data:
                return f"{selector}[{attr}=\"{selector_data[attr]}\"]"
                
        # Try name attribute
        if 'name' in selector_data:
            return f"{selector}[name=\"{selector_data['name']}\"]"
            
        # Last resort: class (less specific)
        if 'class' in selector_data:
            # Take the first class if there are multiple
            classes = selector_data['class'].split()
            if classes:
                return f"{selector}.{classes[0]}"
                
        # If nothing else works, just return the tag
        return selector

    def _generate_html(self, elem_id: str, dom_hashmap: Dict, depth: int = 0) -> str:
        """Generate HTML for an element and its children."""
        # Prevent cycles
        if elem_id in self.processed_elements:
            return ""
        self.processed_elements.add(elem_id)
        
        element = dom_hashmap.get(elem_id)
        if not element:
            return ""

        # Handle text nodes
        if self._is_text_node(element):
            # Only include visible text
            if self._get_attr(element, 'isVisible', False):
                text = self._get_attr(element, 'text', '').strip()
                if text:
                    # Truncate long text
                    if len(text) > self.max_text_length:
                        text = text[:self.max_text_length] + "..."
                    return text
            return ""

        # Handle element nodes
        tag_name = self._get_attr(element, 'tagName', 'div').lower()

        # Skip non-visible elements except for structural containers and form elements
        is_visible = self._get_attr(element, 'isVisible', False)
        is_interactive = self._get_attr(element, 'isInteractive', False)
        structural_tags = ['html', 'body', 'head', 'div', 'section', 'main', 'header', 'footer', 'nav', 'form']
        form_tags = ['input', 'select', 'textarea', 'button', 'option']
        
        if not is_visible and tag_name not in structural_tags and tag_name not in form_tags:
            # Always keep interactive elements even if not visible
            if not is_interactive:
                return ""

        # Skip purely decorative or non-semantic elements
        if tag_name in ['style', 'script', 'noscript', 'svg', 'path', 'rect', 'circle', 'polygon']:
            return ""

        # Start the opening tag
        indent = "  " * depth
        html = f"{indent}<{tag_name}"

        # Add essential attributes with priority on selector attributes
        attributes = self._get_attr(element, 'attributes', {})
        for attr_name in self.essential_attributes:
            if attr_name in attributes and attributes[attr_name]:
                attr_value = attributes[attr_name]
                # Truncate very long attribute values
                if isinstance(attr_value, str) and len(attr_value) > 100:
                    attr_value = attr_value[:100] + "..."
                html += f' {attr_name}="{attr_value}"'

        # Check if this is an interactive element and add reference
        is_interactive = self._get_attr(element, 'isInteractive', False)
        if is_interactive:
            # Store the XPath and assign an index
            xpath = self._get_attr(element, 'xpath', '')
            if xpath:
                element_idx = self.next_idx
                self.next_idx += 1
                self.xpath_map[str(element_idx)] = xpath

                # Add the reference attributes
                html += f' data-xref="xpath{element_idx}"'
                
                # Add CSS selector if we can generate one
                if elem_id in self.interactive_elements:
                    selector_data = self.interactive_elements[elem_id]['selector_data']
                    css_selector = self._generate_css_selector(selector_data)
                    if css_selector:
                        html += f' data-selector="{css_selector}"'

        # Close the opening tag
        html += ">"

        # Process children
        children = self._get_attr(element, 'children', [])
        if children:
            # Add a newline if there are children
            html += "\n"

            # Generate HTML for each child
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                child_html = self._generate_html(
                    child_id_str, dom_hashmap, depth + 1)
                if child_html:
                    html += child_html
                    # Add newline after block elements but not after text
                    if not (child_id_str in dom_hashmap and self._is_text_node(dom_hashmap[child_id_str])):
                        html += "\n"

            # Close tag on a new line
            html += f"{indent}</{tag_name}>"
        else:
            # Self-closing tag for elements without children
            if tag_name in ['input', 'img', 'br', 'hr', 'meta', 'link']:
                html = html[:-1] + " />"
            else:
                html += f"</{tag_name}>"

        return html


def generate_structured_html_for_llm(dom_state):
    """Generate a structured HTML representation for LLM consumption."""
    mapper = StructuredDOMMapper()

    html_output, xpath_map = mapper.create_structured_html(
        dom_state.element_tree)
    return html_output, xpath_map


def process_llm_response(response_json, xpath_map):
    """Process the LLM response to map element indices back to full XPaths."""
    if not response_json or "actions" not in response_json:
        return response_json

    actions = response_json["actions"]

    for action in actions:
        # Check for xpath_ref in the standard format "xpath123"
        if "xpath_ref" in action and action["xpath_ref"].startswith("xpath"):
            element_idx = action["xpath_ref"].replace("xpath", "")
            if element_idx in xpath_map:
                action["xpath"] = xpath_map[element_idx]
        
        # Look for element references in various field names as fallback
        element_idx = None
        for field_name in ["element", "element_idx", "idx", "index"]:
            if field_name in action:
                # Extract index value, handling different formats
                idx_value = action[field_name]
                # Convert to string if it's a number or extract from "[3]" format
                if isinstance(idx_value, int):
                    element_idx = str(idx_value)
                elif isinstance(idx_value, str):
                    # Check if it's in xpath format
                    if idx_value.startswith("xpath"):
                        element_idx = idx_value.replace("xpath", "")
                    # Remove brackets if present
                    elif idx_value.startswith('[') and idx_value.endswith(']'):
                        idx_value = idx_value[1:-1]
                        if idx_value.isdigit():
                            element_idx = idx_value
                    # Use if it's a digit
                    elif idx_value.isdigit():
                        element_idx = idx_value

                # Map index to XPath if found
                if element_idx and element_idx in xpath_map:
                    action["xpath"] = xpath_map[element_idx]

                    # Clean up original field to avoid confusion
                    for field_name in ["element", "element_idx", "idx", "index"]:
                        if field_name in action:
                            del action[field_name]
                    
                    break  # Stop looking for more indices once we found one

    return response_json
