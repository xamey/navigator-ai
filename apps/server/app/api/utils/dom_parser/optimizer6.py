import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("dom-token-reducer")


class PerfectedDOMMapper:
    """Creates compact DOM representation using XPath mapping with improvements to handle all edge cases."""

    def __init__(self,
                 max_text_length=50,
                 include_non_interactive=False):
        self.max_text_length = max_text_length
        self.include_non_interactive = include_non_interactive

        # Only keep these critical attributes
        self.critical_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href', 'role',
            'aria-label', 'title', 'checked', 'selected', 'disabled'
        ]

        # These attributes should never be truncated
        self.no_truncate_attributes = [
            'href', 'id', 'name', 'value'
        ]

        # Interactive elements to prioritize
        self.interactive_tags = {
            'a', 'button', 'input', 'select', 'textarea', 'label',
            'details', 'summary', 'option'
        }

        # XPath to ID mapping
        self.xpath_to_ref_map = {}
        self.next_ref = 1

    def create_minimal_dom(self, dom_hashmap: Dict) -> Tuple[str, Dict]:
        """
        Generate compact DOM representation with XPath mapping.

        Returns:
            Tuple of (minimal_html, xpath_map)
        """
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>", {}

        # Reset the mapping for each new DOM
        self.xpath_to_ref_map = {}
        self.next_ref = 1

        # Step 1: Identify important elements
        important_elements = self._identify_important_elements(dom_hashmap)

        # Step 2: Group elements by type
        grouped_elements = self._group_elements_by_type(
            important_elements, dom_hashmap)

        # Step 3: Generate lean HTML representation
        minimal_html = self._generate_minimal_html(
            grouped_elements, dom_hashmap)

        # Create reverse mapping (ref -> xpath) for easier lookup
        ref_to_xpath_map = {f"xpath{ref_num}": xpath for xpath,
                            ref_num in self.xpath_to_ref_map.items()}

        return minimal_html, ref_to_xpath_map

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

            # Include elements with filled values or selected states
            attributes = self._get_attr(element, 'attributes', {})
            if ('value' in attributes and attributes['value']) or \
               ('checked' in attributes and attributes['checked']) or \
               ('selected' in attributes and attributes['selected']):
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

    def _get_xpath_ref(self, xpath: str) -> str:
        """Get or create a short reference ID for an XPath."""
        if not xpath:
            return ""

        if xpath not in self.xpath_to_ref_map:
            self.xpath_to_ref_map[xpath] = self.next_ref
            self.next_ref += 1

        return f"xpath{self.xpath_to_ref_map[xpath]}"

    def _get_dropdown_state(self, element: Any, dom_hashmap: Dict) -> str:
        """Get the currently selected option text for a dropdown."""
        if self._get_attr(element, 'tagName', '').lower() != 'select':
            return ""

        # Check for selected option
        selected_text = ""
        children = self._get_attr(element, 'children', [])

        for child_id in children:
            child_id_str = str(child_id) if isinstance(
                child_id, int) else child_id
            child = dom_hashmap.get(child_id_str) or dom_hashmap.get(child_id)

            if not child:
                continue

            # If it's an option and is selected
            if self._get_attr(child, 'tagName', '').lower() == 'option':
                attributes = self._get_attr(child, 'attributes', {})
                if 'selected' in attributes and attributes['selected']:
                    # Get option text
                    option_text = self._get_element_text(child, dom_hashmap)
                    if option_text:
                        selected_text = option_text
                        break

        return selected_text

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

                        # Only truncate attributes not in the no-truncate list
                        if attr_name not in self.no_truncate_attributes and isinstance(attr_value, str) and len(attr_value) > 50:
                            attr_value = attr_value[:50] + "..."

                        element_output += f" {attr_name}=\"{attr_value}\""

                # Add mapped XPath reference instead of full XPath
                xpath = self._get_attr(element, 'xpath', '')
                xpath_ref = self._get_xpath_ref(xpath)
                if xpath_ref:
                    element_output += f" data-xref=\"{xpath_ref}\""

                # Generate CSS selector
                selector = self._generate_css_selector(element, dom_hashmap)
                if selector:
                    element_output += f" data-selector=\"{selector}\""

                element_output += ">"

                # For select elements, show the selected option
                if tag_name == 'select':
                    selected_text = self._get_dropdown_state(
                        element, dom_hashmap)
                    if selected_text:
                        element_output += selected_text
                # For inputs with value, show placeholder text instead of just truncated value
                elif tag_name == 'input' and 'value' in attributes and attributes['value']:
                    if 'placeholder' in attributes and attributes['placeholder']:
                        element_output += f"[{attributes['placeholder']}]"
                    else:
                        # Use actual value if no placeholder
                        value = attributes['value']
                        if len(value) > self.max_text_length:
                            value = value[:self.max_text_length] + "..."
                        element_output += f"[{value}]"
                # Add text content for interactive elements (truncated)
                elif self._get_attr(element, 'isInteractive', False) or tag_name in self.interactive_tags:
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


def generate_perfected_minimal_dom_for_llm(dom_state):
    """Generate minimal DOM representation with XPath mapping for LLM consumption."""
    mapper = PerfectedDOMMapper(
        max_text_length=50,  # Increase text length to avoid cutting links
        include_non_interactive=False  # Focus only on interactive elements
    )

    minimal_html, xpath_map = mapper.create_minimal_dom(dom_state.element_tree)
    return minimal_html, xpath_map


def process_llm_response(response_json, xpath_map):
    """Process the LLM response to map xpath references back to full XPaths."""
    if not response_json or "actions" not in response_json:
        return response_json

    actions = response_json["actions"]

    for action in actions:
        # Check for xpath reference
        xpath_ref = action.get("element_ref") or action.get("xpath_ref")

        # Also check if they incorrectly used element_id
        if not xpath_ref and "element_id" in action:
            xpath_ref = action["element_id"]

        # Map reference to full XPath if it exists
        if xpath_ref and xpath_ref in xpath_map:
            action["xpath"] = xpath_map[xpath_ref]

            # Remove the reference field to avoid confusion
            if "element_ref" in action:
                del action["element_ref"]
            if "xpath_ref" in action:
                del action["xpath_ref"]
            if "element_id" in action:
                del action["element_id"]

    return response_json
