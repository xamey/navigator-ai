from typing import Dict, List, Optional

from app.api.utils.dom_parser.optimizer import DOMOptimizer
from app.api.utils.dom_parser.optimizer2 import generate_minihtml_for_llm
from app.api.utils.dom_parser.optimizer3 import \
    generate_extreme_minimal_dom_for_llm
from app.api.utils.dom_parser.optimizer5 import \
    generate_xpath_map_and_minimal_dom_for_llm
from app.api.utils.dom_parser.optimizer6 import \
    generate_perfected_minimal_dom_for_llm
from app.api.utils.dom_parser.optimizer7 import \
    generate_hybrid_minimal_dom_for_llm
from app.api.utils.dom_parser.optimizer8 import \
    generate_balanced_minimal_dom_for_llm
from app.api.utils.dom_parser.optimizer9 import \
    generate_structured_html_for_llm
from app.models.dom import DOMState


def build_system_prompt():
    prompt = """
You are a helpful assistant that helps users interact with web pages.
You will receive:
    1. A description of the user's task.
    2. The current URL of the web page.
    3. A list of DOM elements in a simplified format with XPath references (data-xref).
    4. An array of actions that have been performed previously. This can be empty as well.
Your task is to generate a JSON response containing a list of actions to perform to complete the user's task.

IMPORTANT: Elements use short XPath references (xpath1, xpath2, etc.) instead of full XPaths to save tokens. 
In your response, refer to elements by their data-xref attribute value or data-selector attribute.

**ALWAYS** respond with valid JSON in this exact format:
```json
{
  "current_state": {
        "page_summary": "Quick detailed summary of new information from the current page which is not yet in the task history memory. Be specific with details which are important for the task. This is not on the meta level, but should be facts. If all the information is already in the task history memory, leave this empty.",
        "evaluation_previous_goal": "Success|Failed|Unknown - Analyze the current elements and the image to check if the previous goals/actions are successful like intended by the task. Ignore the action result. The website is the ground truth. Also mention if something unexpected happened like new suggestions in an input field. Shortly state why/why not",
        "next_goal": "What needs to be done with the next actions"
    },
  "actions": [
    {
      "type": "ACTION_TYPE (click|input|scroll|url)",
      "xpath_ref": "xpath1",  // Use data-xref attribute 
      "selector": "CSS_SELECTOR",  // Alternatively use data-selector attribute
      "text": "TEXT_TO_INPUT",  // Only for 'input' actions
      "amount": NUMBER,  // Only for 'scroll' actions (pixels)
      "url": "URL"  // Only for 'url' actions
    }
  ],
  "is_done": true/false
}
    """
    return prompt


def build_user_message(dom_state: DOMState, task: str = None, result: Optional[List[Dict]] = None):
    # Create optimized DOM representation
    # optimizer = DOMOptimizer(max_elements=100, max_text_length=80)
    # optimized_dom = optimizer.create_flat_interactive_summary(
    #     dom_state.element_tree)
    # mini_html = generate_minihtml_for_llm(dom_state)
    # mini_html = generate_extreme_minimal_dom_for_llm(dom_state)
    # mini_html = generate_mid_minimal_dom_for_llm(dom_state)
    # mini_html, xpath_map = generate_xpath_map_and_minimal_dom_for_llm(
    # dom_state)
    # mini_html, xpath_map = generate_perfected_minimal_dom_for_llm(dom_state)
    # mini_html, xpath_map = generate_hybrid_minimal_dom_for_llm(dom_state)
    # mini_html, xpath_map = generate_balanced_minimal_dom_for_llm(dom_state)
    mini_html, xpath_map = generate_structured_html_for_llm(dom_state)
    content = f"""
Current url: {dom_state.url}
Interactive elements from current page:
{mini_html}
"""
    if result:
        content += f"\n Action result: {result}"
    return content, xpath_map
