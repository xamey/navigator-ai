import logging
from typing import Any, Dict, List, Optional, Set, Union

from app.models.dom import DOMState

logger = logging.getLogger("dom-token-reducer")


class ExtremeTokenReducer:
    """Creates ultra-compact DOM representation for minimal token usage."""

    def __init__(self,
                 max_elements=150,
                 max_text_length=20,
                 max_depth=5):
        self.max_elements = max_elements
        self.max_text_length = max_text_length
        self.max_depth = max_depth

        # Only keep these critical attributes
        self.critical_attributes = [
            'id', 'name', 'type', 'value', 'placeholder', 'href'
        ]

        # Interactive elements to prioritize
        self.interactive_tags = {
            'a', 'button', 'input', 'select', 'textarea'
        }

    def create_minimal_dom(self, dom_hashmap: Dict) -> str:
        """Generate extremely compact DOM representation."""
        if not dom_hashmap:
            return "<html><body><p>Empty DOM</p></body></html>"

        # Step 1: Score and select only the most important elements
        scored_elements = self._score_elements(dom_hashmap)
        top_elements = self._select_top_elements(scored_elements, dom_hashmap)

        # Step 2: Group similar elements to save tokens
        grouped_elements = self._group_similar_elements(
            top_elements, dom_hashmap)

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

    def _score_elements(self, dom_hashmap: Dict) -> List[tuple]:
        """Score elements by importance for interaction."""
        scored_elements = []

        for elem_id, element in dom_hashmap.items():
            # Skip text nodes
            if self._is_text_node(element):
                continue

            # Skip non-visible elements immediately
            if not self._get_attr(element, 'isVisible', False):
                continue

            score = 0
            tag_name = self._get_attr(element, 'tagName', '').lower()
            attributes = self._get_attr(element, 'attributes', {})

            # Highest priority: interactive elements
            if self._get_attr(element, 'isInteractive', False):
                score += 100

            # Boost for specific interactive tags
            if tag_name in self.interactive_tags:
                score += 50

            # Boost for elements with user input
            if tag_name == 'input' or tag_name == 'textarea':
                score += 30

            # Boost for elements with click handlers
            if tag_name == 'button' or tag_name == 'a':
                score += 25

            # Boost for elements with important attributes
            if 'id' in attributes:
                score += 15
            if 'name' in attributes:
                score += 10
            if 'placeholder' in attributes:
                score += 5

            # Buttons and links with text are more important
            if (tag_name == 'button' or tag_name == 'a') and self._get_element_text(element, dom_hashmap):
                score += 20

            # Lower priority for container elements
            if tag_name in ['div', 'span', 'section', 'article']:
                score -= 10

            # Only add elements with positive scores
            if score > 0:
                scored_elements.append((elem_id, score))

        # Sort by score (highest first)
        return sorted(scored_elements, key=lambda x: x[1], reverse=True)

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

    def _select_top_elements(self, scored_elements: List[tuple], dom_hashmap: Dict) -> List[str]:
        """Select top N elements, ensuring essential ones are included."""
        # Take top elements based on score
        top_elements = [elem_id for elem_id,
                        _ in scored_elements[:self.max_elements]]

        # Ensure we have forms and inputs
        has_form = any(self._get_attr(dom_hashmap.get(
            elem_id), 'tagName', '').lower() == 'form' for elem_id in top_elements)

        if not has_form:
            # Look for forms
            for elem_id, element in dom_hashmap.items():
                if self._is_text_node(element):
                    continue

                if self._get_attr(element, 'tagName', '').lower() == 'form' and self._get_attr(element, 'isVisible', False):
                    top_elements.append(elem_id)
                    break

        return top_elements

    def _group_similar_elements(self, element_ids: List[str], dom_hashmap: Dict) -> Dict:
        """Group similar elements to reduce token usage."""
        grouped = {}

        # Group by element tag
        for elem_id in element_ids:
            element = dom_hashmap.get(elem_id)
            if not element:
                continue

            tag_name = self._get_attr(element, 'tagName', '').lower()

            # Create category key
            if self._get_attr(element, 'isInteractive', False):
                key = f"interactive_{tag_name}"
            else:
                key = f"other_{tag_name}"

            if key not in grouped:
                grouped[key] = []

            grouped[key].append(elem_id)

        # Further group similar navigation links if there are too many
        if 'interactive_a' in grouped and len(grouped['interactive_a']) > 10:
            similar_groups = self._identify_similar_links(
                grouped['interactive_a'], dom_hashmap)

            # Replace original links with grouped ones
            if similar_groups:
                grouped['interactive_a'] = similar_groups

        return grouped

    def _identify_similar_links(self, link_ids: List[str], dom_hashmap: Dict) -> List[str]:
        """Identify and group similar navigation links."""
        # Check for links with similar patterns or same parent
        parent_groups = {}

        # Group by parent
        for link_id in link_ids:
            # Find parent
            parent_id = None
            for pid, element in dom_hashmap.items():
                if self._is_text_node(element):
                    continue

                children = self._get_attr(element, 'children', [])
                child_ids = [str(cid) if isinstance(cid, int)
                             else cid for cid in children]

                if link_id in child_ids:
                    parent_id = pid
                    break

            if parent_id:
                if parent_id not in parent_groups:
                    parent_groups[parent_id] = []
                parent_groups[parent_id].append(link_id)

        # If more than 3 links have the same parent, keep only a few representatives
        result_links = []

        for parent_id, links in parent_groups.items():
            if len(links) > 3:
                # Just keep first, middle, and last as representatives
                representatives = [links[0], links[len(links)//2], links[-1]]
                result_links.extend(representatives)

                # Add a summary element (keep the parent to represent the group)
                result_links.append(parent_id)
            else:
                # Keep all if just a few
                result_links.extend(links)

        # Add any links not in a group
        ungrouped = [link_id for link_id in link_ids if not any(
            link_id in group for group in parent_groups.values())]
        result_links.extend(ungrouped)

        return list(set(result_links))  # Remove duplicates

    def _generate_minimal_html(self, grouped_elements: Dict, dom_hashmap: Dict) -> str:
        """Generate minimal HTML representation from grouped elements."""
        output = []
        output.append("<html>")
        output.append("<body>")

        # Process groups by category
        for category, elem_ids in grouped_elements.items():
            # Create category heading
            category_name = category.replace(
                '_', ' ').title().replace('Interactive ', '')
            output.append(f"<div data-group=\"{category_name}\">")

            # Process each element
            for elem_id in elem_ids:
                element = dom_hashmap.get(elem_id)
                if not element:
                    continue

                tag_name = self._get_attr(element, 'tagName', 'div').lower()

                # Check if this is a parent summary element
                is_summary = False
                if category == 'interactive_a' and tag_name != 'a':
                    is_summary = True

                # Start tag
                if is_summary:
                    element_output = f"<div data-summary=\"group of {tag_name}s\""
                else:
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

                # Add selector and xpath (shortened)
                xpath = self._get_attr(element, 'xpath', '')
                if xpath:
                    # Get just the last part of the xpath
                    parts = xpath.split('/')
                    short_xpath = parts[-1] if len(parts) > 0 else xpath
                    element_output += f" data-xpath=\"{short_xpath}\""

                    # Generate very short CSS selector
                    selector = ""
                    if 'id' in attributes and attributes['id']:
                        selector = f"#{attributes['id']}"
                    elif tag_name in self.interactive_tags:
                        if 'name' in attributes:
                            selector = f"{tag_name}[name='{attributes['name']}']"
                        elif 'type' in attributes:
                            selector = f"{tag_name}[type='{attributes['type']}']"
                        else:
                            selector = tag_name

                    if selector:
                        element_output += f" data-selector=\"{selector}\""

                element_output += ">"

                # Add text content for interactive elements (truncated)
                if self._get_attr(element, 'isInteractive', False) and not is_summary:
                    text = self._get_element_text(element, dom_hashmap)
                    if text:
                        if len(text) > self.max_text_length:
                            text = text[:self.max_text_length] + "..."
                        element_output += text

                # For summary elements, add a count
                if is_summary:
                    children = self._get_attr(element, 'children', [])
                    child_links = 0
                    for child_id in children:
                        child = dom_hashmap.get(
                            str(child_id)) or dom_hashmap.get(child_id)
                        if child and self._get_attr(child, 'tagName', '').lower() == 'a':
                            child_links += 1

                    if child_links > 0:
                        element_output += f"Group of {child_links} similar links"

                # Close tag
                if is_summary:
                    element_output += "</div>"
                else:
                    element_output += f"</{tag_name}>"

                output.append(element_output)

            output.append("</div>")

        output.append("</body>")
        output.append("</html>")

        return "\n".join(output)


def generate_extreme_minimal_dom_for_llm(dom_state):
    """Generate minimal DOM representation for LLM consumption."""
    reducer = ExtremeTokenReducer(
        max_elements=100,  # Limit to 100 most important elements
        max_text_length=20  # Severely truncate text content
    )

    minimal_html = reducer.create_minimal_dom(dom_state.element_tree)
    return minimal_html
