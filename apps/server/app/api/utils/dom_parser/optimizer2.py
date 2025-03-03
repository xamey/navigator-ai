import logging
import re
from typing import Any, Dict, List, Optional, Set, Union

from bs4 import BeautifulSoup, Tag

logger = logging.getLogger("dom-html-reducer")


class ImprovedDOMHTMLReducer:
    """Converts complex DOM structures into simplified HTML that preserves relationships and important attributes."""

    def __init__(self,
                 max_text_length=80,
                 max_depth=20,
                 include_non_interactive=False):
        self.max_text_length = max_text_length
        self.max_depth = max_depth
        self.include_non_interactive = include_non_interactive

        # Attributes to keep (extended list)
        self.important_attributes = [
            'id', 'name', 'class', 'type', 'value', 'placeholder', 'href', 'src',
            'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded',
            'role', 'title', 'alt', 'for', 'checked', 'selected', 'disabled',
            'data-testid', 'data-cy', 'data-qa', 'data-test', 'data-id', 'data-automation'
        ]

        # Interactive element tags and attributes to always include
        self.interactive_tags = {
            'a', 'button', 'input', 'select', 'textarea', 'label',
            'summary', 'details', 'option'
        }

        self.interactive_attrs = {
            'onclick', 'onchange', 'onsubmit', 'contenteditable'
        }

        self.interactive_roles = {
            'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem',
            'combobox', 'searchbox', 'switch'
        }

    def generate_simplified_html(self, dom_hashmap: Dict) -> str:
        """
        Generate a simplified HTML structure from the DOM hashmap.

        Args:
            dom_hashmap: The DOM hashmap from the parser

        Returns:
            A simplified HTML string
        """
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>"

        logger.info(
            f"Generating simplified HTML from {len(dom_hashmap)} elements")

        # Step 1: Identify important/interactive elements
        important_elements = self._identify_important_elements(dom_hashmap)
        logger.info(f"Found {len(important_elements)} important elements")

        if len(important_elements) == 0:
            logger.warning(
                "No important elements found, including all visible elements")
            # If no important elements found, include all visible elements
            for elem_id, element in dom_hashmap.items():
                is_text = self._is_text_node(element)
                if not is_text and self._get_attr(element, 'isVisible'):
                    important_elements.add(elem_id)

        # Step 2: Build a path to root for each important element
        paths_to_keep = self._build_paths_to_root(
            dom_hashmap, important_elements)
        logger.info(f"Built paths including {len(paths_to_keep)} elements")

        # Step 3: Create a simplified HTML structure
        simplified_html = self._create_simplified_html(
            dom_hashmap, paths_to_keep, important_elements)

        return simplified_html

    def _is_text_node(self, element: Any) -> bool:
        """Helper to check if an element is a text node."""
        if hasattr(element, 'type'):
            return element.type == 'TEXT_NODE'
        elif isinstance(element, dict):
            return element.get('type') == 'TEXT_NODE'
        return False

    def _get_attr(self, element: Any, attr_name: str, default=None):
        """Helper to get attribute from element regardless of its type."""
        if hasattr(element, attr_name):
            return getattr(element, attr_name)
        elif isinstance(element, dict):
            return element.get(attr_name, default)
        return default

    def _identify_important_elements(self, dom_hashmap: Dict) -> Set[str]:
        """Identify important elements that should be included."""
        important_elements = set()

        for elem_id, element in dom_hashmap.items():
            # Skip text nodes
            if self._is_text_node(element):
                continue

            # Include elements that are both interactive and visible
            if self._is_element_interactive(element) and self._get_attr(element, 'isVisible', False):
                important_elements.add(elem_id)

                # Also include direct children of forms that are visible
                if self._get_attr(element, 'tagName', '').lower() == 'form':
                    children = self._get_attr(element, 'children', [])
                    for child_id in children:
                        child = dom_hashmap.get(
                            str(child_id)) or dom_hashmap.get(child_id)
                        if child and self._get_attr(child, 'isVisible', False):
                            important_elements.add(
                                str(child_id) if isinstance(child_id, int) else child_id)

            # Include visible headers and navigation elements
            elif self._get_attr(element, 'isVisible', False) and self._get_attr(element, 'tagName', '').lower() in ['h1', 'h2', 'h3', 'nav']:
                important_elements.add(elem_id)

            # Include non-interactive elements if specified
            elif self.include_non_interactive and self._get_attr(element, 'isVisible', False):
                # Check if it has meaningful content
                has_content = False

                # Look for text nodes in children
                children = self._get_attr(element, 'children', [])
                for child_id in children:
                    child_id_str = str(child_id) if isinstance(
                        child_id, int) else child_id
                    child = dom_hashmap.get(
                        child_id_str) or dom_hashmap.get(child_id)
                    if child and self._is_text_node(child) and self._get_attr(child, 'isVisible', False):
                        text = self._get_attr(child, 'text', '').strip()
                        if len(text) > 3:  # Only count if text has substance
                            has_content = True
                            break

                # Add if it has content
                if has_content:
                    important_elements.add(elem_id)

        logger.info(f"Identified {len(important_elements)} important elements")
        return important_elements

    def _is_element_interactive(self, element: Any) -> bool:
        """Check if an element is interactive based on tags and attributes."""
        if not element:
            return False

        # Check explicit interactive flag
        if self._get_attr(element, 'isInteractive', False):
            return True

        # Check tag name
        tag_name = self._get_attr(element, 'tagName', '').lower()
        if tag_name in self.interactive_tags:
            return True

        # Check attributes
        attributes = self._get_attr(element, 'attributes', {})

        # Check for interactive attributes
        for attr in self.interactive_attrs:
            if attr in attributes:
                return True

        # Check for role attribute
        role = attributes.get('role', '').lower()
        if role in self.interactive_roles:
            return True

        # Check for tabindex
        if 'tabindex' in attributes and attributes['tabindex'] != '-1':
            return True

        return False

    def _build_paths_to_root(self, dom_hashmap: Dict, important_elements: Set[str]) -> Set[str]:
        """Build paths from important elements to the root."""
        all_paths = set(important_elements)
        parent_map = {}

        # Build a parent map for faster lookups
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                parent_map[child_id_str] = elem_id

        # For each important element, add its ancestors to the path
        for elem_id in list(important_elements):
            current_id = elem_id
            depth = 0

            while depth < self.max_depth:
                parent_id = parent_map.get(current_id)
                if not parent_id:
                    break

                all_paths.add(parent_id)
                current_id = parent_id
                depth += 1

        logger.info(f"Built paths including {len(all_paths)} elements")
        return all_paths

    def _generate_css_selector(self, element: Any, dom_hashmap: Dict, element_id: str) -> str:
        """Generate a CSS selector for an element."""
        # Start with the tag
        tag_name = self._get_attr(element, 'tagName', 'div').lower()
        selector = tag_name

        # Add ID if available (most specific)
        attributes = self._get_attr(element, 'attributes', {})
        if 'id' in attributes and attributes['id']:
            return f"#{attributes['id']}"

        # Check for useful attributes
        for attr in ['data-testid', 'data-cy', 'data-qa', 'data-test', 'data-id', 'data-automation']:
            if attr in attributes and attributes[attr]:
                return f"[{attr}='{attributes[attr]}']"

        # Use classes but be selective
        if 'class' in attributes and attributes['class']:
            classes = attributes['class'].split()
            if classes:
                # Find the most specific class (avoid common ones like 'container', 'wrapper', etc.)
                common_classes = {'container', 'wrapper',
                                  'row', 'col', 'section', 'content', 'box'}
                specific_classes = [
                    cls for cls in classes if cls not in common_classes]

                if specific_classes:
                    # Use the first specific class
                    selector += f".{specific_classes[0]}"
                elif len(classes) > 0:
                    # If no specific classes, use the first class
                    selector += f".{classes[0]}"

        # Add specific attribute that helps identify the element
        for attr_name, attr_value in attributes.items():
            if attr_name in ['type', 'name', 'placeholder', 'role'] and attr_value:
                selector += f"[{attr_name}='{attr_value}']"
                break

        # Check if the element has a parent in the parent map
        parent_id = None
        for pid, p_element in dom_hashmap.items():
            if self._is_text_node(p_element):
                continue

            children = self._get_attr(p_element, 'children', [])
            child_ids = [str(c) if isinstance(c, int) else c for c in children]

            if element_id in child_ids:
                parent_id = pid
                break

        # If we have a parent, add a simplified parent selector
        if parent_id:
            parent = dom_hashmap.get(parent_id)
            if parent:
                parent_tag = self._get_attr(parent, 'tagName', 'div').lower()
                parent_attrs = self._get_attr(parent, 'attributes', {})

                # Try to add a parent ID if it has one
                if 'id' in parent_attrs and parent_attrs['id']:
                    return f"#{parent_attrs['id']} {selector}"

                # Otherwise use parent tag
                return f"{parent_tag} {selector}"

        return selector

    def _find_body_or_root(self, dom_hashmap: Dict) -> Optional[str]:
        """Find the body element or the root element of the DOM."""
        # First look for the body tag
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            if self._get_attr(element, 'tagName', '').lower() == 'body':
                return elem_id

        # If body not found, look for an element with no parent
        parent_map = {}
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                parent_map[child_id_str] = elem_id

        # Find elements that have no parents
        root_candidates = []
        for elem_id, element in dom_hashmap.items():
            if self._is_text_node(element):
                continue

            if elem_id not in parent_map:
                root_candidates.append(elem_id)

        # Choose the root with the most descendants
        if root_candidates:
            max_children = 0
            best_root = root_candidates[0]

            for root_id in root_candidates:
                element = dom_hashmap.get(root_id)
                children_count = len(self._get_attr(element, 'children', []))
                if children_count > max_children:
                    max_children = children_count
                    best_root = root_id

            return best_root

        # If no clear root found, return the element with the lowest ID as fallback
        elem_ids = [eid for eid, e in dom_hashmap.items()
                    if not self._is_text_node(e)]
        if elem_ids:
            try:
                # Try sorting by numeric value
                return min(elem_ids, key=lambda x: int(x) if x.isdigit() else float('inf'))
            except:
                # Fall back to string sorting
                return min(elem_ids)

        return None

    def _create_simplified_html(self, dom_hashmap: Dict, elements_to_keep: Set[str], important_elements: Set[str]) -> str:
        """Create a simplified HTML structure using only the required elements."""
        # Create a mapping of element IDs to simplified elements
        simplified_elements = {}

        # Find the body or root element
        root_id = self._find_body_or_root(dom_hashmap)
        logger.info(f"Identified root element: {root_id}")

        # First, create simplified representations for all elements to keep
        for elem_id in elements_to_keep:
            element = dom_hashmap.get(elem_id)
            if not element or self._is_text_node(element):
                continue

            # Create a simplified element
            simplified_element = {
                'id': elem_id,
                'tag': self._get_attr(element, 'tagName', 'div').lower(),
                'children': [],
                'text': '',
                'attrs': {}
            }

            # Add selected attributes
            attributes = self._get_attr(element, 'attributes', {})
            for attr_name, attr_value in attributes.items():
                if attr_name in self.important_attributes:
                    # Truncate very long attribute values
                    if isinstance(attr_value, str) and len(attr_value) > 100:
                        attr_value = attr_value[:100] + "..."
                    simplified_element['attrs'][attr_name] = attr_value

            # Generate CSS selector
            css_selector = self._generate_css_selector(
                element, dom_hashmap, elem_id)
            simplified_element['attrs']['data-selector'] = css_selector

            # Add xpath
            simplified_element['attrs']['data-xpath'] = self._get_attr(
                element, 'xpath', '')

            # Get text content from children
            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                child = dom_hashmap.get(
                    child_id_str) or dom_hashmap.get(child_id)
                if child and self._is_text_node(child) and self._get_attr(child, 'isVisible', False):
                    text = self._get_attr(child, 'text', '').strip()
                    if text:
                        # Truncate if too long
                        if len(text) > self.max_text_length:
                            text = text[:self.max_text_length] + "..."
                        simplified_element['text'] += text + ' '

            simplified_element['text'] = simplified_element['text'].strip()

            # Save in our mapping
            simplified_elements[elem_id] = simplified_element

        # Now create parent-child relationships
        for elem_id, simplified_element in simplified_elements.items():
            element = dom_hashmap.get(elem_id)
            if not element:
                continue

            children = self._get_attr(element, 'children', [])
            for child_id in children:
                child_id_str = str(child_id) if isinstance(
                    child_id, int) else child_id
                if child_id_str in simplified_elements:
                    simplified_element['children'].append(child_id_str)
                elif child_id in simplified_elements:
                    simplified_element['children'].append(child_id)

        # Build the HTML recursively starting from the root
        def build_html(elem_id, depth=0):
            if elem_id not in simplified_elements:
                return ""

            element = simplified_elements[elem_id]
            indent = "  " * depth

            # Open tag
            html = f"{indent}<{element['tag']}"

            # Add attributes
            for attr_name, attr_value in element['attrs'].items():
                # Handle boolean attributes
                if attr_value in [True, 'true', '']:
                    html += f" {attr_name}"
                else:
                    html += f" {attr_name}=\"{attr_value}\""

            # Add class to highlight interactive elements
            if elem_id in important_elements:
                class_attr = element['attrs'].get('class', '')
                if class_attr:
                    html += f" class=\"{class_attr} interactive-element\""
                else:
                    html += " class=\"interactive-element\""

            html += ">"

            # Add text content
            if element['text']:
                html += element['text']

            # Add children
            if element['children']:
                html += "\n"
                for child_id in element['children']:
                    html += build_html(child_id, depth + 1)
                html += indent

            # Close tag
            html += f"</{element['tag']}>\n"

            return html

        # If root found, build from there
        if root_id and root_id in simplified_elements:
            html_content = build_html(root_id)
            return f"<html>\n<head>\n  <title>Simplified DOM</title>\n</head>\n{html_content}</html>"

        # If root not in simplified elements, try to build a structure
        if root_id and root_id not in simplified_elements:
            logger.warning(
                f"Root element {root_id} not in simplified elements. Building from any element.")

        # Find elements with no parents in our simplified structure
        parent_map = {}
        for elem_id, element in simplified_elements.items():
            for child_id in element['children']:
                parent_map[child_id] = elem_id

        top_level_elements = []
        for elem_id in simplified_elements:
            if elem_id not in parent_map:
                top_level_elements.append(elem_id)

        # Build HTML from each top-level element
        if top_level_elements:
            all_html_parts = []
            for elem_id in top_level_elements:
                all_html_parts.append(build_html(elem_id))

            all_content = "".join(all_html_parts)
            return f"<html>\n<head>\n  <title>Simplified DOM</title>\n</head>\n<body>\n{all_content}</body>\n</html>"

        # Last resort: build from any element
        if simplified_elements:
            any_id = next(iter(simplified_elements.keys()))
            html_content = build_html(any_id)
            return f"<html>\n<head>\n  <title>Simplified DOM</title>\n</head>\n{html_content}</html>"

        return "<html><body><p>Could not determine structure of DOM elements</p></body></html>"

    def create_minihtml_from_dom(self, dom_hashmap: Dict) -> str:
        """Create a miniaturized HTML version that preserves only essential elements and attributes."""
        return self.generate_simplified_html(dom_hashmap)


# Function to be used in the main application
def generate_minihtml_for_llm(dom_state):
    """Generate minimal HTML from DOM state for LLM consumption."""
    reducer = ImprovedDOMHTMLReducer(
        max_text_length=80,
        include_non_interactive=True  # Include non-interactive elements with meaningful text
    )

    mini_html = reducer.create_minihtml_from_dom(dom_state.element_tree)
    return mini_html
