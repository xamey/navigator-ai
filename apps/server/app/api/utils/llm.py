import base64
import os

from google import genai
from google.genai import types


def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-2.0-pro-exp-02-05"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text="""Task: spinning up a lambda function
"""
                ),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        temperature=0.3,
        top_p=0.95,
        top_k=64,
        max_output_tokens=8192,
        response_mime_type="application/json",
        response_schema=genai.types.Schema(
            type=genai.types.Type.OBJECT,
            enum=[],
            required=["current_state", "actions", "is_done"],
            properties={
                "current_state": genai.types.Schema(
                    type=genai.types.Type.OBJECT,
                    enum=[],
                    required=["page_summary",
                              "evaluation_previous_goal", "next_goal"],
                    properties={
                        "page_summary": genai.types.Schema(
                            type=genai.types.Type.STRING,
                        ),
                        "evaluation_previous_goal": genai.types.Schema(
                            type=genai.types.Type.STRING,
                        ),
                        "next_goal": genai.types.Schema(
                            type=genai.types.Type.STRING,
                        ),
                    },
                ),
                "actions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.OBJECT,
                        enum=[],
                        required=["type", "xpath_ref", "selector"],
                        properties={
                            "type": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "xpath_ref": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "selector": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "text": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "amount": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "url": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                        },
                    ),
                ),
                "is_done": genai.types.Schema(
                    type=genai.types.Type.BOOLEAN,
                ),
            },
        ),
        system_instruction=[
            types.Part.from_text(
                text="""You are a helpful assistant that helps users interact with web pages.
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
  \"current_state\": {
        \"page_summary\": \"Quick detailed summary of new information from the current page which is not yet in the task history memory. Be specific with details which are important for the task. This is not on the meta level, but should be facts. If all the information is already in the task history memory, leave this empty.\",
        \"evaluation_previous_goal\": \"Success|Failed|Unknown - Analyze the current elements and the image to check if the previous goals/actions are successful like intended by the task. Ignore the action result. The website is the ground truth. Also mention if something unexpected happened like new suggestions in an input field. Shortly state why/why not\",
        \"next_goal\": \"What needs to be done with the next actions\"
    },
  \"actions\": [
    {
      \"type\": \"ACTION_TYPE (click|input|scroll|url)\",
      \"xpath_ref\": \"xpath1\",  // Use data-xref attribute 
      \"selector\": \"CSS_SELECTOR\",  // Alternatively use data-selector attribute
      \"text\": \"TEXT_TO_INPUT\",  // Only for 'input' actions
      \"amount\": NUMBER,  // Only for 'scroll' actions (pixels)
      \"url\": \"URL\"  // Only for 'url' actions
    }
  ],
  \"is_done\": true/false
}"""
            ),
        ],
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        print(chunk.text, end="")


generate()
