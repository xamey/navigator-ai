import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("dom-mapper")


class HybridDOMMapper:
    """Creates extremely compact DOM representation using highlight indices with XPath mapping."""

    def __init__(self, max_text_length=50):
        self.max_text_length = max_text_length

        # Only keep these critical attributes
        self.critical_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'role',
            'aria-label', 'title'
        ]

        # These attributes should never be truncated
        self.no_truncate_attributes = [
            'href', 'id', 'name', 'value'
        ]

        # XPath to ID mapping for internal use
        self.xpath_to_ref_map = {}
        self.next_ref = 1

        # Track interactive elements for highlight indices
        self.interactive_elements = []

    def create_minimal_dom(self, dom_hashmap: Dict) -> Tuple[str, Dict]:
        """
        Generate compact DOM representation with highlight indices and XPath mapping.

        Returns:
            Tuple of (minimal_html, xpath_map)
        """
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>", {}

        # Reset mappings
        self.xpath_to_ref_map = {}
        self.next_ref = 1
        self.interactive_elements = []

        # Step 1: Identify interactive elements and assign highlight indices
        self._identify_interactive_elements(dom_hashmap)

        # Step 2: Generate compact HTML representation
        minimal_html = self._generate_highlight_output()

        # Create reverse mapping (ref -> xpath) for easier lookup
        idx_to_xpath_map = {}
        for i, element_data in enumerate(self.interactive_elements, 1):
            element_id, element, xpath = element_data
            idx_to_xpath_map[str(i)] = xpath

        return minimal_html, idx_to_xpath_map

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

    def _identify_interactive_elements(self, dom_hashmap: Dict) -> None:
        """Identify interactive elements and assign highlight indices."""
        for elem_id, element in dom_hashmap.items():
            # Skip text nodes
            if self._is_text_node(element):
                continue

            # Skip non-visible elements
            if not self._get_attr(element, 'isVisible', False):
                continue

            # Only include truly interactive elements
            if self._get_attr(element, 'isInteractive', False):
                tag_name = self._get_attr(element, 'tagName', '').lower()

                # Store the element data with its XPath
                xpath = self._get_attr(element, 'xpath', '')
                self.interactive_elements.append((elem_id, element, xpath))

    def _get_element_text(self, element: Any, dom_hashmap: Dict) -> str:
        """Get direct text content for an element."""
        text = ""
        children = self._get_attr(element, 'children', [])

        for child_id in children:
            child_id_str = str(child_id) if isinstance(
                child_id, int) else child_id
            child = dom_hashmap.get(child_id_str) or dom_hashmap.get(child_id)

            if not child:
                continue

            if self._is_text_node(child) and self._get_attr(child, 'isVisible', False):
                child_text = self._get_attr(child, 'text', '').strip()
                if child_text:
                    text += child_text + " "

        return text.strip()

    def _get_element_description(self, element: Any, dom_hashmap: Dict) -> str:
        """Get a descriptive string for an element based on its attributes and text."""
        tag_name = self._get_attr(element, 'tagName', '').lower()
        attributes = self._get_attr(element, 'attributes', {})

        # Build a list of descriptive parts
        parts = []

        # Add tag name
        parts.append(tag_name)

        # Add important attributes
        for attr_name in ['id', 'name', 'placeholder', 'role', 'aria-label', 'title']:
            if attr_name in attributes and attributes[attr_name]:
                parts.append(f"{attr_name}=\"{attributes[attr_name]}\"")

        # Special cases for specific element types
        if tag_name == 'a' and 'href' in attributes:
            href = attributes['href']
            if len(href) > 30:  # Truncate very long URLs
                href = href[:27] + "..."
            parts.append(f"href=\"{href}\"")

        elif tag_name == 'input':
            if 'type' in attributes:
                parts.append(f"type=\"{attributes['type']}\"")
            if 'value' in attributes and attributes['value']:
                value = attributes['value']
                if len(value) > 20:  # Truncate long values
                    value = value[:17] + "..."
                parts.append(f"value=\"{value}\"")

        elif tag_name == 'button':
            if 'type' in attributes:
                parts.append(f"type=\"{attributes['type']}\"")

        # Add text content if available (with truncation if needed)
        text = self._get_element_text(element, dom_hashmap)
        if text:
            if len(text) > self.max_text_length:
                text = text[:self.max_text_length] + "..."
            parts.append(text)

        return " ".join(parts)

    def _generate_highlight_output(self) -> str:
        """Generate a compact representation with highlight indices."""
        if not self.interactive_elements:
            return "<html><body><p>No interactive elements found</p></body></html>"

        output = []
        output.append("Interactive elements:")

        # Sort elements by their tag type for better organization
        sorted_elements = sorted(
            self.interactive_elements,
            key=lambda x: self._get_attr(x[1], 'tagName', '').lower()
        )

        # Assign highlight indices and generate output
        for i, (elem_id, element, xpath) in enumerate(sorted_elements, 1):
            # Get a descriptive string for this element
            description = self._get_element_description(element, {})

            # Generate the highlight line
            output.append(f"[{i}] <{description}>")

        return "\n".join(output)


def generate_hybrid_minimal_dom_for_llm(dom_state):
    """Generate minimal DOM representation with highlight indices for LLM consumption."""
    mapper = HybridDOMMapper(max_text_length=50)

    minimal_html, idx_to_xpath_map = mapper.create_minimal_dom(
        dom_state.element_tree)
    return minimal_html, idx_to_xpath_map


def process_llm_response(response_json, idx_to_xpath_map):
    """Process the LLM response to map highlight indices back to full XPaths."""
    if not response_json or "actions" not in response_json:
        return response_json

    actions = response_json["actions"]

    for action in actions:
        # Look for index references in various field names
        element_idx = None
        for field_name in ["element", "index", "element_index", "idx"]:
            if field_name in action:
                # Extract index value, handling different formats
                idx_value = action[field_name]
                # If it's a string like "[3]" or "3", extract the number
                if isinstance(idx_value, str):
                    # Try to extract just the number from formats like "[3]"
                    if idx_value.startswith('[') and idx_value.endswith(']'):
                        idx_value = idx_value[1:-1]
                    # Convert to string if it's a valid number
                    if idx_value.isdigit():
                        element_idx = idx_value
                # If it's already a number, convert to string
                elif isinstance(idx_value, int):
                    element_idx = str(idx_value)

        # Map index to XPath if found
        if element_idx and element_idx in idx_to_xpath_map:
            action["xpath"] = idx_to_xpath_map[element_idx]

            # Clean up original field to avoid confusion
            for field_name in ["element", "index", "element_index", "idx"]:
                if field_name in action:
                    del action[field_name]

    return response_json
