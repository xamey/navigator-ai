
<h1 align="center">Navigator AI: Intelligent Automation WITHIN the Browser</h1>

Navigator AI empowers AI agents to seamlessly interact with and automate tasks within web browsers.  Unlike traditional browser automation tools, Navigator AI will offer, both a **component library** for direct integration into web applications and a **browser extension** for end-user automation, all powered by advanced language models. Best part - fully open source.

## Key Features

* **Direct Web Integration:**  Embeddable React components allow developers to add browser automation capabilities *directly within their web applications*. No external tools or complex setups are required to automate their website.  This is a key differentiator from tools like Browse.ai that rely on external Playwright scripts.
* **User-Friendly Extension :**  A browser extension provides an intuitive interface for users to create, manage, and run automation tasks directly in their browser.
* **Knowledge-base**: Add rules, knowledge bases, docs, etc. and agent will give a higher priority to it than its LLM based workflow
* **Self-improving**: Improves on the go based on how user interacts with the page when not using the agent.

### Technology Stack

* Frontend: React, Vite, TypeScript (for both component library and extension)
* Backend: Python, FastAPI
* Frontend and backend is packed in turbo-repo for easy management
* Database: PostgreSQL, Redis, Weaviate (thorugh docker)

### Roadmap (TODOs)

[ ] Self-Improving Agents:

- Implement feedback loops where the agent learns from user corrections and successful/failed task executions.
- Track and store off-the-agent activity of user if permitted

[ ] Knowledge Bases and Rules:

- Allow users and developers to define custom rules and knowledge bases to guide the agent's behavior. [ ] Visual Task Builder (Extension): Develop a drag-and-drop interface for creating automation workflows within the extension.

[ ] Scheduled Tasks: Allow users to schedule tasks to run at specific times or intervals.

[ ] Advanced DOM Interaction: Implement more sophisticated element selection methods (e.g., v-LLM integration).

[ ] Support for More Complex Web Interactions:

- Handling iframes and shadow DOM.
- Managing authentication and user sessions by asking llm to pause and notify user if stuck
- Pause if stuck

[ ] Third-party integrations: 

- Website based: AWS,  GCP, Amazon, etc.
- LLM providers

[ ] Record a workflow: Let the user record a workflow and then AI will execute the same
