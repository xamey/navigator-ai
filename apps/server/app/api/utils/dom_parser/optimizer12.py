import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("dom-mapper")

class FixedCompactMapper:
    """
    Creates a highly token-efficient representation of DOM for LLM consumption.
    Provides both XPath and CSS selector maps with robust key handling.
    """

    def __init__(self):
        # Essential attributes to keep - reduced to absolute minimum
        self.essential_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href',
            'checked', 'selected', 'disabled'
        ]
        
        # Priority attributes for selectors (order matters)
        self.selector_attributes = ['id', 'name', 'class', 'type', 'placeholder']
        
        # Text length cap to reduce tokens
        self.max_text_length = 50
        
        # Maximum depth for non-interactive elements
        self.max_depth = 4
        
        # Element id mapping for referencing
        self.element_map = {}
        self.next_id = 1
        
        # XPath mapping
        self.xpath_map = {}
        
        # CSS selector mapping
        self.selector_map = {}
        
        # Parent map for tracking hierarchy
        self.parent_map = {}
        
        # Interactive element set
        self.interactive_elements = set()
        
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
        
        # Reset all mappings and state
        self.element_map = {}
        self.xpath_map = {}
        self.selector_map = {}
        self.parent_map = {}
        self.interactive_elements = set()
        self.next_id = 1
        self.processed_elements = set()
        
        # Build parent mapping and identify interactive elements
        self._preprocess_dom(dom_hashmap)
        
        # Build the compact representation
        compact_output = []
        compact_output.append("# Page Elements")
        compact_output.append("# Format: [ID] Description (Type) {Attributes}")
        compact_output.append("")
        
        # Process elements by categories
        form_elements = self._get_categorized_elements(dom_hashmap, ['input', 'textarea', 'select'])
        button_elements = self._get_categorized_elements(dom_hashmap, ['button'])
        link_elements = self._get_categorized_elements(dom_hashmap, ['a'])
        other_interactive = self._get_other_interactive_elements(dom_hashmap, 
                                                               set(form_elements) | set(button_elements) | set(link_elements))
        
        # Add sections for each category
        if form_elements:
            compact_output.append("## Form Elements")
            for elem_id in form_elements:
                element_repr = self._format_element(elem_id, dom_hashmap)
                if element_repr:
                    compact_output.append(element_repr)
            compact_output.append("")
            
        if button_elements:
            compact_output.append("## Buttons")
            for elem_id in button_elements:
                element_repr = self._format_element(elem_id, dom_hashmap)
                if element_repr:
                    compact_output.append(element_repr)
            compact_output.append("")
            
        if link_elements:
            compact_output.append("## Links")
            for elem_id in link_elements:
                element_repr = self._format_element(elem_id, dom_hashmap)
                if element_repr:
                    compact_output.append(element_repr)
            compact_output.append("")
            
        if other_interactive:
            compact_output.append("## Other Interactive Elements")
            for elem_id in other_interactive:
                element_repr = self._format_element(elem_id, dom_hashmap)
                if element_repr:
                    compact_output.append(element_repr)
            compact_output.append("")
            
        # Add key text content that's not already included
        important_text = self._extract_important_text(dom_hashmap)
        if important_text:
            compact_output.append("## Page Text")
            compact_output.extend(important_text)
            compact_output.append("")
        
        # Add a section about parent-child relationships if it helps
        compact_output.append("## Element Relationships")
        relationships = self._extract_key_relationships()
        compact_output.extend(relationships)
        
        return "\n".join(compact_output), self.xpath_map, self.selector_map
    
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
            
            # Consider element interactive if it has the flag or is a form control
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
    
    def _get_categorized_elements(self, dom_hashmap: Dict, tag_names: List[str]) -> List[str]:
        """Get interactive elements of specific tag types."""
        result = []
        
        for elem_id in self.interactive_elements:
            # Skip if element doesn't exist
            if elem_id not in dom_hashmap:
                continue
                
            element = dom_hashmap.get(elem_id)
            if not element:
                continue
                
            tag_name = self._get_attr(element, 'tagName', '').lower()
            if tag_name in tag_names:
                result.append(elem_id)
                
        return result
    
    def _get_other_interactive_elements(self, dom_hashmap: Dict, exclude_ids: Set[str]) -> List[str]:
        """Get other interactive elements not already categorized."""
        return [elem_id for elem_id in self.interactive_elements if elem_id not in exclude_ids and elem_id in dom_hashmap]
    
    def _format_element(self, elem_id: str, dom_hashmap: Dict) -> str:
        """Format a single element for the compact representation."""
        # Check if element exists
        if elem_id not in dom_hashmap:
            return None
            
        element = dom_hashmap.get(elem_id)
        if not element:
            return None
            
        element_id = self.element_map.get(elem_id)
        tag_name = self._get_attr(element, 'tagName', '').lower()
        
        # Get element text
        text = self._get_element_text(element, dom_hashmap)
        
        # Get key attributes
        attributes = self._get_important_attributes(element)
        
        # Format attributes
        attr_str = ""
        if attributes:
            attr_parts = []
            for key, value in attributes.items():
                if isinstance(value, bool) and value:
                    attr_parts.append(key)
                elif value:
                    attr_parts.append(f"{key}={value}")
            if attr_parts:
                attr_str = " {" + ", ".join(attr_parts) + "}"
        
        # Build description based on element type
        description = text if text else f"{tag_name} element"
        if tag_name == 'input':
            input_type = self._get_attr(element, 'attributes', {}).get('type', 'text')
            if input_type in ['checkbox', 'radio']:
                is_checked = 'checked' in self._get_attr(element, 'attributes', {})
                description = f"{input_type}{'(checked)' if is_checked else ''}"
            elif 'placeholder' in self._get_attr(element, 'attributes', {}):
                description = f"input({self._get_attr(element, 'attributes', {}).get('placeholder')})"
            elif 'value' in self._get_attr(element, 'attributes', {}) and self._get_attr(element, 'attributes', {}).get('value'):
                description = f"input:'{self._get_attr(element, 'attributes', {}).get('value')}'"
        
        return f"[{element_id}] {description} ({tag_name}){attr_str}"
    
    def _get_element_text(self, element: Any, dom_hashmap: Dict) -> str:
        """Get visible text for an element, limited to max length."""
        # For text nodes, return their content
        if self._is_text_node(element):
            if self._get_attr(element, 'isVisible', False):
                text = self._get_attr(element, 'text', '').strip()
                if text:
                    if len(text) > self.max_text_length:
                        return text[:self.max_text_length] + "..."
                    return text
            return ""
        
        # Collect text from children
        text_parts = []
        children = self._get_attr(element, 'children', [])
        
        for child_id in children:
            # Ensure consistent key format and check existence
            child_id_str = str(child_id)
            child = None
            if child_id_str in dom_hashmap:
                child = dom_hashmap[child_id_str]
            elif child_id in dom_hashmap:
                child = dom_hashmap[child_id]
                
            if child and self._is_text_node(child) and self._get_attr(child, 'isVisible', False):
                text = self._get_attr(child, 'text', '').strip()
                if text:
                    text_parts.append(text)
        
        if text_parts:
            combined = " ".join(text_parts)
            if len(combined) > self.max_text_length:
                return combined[:self.max_text_length] + "..."
            return combined
            
        return ""
    
    def _get_important_attributes(self, element: Any) -> Dict:
        """Extract important attributes with minimal token usage."""
        attributes = self._get_attr(element, 'attributes', {})
        result = {}
        
        # Extract essential attributes - be very selective
        tag_name = self._get_attr(element, 'tagName', '').lower()
        
        # For links, always include href
        if tag_name == 'a' and 'href' in attributes:
            result['href'] = attributes['href']
            
        # For inputs, include type, value (if short), and state
        elif tag_name == 'input':
            if 'type' in attributes:
                result['type'] = attributes['type']
            if 'id' in attributes:
                result['id'] = attributes['id']
            if 'name' in attributes:
                result['name'] = attributes['name']
            if 'checked' in attributes and attributes['checked']:
                result['checked'] = True
            if 'value' in attributes and attributes['value'] and len(attributes['value']) < 20:
                result['value'] = f"'{attributes['value']}'"
                
        # For other elements, include minimal attributes
        else:
            for attr in ['id', 'name']:
                if attr in attributes and attributes[attr]:
                    result[attr] = attributes[attr]
        
        return result
    
    def _extract_important_text(self, dom_hashmap: Dict) -> List[str]:
        """Extract important text content not already included with elements."""
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
            parent_id = self.parent_map.get(elem_id)
            is_part_of_interactive = False
            
            while parent_id:
                if parent_id in self.interactive_elements:
                    is_part_of_interactive = True
                    break
                parent_id = self.parent_map.get(parent_id)
                
            if is_part_of_interactive:
                text_nodes_processed.add(elem_id)
                continue
                
            # Skip if not substantial
            text = self._get_attr(element, 'text', '').strip()
            if not text or len(text) < 10:  # Skip very short text
                continue
                
            # Include this text
            if len(text) > self.max_text_length:
                text = text[:self.max_text_length] + "..."
            
            text_sections.append(f"- {text}")
            text_nodes_processed.add(elem_id)
        
        return text_sections
    
    def _extract_key_relationships(self) -> List[str]:
        """Extract key relationships between interactive elements."""
        relationships = []
        
        # Create a mapping of element IDs to their parents
        element_parents = {}
        
        # For each interactive element, find parent relationship
        for elem_id in self.interactive_elements:
            if elem_id not in self.element_map:
                continue
                
            element_id = self.element_map[elem_id]
            
            # Find nearest interactive parent
            parent_id = self.parent_map.get(elem_id)
            parent_element_id = None
            
            while parent_id:
                if parent_id in self.element_map:
                    parent_element_id = self.element_map[parent_id]
                    break
                parent_id = self.parent_map.get(parent_id)
                
            if parent_element_id:
                if parent_element_id not in element_parents:
                    element_parents[parent_element_id] = []
                element_parents[parent_element_id].append(element_id)
        
        # Format the relationships
        for parent_id, children in element_parents.items():
            if len(children) == 1:
                relationships.append(f"- {parent_id} contains {children[0]}")
            elif len(children) <= 3:
                relationships.append(f"- {parent_id} contains {', '.join(children)}")
            else:
                # For many children, summarize
                relationships.append(f"- {parent_id} contains {len(children)} elements: {', '.join(children[:3])}...")
        
        return relationships
        
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


def generate_fixed_compact_dom(dom_state):
    """Generate a compact DOM representation with robust key handling."""
    mapper = FixedCompactMapper()
    
    compact_repr, xpath_map, selector_map = mapper.create_compact_representation(
        dom_state.element_tree)
    
    return compact_repr, xpath_map, selector_map