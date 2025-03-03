import json
import logging
import re
from typing import Dict, List, Optional, Set, Union

from app.models.dom import DOMElementNode, DOMTextNode
from bs4 import BeautifulSoup

logger = logging.getLogger("dom-optimizer")


class DOMOptimizer:
    """Optimizes DOM structures for LLM consumption by reducing token usage."""

    def __init__(self, max_elements=150, max_text_length=100, max_depth=10):
        self.max_elements = max_elements
        self.max_text_length = max_text_length
        self.max_depth = max_depth
        # Common CSS selectors for interactive elements
        self.interactive_selectors = [
            'a', 'button', 'input', 'select', 'textarea', 'label',
            '[role="button"]', '[role="link"]', '[role="checkbox"]',
            '[role="radio"]', '[role="tab"]', '[role="menuitem"]',
            '[aria-selected]', '[aria-checked]', '[tabindex]',
            '[onclick]', '[onchange]', '[onsubmit]', '[contenteditable]'
        ]

    def optimize_dom_tree(self, dom_hashmap: Dict) -> Dict:
        """Main method to optimize the DOM tree."""
        if not dom_hashmap:
            return {}

        # Step 1: Score and rank elements by importance
        element_scores = self._score_elements(dom_hashmap)

        # Step 2: Filter to top N most important elements
        filtered_elements = self._filter_top_elements(
            dom_hashmap, element_scores)

        # Step 3: Compress text content and attributes
        compressed_elements = self._compress_elements(filtered_elements)

        # Step 4: Deduplicate similar elements
        deduplicated_elements = self._deduplicate_elements(compressed_elements)

        # Step 5: Structure the optimized DOM
        optimized_dom = self._structure_optimized_dom(deduplicated_elements)

        logger.info(
            f"Reduced DOM from {len(dom_hashmap)} to {len(optimized_dom)} elements")
        return optimized_dom

    def _score_elements(self, dom_hashmap: Dict) -> Dict[str, float]:
        """Score elements by relevance, interactivity, visibility and content value."""
        scores = {}

        for element_id, element in dom_hashmap.items():
            score = 0

            # Skip non-element nodes or check text node value
            if isinstance(element, dict) and element.get('type') == 'TEXT_NODE':
                # Only consider visible text with sufficient content
                if element.get('isVisible', False) and len(element.get('text', '').strip()) > 3:
                    text_value = element.get('text', '').strip()
                    # Score based on text length (with diminishing returns)
                    text_score = min(len(text_value) / 50, 1.0)
                    # Higher score for text with important keywords
                    if re.search(r'(login|sign|submit|continue|next|search|add|buy|cart|checkout|price)',
                                 text_value, re.IGNORECASE):
                        text_score += 0.5
                    scores[element_id] = text_score
                continue

            # For element nodes
            if isinstance(element, dict):
                # Base relevance score for all elements
                score = 0.1

                # Prioritize interactive elements
                if element.get('isInteractive', False):
                    score += 1.5

                # Prioritize visible elements
                if element.get('isVisible', False):
                    score += 1.0
                else:
                    # Severely penalize invisible elements
                    score -= 2.0

                # Prioritize top elements (less likely to be overlapped)
                if element.get('isTopElement', False):
                    score += 0.5

                # Evaluate element attributes for importance
                attributes = element.get('attributes', {})

                # Check for inputs, buttons and links
                tag_name = element.get('tagName', '').lower()
                if tag_name in ['input', 'button', 'a', 'select', 'textarea']:
                    score += 0.8

                # Check for header and navigation elements
                if tag_name in ['h1', 'h2', 'h3', 'nav', 'header']:
                    score += 0.5

                # Check for form elements
                if tag_name in ['form', 'fieldset', 'label']:
                    score += 0.3

                # Check for important attributes
                for attr_name, attr_value in attributes.items():
                    if attr_name in ['id', 'name', 'value', 'href', 'placeholder', 'aria-label']:
                        score += 0.2

                    # Check for important attribute values
                    if isinstance(attr_value, str) and re.search(
                        r'(submit|login|register|search|menu|nav|button|btn|checkout|cart)',
                        attr_value, re.IGNORECASE
                    ):
                        score += 0.3

                # Check for role attributes
                if attributes.get('role') in [
                    'button', 'link', 'checkbox', 'radio', 'tab',
                    'menuitem', 'combobox', 'searchbox'
                ]:
                    score += 0.4

                # Add a small children count factor (more children = more important)
                children_count = len(element.get('children', []))
                if children_count > 0:
                    child_factor = min(children_count / 10, 1.0) * 0.3
                    score += child_factor

                scores[element_id] = max(score, 0)  # Ensure non-negative score

        return scores

    def _filter_top_elements(self, dom_hashmap: Dict, scores: Dict[str, float]) -> Dict:
        """Filter the DOM to keep only the most important elements."""
        # Sort elements by score
        sorted_elements = sorted(
            scores.items(), key=lambda x: x[1], reverse=True)

        # Take top N elements
        top_element_ids = [elem_id for elem_id,
                           _ in sorted_elements[:self.max_elements]]

        # Include parent hierarchy for context
        included_ids = set(top_element_ids)

        # Add parents for context
        def get_parent_ids(elem_id):
            for parent_id, element in dom_hashmap.items():
                if isinstance(element, dict) and elem_id in element.get('children', []):
                    return parent_id
            return None

        # Add parent chain for all selected elements
        for elem_id in list(included_ids):
            parent_id = get_parent_ids(elem_id)
            while parent_id is not None and parent_id not in included_ids:
                included_ids.add(parent_id)
                parent_id = get_parent_ids(parent_id)

        # Create filtered dictionary
        filtered_dom = {
            elem_id: dom_hashmap[elem_id]
            for elem_id in included_ids
            if elem_id in dom_hashmap
        }

        return filtered_dom

    def _compress_elements(self, dom_elements: Dict) -> Dict:
        """Compress element content and attributes to reduce token usage."""
        compressed = {}

        for elem_id, element in dom_elements.items():
            if isinstance(element, DOMTextNode):
                # Truncate text content
                text = element.text
                if len(text) > self.max_text_length:
                    text = text[:self.max_text_length] + "..."

                compressed[elem_id] = {
                    'type': 'TEXT_NODE',
                    'text': text,
                    'isVisible': element.isVisible
                }
            else:
                # Create compressed element
                compressed_elem = {
                    'tagName': element.tagName,
                    'xpath': element.xpath,
                    'isInteractive': element.isInteractive,
                    'isVisible': element.isVisible,
                    'isTopElement': element.isTopElement,
                    'children': element.children
                }

                # Only keep essential attributes
                important_attrs = [
                    'id', 'name', 'class', 'type', 'value', 'href', 'src',
                    'placeholder', 'aria-label', 'role', 'title', 'alt'
                ]

                original_attrs = element.attributes
                compressed_attrs = {}

                for attr, value in original_attrs.items():
                    if attr in important_attrs:
                        # Truncate very long attribute values
                        if isinstance(value, str) and len(value) > 100:
                            value = value[:100] + "..."
                        compressed_attrs[attr] = value

                compressed_elem['attributes'] = compressed_attrs
                compressed[elem_id] = compressed_elem

        return compressed

    def _deduplicate_elements(self, dom_elements: Dict) -> Dict:
        """Deduplicate similar elements like list items or table rows."""
        # Get all element tags for grouping
        element_groups = {}

        for elem_id, element in dom_elements.items():
            if isinstance(element, DOMTextNode):
                continue

            parent_xpath = '/'.join(element.xpath.split('/')[:-1])
            tag_name = element.tagName

            # Group by parent xpath and tag
            group_key = f"{parent_xpath}:{tag_name}"

            if group_key not in element_groups:
                element_groups[group_key] = []

            element_groups[group_key].append(elem_id)

        # Find groups with many similar elements
        similar_groups = {
            group_key: ids
            for group_key, ids in element_groups.items()
            if len(ids) > 5
        }

        # Process each group of similar elements
        removed_ids = set()
        for group_key, ids in similar_groups.items():
            # Keep representative elements from each group (first, middle, last)
            to_keep = [ids[0], ids[len(ids)//2], ids[-1]]

            # Mark others for removal
            for elem_id in ids:
                if elem_id not in to_keep:
                    removed_ids.add(elem_id)

            # Insert a summary element
            tag_name = group_key.split(':')[-1]
            parent_xpath = group_key.split(':')[0]
            summary_id = f"summary_{len(removed_ids)}"

            # Create the summary element
            dom_elements[summary_id] = {
                'tagName': 'summary',
                'xpath': f"{parent_xpath}/[summary]",
                'attributes': {
                    'summary': f"{len(ids)} similar {tag_name} elements"
                },
                'isInteractive': any(dom_elements[id].get('isInteractive', False) for id in ids),
                'isVisible': True,
                'isTopElement': False,
                'children': []
            }

        # Remove duplicated elements
        deduplicated = {
            elem_id: element
            for elem_id, element in dom_elements.items()
            if elem_id not in removed_ids
        }

        return deduplicated

    def _structure_optimized_dom(self, dom_elements: Dict) -> Dict:
        """Create the final optimized DOM structure."""
        # Remove child references to elements that no longer exist
        for elem_id, element in dom_elements.items():
            if 'children' in element:
                element['children'] = [
                    child_id for child_id in element['children']
                    if str(child_id) in dom_elements
                ]

        return dom_elements

    def extract_interactive_elements(self, dom_hashmap: Dict[str, DOMElementNode | DOMTextNode]) -> List[Dict]:
        """Extract only interactive elements in a flat list format."""
        interactive_elements = []

        for elem_id, element in dom_hashmap.items():
            # Only consider element nodes, not text nodes
            print("Element - ", element)
            if isinstance(element, DOMElementNode):
                # Check if the element is interactive and visible
                if element.isInteractive and element.isVisible:
                    # Add simplified element representation
                    simplified_element = {
                        'id': elem_id,
                        'tagName': element.tagName,
                        'xpath': element.xpath,
                        'text': self._get_element_text(elem_id, dom_hashmap),
                    }

                    # Add important attributes
                    attributes = element.attributes
                    for attr in ['id', 'type', 'value', 'href', 'placeholder', 'aria-label']:
                        if attr in attributes:
                            simplified_element[attr] = attributes[attr]

                    # Check if it has a useful text label
                    label_text = self._find_associated_label(
                        elem_id, dom_hashmap)
                    if label_text:
                        simplified_element['label'] = label_text

                    interactive_elements.append(simplified_element)

        return interactive_elements

    def _get_element_text(self, elem_id: str, dom_hashmap: Dict) -> str:
        """Get the text content of an element by looking at its text children."""
        element = dom_hashmap.get(elem_id)
        if not element:
            return ""

        # Direct check for text in this element
        text_contents = []

        # Recursive function to find all text nodes
        def collect_text(node_id):
            node = dom_hashmap.get(node_id)
            if not node:
                return

            # If it's a text node, add the text
            if isinstance(node, DOMTextNode) and node.isVisible:
                text = node.text.strip()
                if text:
                    text_contents.append(text)
            elif isinstance(node, DOMElementNode):
                # Check children
                for child_id in node.children:
                    collect_text(child_id)

        # Start the collection
        collect_text(elem_id)

        # Join all text content
        full_text = ' '.join(text_contents)

        # Truncate if too long
        if len(full_text) > self.max_text_length:
            return full_text[:self.max_text_length] + "..."

        return full_text

    def _find_associated_label(self, elem_id: str, dom_hashmap: Dict) -> str:
        """Find label text associated with an element."""
        element = dom_hashmap.get(elem_id)
        if not element or not isinstance(element, DOMElementNode):
            return ""

        # Check for id attribute for label association
        element_id = element.attributes.get('id')
        if element_id:
            # Look for label with for attribute
            for other_id, other_elem in dom_hashmap.items():
                if isinstance(other_elem, DOMElementNode) and other_elem.tagName.lower() == 'label':
                    if other_elem.attributes.get('for') == element_id:
                        return self._get_element_text(other_id, dom_hashmap)

        # Look for nested label (input inside label)
        for other_id, other_elem in dom_hashmap.items():
            if isinstance(other_elem, DOMElementNode) and other_elem.tagName.lower() == 'label':
                if elem_id in other_elem.children:
                    # Get the label text excluding the input element text
                    label_text = self._get_element_text(other_id, dom_hashmap)
                    element_text = self._get_element_text(elem_id, dom_hashmap)
                    return label_text.replace(element_text, '').strip()

        return ""

    def create_flat_interactive_summary(self, dom_hashmap: Dict) -> str:
        """Create a readable text summary of interactive elements."""
        interactive_elements = self.extract_interactive_elements(dom_hashmap)
        print("Interactive elements - ", interactive_elements)
        # Sort by visual order (approximated by XPath)
        interactive_elements.sort(key=lambda e: e.get('xpath', ''))

        # Group by tag type for better organization
        element_types = {
            'links': [],
            'buttons': [],
            'inputs': [],
            'selects': [],
            'other': []
        }

        for element in interactive_elements:
            tag = element.get('tagName', '').lower()
            element_type = 'other'

            if tag == 'a':
                element_type = 'links'
            elif tag == 'button' or element.get('type') == 'button':
                element_type = 'buttons'
            elif tag == 'input' or tag == 'textarea':
                element_type = 'inputs'
            elif tag == 'select':
                element_type = 'selects'

            element_types[element_type].append(element)

        # Generate readable summary
        summary_parts = []

        # Process each element type
        for type_name, elements in element_types.items():
            if not elements:
                continue

            summary_parts.append(f"\n== {type_name.upper()} ==")

            for i, element in enumerate(elements, 1):
                # Determine the best identifier for this element
                identifiers = []

                # Add text content if available
                if element.get('text'):
                    identifiers.append(f"text: \"{element.get('text')}\"")

                # Add label if available
                if element.get('label'):
                    identifiers.append(f"label: \"{element.get('label')}\"")

                # Add other identifying attributes
                for attr in ['placeholder', 'value', 'aria-label', 'id']:
                    if element.get(attr):
                        identifiers.append(f"{attr}: \"{element.get(attr)}\"")

                # Add tag and location if no other identifiers
                tag = element.get('tagName', '').lower()
                if not identifiers:
                    xpath = element.get('xpath', '')
                    identifiers.append(f"{tag} at {xpath}")

                # Use the element's type if applicable
                if element.get('type'):
                    tag = f"{tag}[type={element.get('type')}]"

                # Create the element string
                elem_str = f"{i}. <{tag}> " + \
                    ", ".join(identifiers) + \
                    f" | xpath: {element.get('xpath')}"
                summary_parts.append(elem_str)

        return "\n".join(summary_parts)
