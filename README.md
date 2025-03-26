<div align="center">
  <h1> Navigator AI</h1>
  <h2>Intelligent Automation Within the Browser</h2>
  <p><em>Open-source browser automation powered by Gemini 2.5 Pro-exp</em></p>
</div>

## Overview

Navigator AI empowers users and developers to seamlessly automate tasks within web browsers (with app support coming in the future). Unlike traditional browser automation tools, Navigator AI offers:

- A **component library** for direct integration into web applications
- A **browser extension** for end-user automation

Consider it as Cursor/Windsurf for websites and applications. Big shoutout to [Browser-Use](https://github.com/browser-use/browser-use) as Navigator AI is insppired from them and currently is a kind of an chrome extension version that does what they do inside but inside your browser.

## Key Features

- **Direct Web Integration**: Embeddable React/framework components allow developers to add browser automation capabilities directly within their web/mobile applications. Users can easily use voice/text to automatically execute workflows on your app.

- **User-Friendly Extension**: A browser extension that allows users to create, manage, and run repeatable workflows directly in their browser.

- **Knowledge Base Integration**: Add custom rules, documentation, and knowledge bases that the agent will prioritize over its LLM-based workflow, making the agent specific to YOUR application.

- **Self-Improvement**: The agent improves over time based on how users interact with pages, even when not actively using the agent.

## Technology Stack

- **Frontend**: 
  - React, Vite, TypeScript (for both component library and extension)
  - Packaged in a Turborepo for efficient management

- **Backend**: 
  - Python, FastAPI

- **Database**: 
  - PostgreSQL (primary data storage)
  - Redis (caching)
  - Weaviate (vector database, deployed via Docker)

## Setup Instructions

### Prerequisites

- Node.js (v16+) - [Install Guide](https://nodejs.org/en/download/)
- Package manager:
  - pnpm - [Install Guide](https://pnpm.io/installation) (`npm install -g pnpm`)
  - OR npm (comes with Node.js)
- Python 3.9+ - [Install Guide](https://www.python.org/downloads/)
- Poetry (Python dependency management) - [Install Guide](https://python-poetry.org/docs/#installation)
- Docker and Docker Compose (for database services) - [Install Guide](https://docs.docker.com/get-docker/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/navigator-ai.git
   cd navigator-ai
   ```

2. **Install dependencies**
   ```bash
   # Install Python dependencies
   poetry install
   
   # Install Node dependencies
   pnpm install
   # OR
   npm install
   ```

3. **Start database services**
   ```bash
   docker-compose up -d
   ```

4. **Run the development server**
   ```bash
   pnpm run dev:server
   # OR
   npm run dev:server
   ```

5. Run Redis
     ```bash
     cd apps/server
     docker compose up -d
     ```

5. **Build and install the extension**
   ```bash
   # Build the extension
   pnpm run build
   # OR
   npm run build
   ```
   
   Then:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked" and select the `/apps/extension/dist` directory
   - The extension should now appear in your browser toolbar

## Roadmap

### Core Functionality
- [ ] **Visual Task Builder (Extension)**
  - Develop a drag-and-drop interface for creating automation workflows
  - Add support for conditional logic and branching

- [ ] **Advanced DOM Interaction**
  - Implement sophisticated element selection methods using vision LLMs
  - Add support for handling dynamic content

### Intelligence & Learning
- [ ] **Self-Improving Agents**
  - Implement feedback loops to learn from user corrections
  - Track user activity patterns (with permission) to improve automation
  - Develop metrics for measuring and reporting agent improvement

- [ ] **Knowledge Base Enhancement**
  - Create an interface for managing custom rules and documentation
  - Implement priority weighting for different knowledge sources
  - Add support for importing existing documentation

### Integration & Expansion
- [ ] **Third-party Integrations**
  - Website-specific integrations (AWS, GCP, Amazon, etc.)
  - Multiple LLM provider support
  - API connections to popular services

- [ ] **Complex Web Interactions**
  - Support for iframes and shadow DOM
  - Handling authentication and user sessions
  - Intelligent error recovery and pause mechanisms

### User Experience
- [ ] **Workflow Management**
  - Record and replay functionality for capturing user workflows
  - Scheduled tasks with time/interval specifications
  - Workflow sharing and importing capabilities

- [ ] **Notification System**
  - Alert users when automation encounters obstacles
  - Provide detailed reporting on automation performance
  - Suggest improvements based on execution patterns

## Contributing

Contributions are welcome! It has lots of bugs and bad code. Please feel free to submit a Pull Request or create an Issue incase you find a bug.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
