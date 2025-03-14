from typing import Dict, List, Optional

from app.api.utils.dom_parser.dom_optimizer import generate_highlight_style_dom
from app.api.utils.dom_parser.optimizer2 import generate_fixed_highlight_dom
from app.api.utils.dom_parser.optimizer3 import generate_enhanced_highlight_dom
from app.models.dom import DOMState

def build_system_prompt():
    prompt = """You are a helpful assistant that helps users interact with web pages.
You will receive:
    1. A description of the user's task.
    2. The current URL of the web page.
    3. A concise description of interactive elements on the page with unique element IDs (E1, E2, etc.).
    4. A history of actions that have been performed previously, including URLs visited and actions taken.
Your task is to generate a JSON response containing a list of actions to perform to complete the user's task.

IMPORTANT: Elements are identified by unique IDs in the format E1, E2, etc. These IDs map to the actual elements
on the page. In your response, use these IDs to refer to elements you want to interact with.
Never tell done until the task is completed and you receive it in the previous goal evaluation.
**ALWAYS** respond with valid JSON in this exact format:
```json
{
  \"current_state\": {
        \"page_summary\": \"Quick detailed summary of new information from the current page which is not yet in the task history memory. Be specific with details which are important for the task. This is not on the meta level, but should be facts. If all the information is already in the task history memory, leave this empty.\",
        \"evaluation_previous_goal\": \"Success|Failed|Unknown - Analyze the current elements and the image to check if the previous goals/actions are successful like intended by the task. Ignore the action result. The website is the ground truth. Also mention if something unexpected happened like new suggestions in an input field. Shortly state why/why not\",
        \"next_goal\": \"What needs to be done with the next actions\"
    },
  \"actions\": [
    {
      \"type\": \"ACTION_TYPE (click|input|scroll|url)\",
      \"element_id\": \"E1\",  // Use element_id from the page description
      \"text\": \"TEXT_TO_INPUT\",  // Only for 'input' actions
      \"amount\": NUMBER,  // Only for 'scroll' actions (pixels)
      \"url\": \"URL\"  // Only for 'url' actions
    }
  ],
  \"is_done\": true/false
}"""
    return prompt


def build_user_message(dom_state: DOMState, task: str = None, result: Optional[List[Dict]] = None, history: Optional[List[Dict]] = None):
    # Create token-efficient DOM representation - this is the new approach
    # dom_content, xpath_map, selector_map = generate_token_efficient_dom_for_llm(dom_state
    # dom_content, xpath_map, selector_map = generate_complete_compact_dom(dom_state)
    # dom_content, xpath_map, selector_map = generate_fixed_compact_dom(
    #     dom_state)
    # print('DOM content generated')
    # dom_content, xpath_map, selector_map = generate_highlight_style_dom(dom_state)
    # dom_content, xpath_map, selector_map = generate_fixed_highlight_dom(dom_state)
    dom_content, xpath_map, selector_map = generate_enhanced_highlight_dom(dom_state)
    content = ""
    
    # Add task if provided
    if task:
        content += f"Task: {task}\n\n"
    
    # Add current URL and DOM elements
    content += f"""Current URL: {dom_state.url}

{dom_content}
"""
    
    # Add history if provided
    if history and len(history) > 0:
        content += "\nPrevious actions:\n"
        for i, step in enumerate(history):
            content += f"Step {i+1}: URL: {step.get('url', 'unknown')}\n"
            actions = step.get('actions', [])
            if actions:
                for action in actions:
                    content += f"  - {action.get('type', '').upper()}"
                    if 'element_id' in action:
                        content += f" element {action['element_id']}"
                    elif 'xpath_ref' in action:
                        content += f" element with ref: {action['xpath_ref']}"
                    elif 'selector' in action:
                        content += f" element with selector: {action['selector']}"
                        
                    if 'text' in action:
                        content += f" with text: '{action['text']}'"
                    if 'url' in action:
                        content += f" to URL: {action['url']}"
                    if 'amount' in action:
                        content += f" by {action['amount']} pixels"
                    content += "\n"
            content += "\n"
    
    # Add current result if provided
    if result:
        content += f"\nAction result: {result}"
        
    return content, xpath_map, selector_map
