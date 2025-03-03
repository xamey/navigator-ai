import logging
from typing import Any, Dict, List, Optional, Set, Union

logger = logging.getLogger("dom-token-reducer")


class DOMTokenReducer:
    """Creates compact DOM representation for minimal token usage while preserving all interactive elements."""

    def __init__(self,
                 max_text_length=30,
                 include_non_interactive=False):
        self.max_text_length = max_text_length
        self.include_non_interactive = include_non_interactive

        # Only keep these critical attributes
        self.critical_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'role',
            'aria-label', 'title', 'checked', 'selected', 'disabled'
        ]

        # Interactive elements to prioritize
        self.interactive_tags = {
            'a', 'button', 'input', 'select', 'textarea', 'label',
            'details', 'summary', 'option'
        }

    def create_minimal_dom(self, dom_hashmap: Dict) -> str:
        """Generate compact DOM representation."""
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>"

        # Step 1: Identify important elements
        important_elements = self._identify_important_elements(dom_hashmap)

        # Step 2: Group elements by type
        grouped_elements = self._group_elements_by_type(
            important_elements, dom_hashmap)

        # Step 3: Generate lean HTML representation
        minimal_html = self._generate_minimal_html(
            grouped_elements, dom_hashmap)

        return minimal_html

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

    def _identify_important_elements(self, dom_hashmap: Dict) -> List[str]:
        """Identify important elements that should be included."""
        important_elements = []

        for elem_id, element in dom_hashmap.items():
            # Skip text nodes
            if self._is_text_node(element):
                continue

            # Skip non-visible elements
            if not self._get_attr(element, 'isVisible', False):
                continue

            # Include interactive elements
            if self._get_attr(element, 'isInteractive', False):
                important_elements.append(elem_id)
                continue

            # Include elements with specific interactive tags
            tag_name = self._get_attr(element, 'tagName', '').lower()
            if tag_name in self.interactive_tags:
                important_elements.append(elem_id)
                continue

            # Include non-interactive elements with useful text if specified
            if self.include_non_interactive:
                # Check for meaningful text content
                text = self._get_element_text(element, dom_hashmap)
                if text and len(text.strip()) > 3:
                    important_elements.append(elem_id)

        return important_elements

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

    def _group_elements_by_type(self, element_ids: List[str], dom_hashmap: Dict) -> Dict:
        """Group elements by type while preserving all elements."""
        grouped = {}

        # Group by element tag
        for elem_id in element_ids:
            element = dom_hashmap.get(elem_id)
            if not element:
                continue

            tag_name = self._get_attr(element, 'tagName', '').lower()

            # Create category key based on tag
            if tag_name not in grouped:
                grouped[tag_name] = []

            grouped[tag_name].append(elem_id)

        return grouped

    def _generate_css_selector(self, element: Any, dom_hashmap: Dict) -> str:
        """Generate an efficient CSS selector for an element."""
        tag_name = self._get_attr(element, 'tagName', 'div').lower()
        attributes = self._get_attr(element, 'attributes', {})

        # ID is the most efficient selector
        if 'id' in attributes and attributes['id']:
            return f"#{attributes['id']}"

        # Next best is a specific attribute
        for attr in ['data-testid', 'data-cy', 'data-qa', 'data-test']:
            if attr in attributes and attributes[attr]:
                return f"[{attr}='{attributes[attr]}']"

        # For form elements, use name or type
        if tag_name in ['input', 'button', 'select', 'textarea']:
            if 'name' in attributes and attributes['name']:
                return f"{tag_name}[name='{attributes['name']}']"
            elif 'type' in attributes and attributes['type']:
                return f"{tag_name}[type='{attributes['type']}']"

        # For links, use href
        if tag_name == 'a' and 'href' in attributes and attributes['href']:
            # Simplify the href if it's a full URL
            href = attributes['href']
            if href.startswith('http'):
                # Extract just the path
                parts = href.split('/', 3)
                if len(parts) > 3:
                    href = '/' + parts[3]
            return f"a[href='{href}']"

        # For labels use for attribute
        if tag_name == 'label' and 'for' in attributes and attributes['for']:
            return f"label[for='{attributes['for']}']"

        # For aria elements use aria-label
        if 'aria-label' in attributes and attributes['aria-label']:
            return f"{tag_name}[aria-label='{attributes['aria-label']}']"

        # Fallback to tag name
        return tag_name

    def _generate_minimal_html(self, grouped_elements: Dict, dom_hashmap: Dict) -> str:
        """Generate minimal HTML representation from grouped elements."""
        output = []
        output.append("<html>")
        output.append("<body>")

        # Process elements by type for better organization
        for tag_name, elem_ids in sorted(grouped_elements.items()):
            # Skip groups with no elements
            if not elem_ids:
                continue

            # Create category section with proper title case
            section_title = tag_name.title()
            output.append(f"<section data-type=\"{section_title}s\">")

            # Process each element in this group
            for elem_id in elem_ids:
                element = dom_hashmap.get(elem_id)
                if not element:
                    continue

                # Start tag
                element_output = f"<{tag_name}"

                # Add essential attributes
                attributes = self._get_attr(element, 'attributes', {})
                for attr_name in self.critical_attributes:
                    if attr_name in attributes and attributes[attr_name]:
                        attr_value = attributes[attr_name]
                        # Truncate very long values
                        if isinstance(attr_value, str) and len(attr_value) > 50:
                            attr_value = attr_value[:50] + "..."
                        element_output += f" {attr_name}=\"{attr_value}\""

                # Add full xpath
                xpath = self._get_attr(element, 'xpath', '')
                if xpath:
                    element_output += f" data-xpath=\"{xpath}\""

                # Generate CSS selector
                selector = self._generate_css_selector(element, dom_hashmap)
                if selector:
                    element_output += f" data-selector=\"{selector}\""

                element_output += ">"

                # Add text content for interactive elements (truncated)
                if self._get_attr(element, 'isInteractive', False) or tag_name in self.interactive_tags:
                    text = self._get_element_text(element, dom_hashmap)
                    if text:
                        if len(text) > self.max_text_length:
                            text = text[:self.max_text_length] + "..."
                        element_output += text

                # Close tag
                element_output += f"</{tag_name}>"

                output.append(element_output)

            output.append(f"</section>")

        output.append("</body>")
        output.append("</html>")

        return "\n".join(output)


def generate_mid_minimal_dom_for_llm(dom_state):
    """Generate minimal DOM representation for LLM consumption."""
    reducer = DOMTokenReducer(
        max_text_length=30,  # Allow enough text for identification
        include_non_interactive=False  # Focus only on interactive elements
    )

    minimal_html = reducer.create_minimal_dom(dom_state.element_tree)
    return minimal_html
