import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("dom-mapper")


class BalancedDOMMapper:
    """Creates DOM representation that balances accuracy and token efficiency."""

    def __init__(self, include_text_nodes=True):
        self.include_text_nodes = include_text_nodes

        # Never truncate any attributes
        self.critical_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'src', 'role',
            'aria-label', 'title', 'checked', 'selected', 'for', 'alt'
        ]

        # XPath to ID mapping for internal use
        self.xpath_to_ref_map = {}
        self.next_ref = 1

        # Track interactive elements for highlight indices
        self.interactive_elements = []

        # Track important text nodes
        self.text_nodes = []

    def create_minimal_dom(self, dom_hashmap: Dict) -> Tuple[str, Dict]:
        """
        Generate DOM representation that balances accuracy and token efficiency.

        Returns:
            Tuple of (output_text, xpath_map)
        """
        if not dom_hashmap:
            return "No DOM content available", {}

        # Reset mappings
        self.xpath_to_ref_map = {}
        self.next_ref = 1
        self.interactive_elements = []
        self.text_nodes = []

        # Step 1: Identify interactive elements and important text
        self._process_dom_tree(dom_hashmap)

        # Step 2: Generate balanced output
        output_text = self._generate_balanced_output()

        # Create reverse mapping (ref -> xpath) for easier lookup
        idx_to_xpath_map = {}
        for i, element_data in enumerate(self.interactive_elements, 1):
            element_id, element, xpath = element_data
            idx_to_xpath_map[str(i)] = xpath

        return output_text, idx_to_xpath_map

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

    def _process_dom_tree(self, dom_hashmap: Dict) -> None:
        """Identify interactive elements and important text nodes."""
        # First, identify all interactive elements
        for elem_id, element in dom_hashmap.items():
            # Skip text nodes for interactive element collection
            if self._is_text_node(element):
                # If it's a text node, check if it's visible and has content
                if self.include_text_nodes and self._get_attr(element, 'isVisible', False):
                    text = self._get_attr(element, 'text', '').strip()
                    if text:
                        self.text_nodes.append((elem_id, element, text))
                continue

            # Skip non-visible elements
            if not self._get_attr(element, 'isVisible', False):
                continue

            # Include interactive elements
            if self._get_attr(element, 'isInteractive', False):
                tag_name = self._get_attr(element, 'tagName', '').lower()

                # Store the element data with its XPath
                xpath = self._get_attr(element, 'xpath', '')
                self.interactive_elements.append((elem_id, element, xpath))
                continue

            # Include form-related elements even if not marked interactive
            tag_name = self._get_attr(element, 'tagName', '').lower()
            if tag_name in ['select', 'option', 'input', 'textarea', 'button', 'a']:
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
        """Get a comprehensive description of an element with all its attributes."""
        tag_name = self._get_attr(element, 'tagName', '').lower()
        attributes = self._get_attr(element, 'attributes', {})

        # Build a list of descriptive parts
        parts = []

        # Add tag name
        parts.append(tag_name)

        # Add ALL important attributes without truncation
        for attr_name in self.critical_attributes:
            if attr_name in attributes and attributes[attr_name]:
                parts.append(f"{attr_name}=\"{attributes[attr_name]}\"")

        # Special handling for specific element types to show state
        if tag_name == 'input':
            input_type = attributes.get('type', 'text')

            # For checkbox/radio, show checked state
            if input_type in ['checkbox', 'radio']:
                if 'checked' in attributes and attributes['checked']:
                    parts.append("CHECKED")
                else:
                    parts.append("UNCHECKED")

            # For text-like inputs, show current value
            elif input_type in ['text', 'email', 'password', 'search', 'tel', 'url']:
                if 'value' in attributes and attributes['value']:
                    parts.append(f"VALUE=\"{attributes['value']}\"")
                elif 'placeholder' in attributes:
                    parts.append(
                        f"placeholder=\"{attributes['placeholder']}\"")

        elif tag_name == 'textarea':
            # Show textarea content
            if 'value' in attributes and attributes['value']:
                parts.append(f"VALUE=\"{attributes['value']}\"")

        elif tag_name == 'select':
            # Try to find the selected option text
            selected_text = self._find_selected_option(element, dom_hashmap)
            if selected_text:
                parts.append(f"SELECTED=\"{selected_text}\"")

        # Add text content if available
        text = self._get_element_text(element, dom_hashmap)
        if text:
            parts.append(f"TEXT=\"{text}\"")

        return " ".join(parts)

    def _find_selected_option(self, select_element: Any, dom_hashmap: Dict) -> str:
        """Find the selected option text in a select element."""
        children = self._get_attr(select_element, 'children', [])

        for child_id in children:
            child_id_str = str(child_id) if isinstance(
                child_id, int) else child_id
            child = dom_hashmap.get(child_id_str) or dom_hashmap.get(child_id)

            if not child:
                continue

            # Skip text nodes
            if self._is_text_node(child):
                continue

            # Check if this is an option element
            tag_name = self._get_attr(child, 'tagName', '').lower()
            if tag_name == 'option':
                # Check if it's selected
                attributes = self._get_attr(child, 'attributes', {})
                if 'selected' in attributes and attributes['selected']:
                    # Return the option text
                    return self._get_element_text(child, dom_hashmap)

            # Look in option groups
            if tag_name == 'optgroup':
                # Recursively check option groups
                option_text = self._find_selected_option(child, dom_hashmap)
                if option_text:
                    return option_text

        return ""

    def _generate_balanced_output(self) -> str:
        """Generate a balanced representation with interactive elements and text context."""
        output = []

        # Add interactive elements section
        if self.interactive_elements:
            output.append("== INTERACTIVE ELEMENTS ==")

            # Sort elements by their tag type for better organization
            sorted_elements = sorted(
                self.interactive_elements,
                key=lambda x: self._get_attr(x[1], 'tagName', '').lower()
            )

            # Group elements by tag type
            grouped_elements = {}
            for elem_data in sorted_elements:
                elem_id, element, xpath = elem_data
                tag_name = self._get_attr(element, 'tagName', '').lower()

                if tag_name not in grouped_elements:
                    grouped_elements[tag_name] = []

                grouped_elements[tag_name].append(elem_data)

            # Process each group
            current_index = 1
            for tag_name, elements in grouped_elements.items():
                output.append(f"\n--- {tag_name.upper()}S ---")

                for elem_id, element, xpath in elements:
                    # Get a descriptive string for this element
                    description = self._get_element_description(element, {})

                    # Generate the highlight line
                    output.append(f"[{current_index}] {description}")
                    current_index += 1

        # Add important text nodes if configured
        if self.include_text_nodes and self.text_nodes:
            output.append("\n== VISIBLE TEXT ==")

            for _, _, text in self.text_nodes:
                # Only include substantial text (not just short labels)
                if len(text) > 5:
                    output.append(text)

        return "\n".join(output)


def generate_balanced_minimal_dom_for_llm(dom_state):
    """Generate balanced DOM representation for LLM consumption."""
    mapper = BalancedDOMMapper(include_text_nodes=True)

    output_text, idx_to_xpath_map = mapper.create_minimal_dom(
        dom_state.element_tree)
    return output_text, idx_to_xpath_map


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
