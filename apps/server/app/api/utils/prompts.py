from typing import Dict, List, Optional

from apps.server.app.models.dom import DOMState


def build_system_prompt(self):
    prompt = """
You are a helpful assistant that helps users interact with web pages.
You will receive:
    1.  A description of the user's task.
    2.  The current URL of the web page.
    3.  A list of DOM elements in structured format on the page, each with a unique index and xpath.
    4.  An array of actions that have been performed previously. This is can be empty as well.
Your task is to generate a JSON response containing a list of actions to perform to complete the user's task.

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
      "selector": "CSS_SELECTOR", // CSS Selector is preferred
      "xpath": "XPATH",         // XPath should be based on the provided xpath in structured DOM
      "text": "TEXT_TO_INPUT",   // Only for 'input' actions
      "amount": NUMBER           // Only for 'scroll' actions (pixels)
      "url": 'url'               // only for url
    }
  ],
    "is_done": true/false
    }
    """
    return prompt


def build_user_message(self, dom_state: DOMState, task: str, result: Optional[List[Dict]] = None):
    dom_string = dom_state
    content = f"""
    
    [Current state starts here]
    Current url: {dom_state.url}
    Interactive elements from current page:
    {dom_string}
    """
    if result:
        content += f"\n Action result: {result}"

    return content
