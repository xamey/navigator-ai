# Contributing to Navigator AI

Thank you for your interest in contributing to Navigator AI! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Communication](#communication)

## Code of Conduct

We expect all contributors to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (v16+) - [Install Guide](https://nodejs.org/en/download/)
- pnpm - [Install Guide](https://pnpm.io/installation) (`npm install -g pnpm`)
- Python 3.9+ - [Install Guide](https://www.python.org/downloads/)
- Poetry - [Install Guide](https://python-poetry.org/docs/#installation)
- Docker and Docker Compose - [Install Guide](https://docs.docker.com/get-docker/)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/navigator-ai.git
   cd navigator-ai
   ```
3. Add the original repository as upstream:
   ```bash
   git remote add upstream https://github.com/original-owner/navigator-ai.git
   ```
4. Install dependencies :
   ```bash
   cd apps/server
   # Install Python dependencies
   poetry install

   cd apps/extension
   # Install Node.js dependencies
   pnpm install
   ```
5. Start Redis:
   ```bash
   cd apps/server
   docker compose up -d
   cd ../..
   ```
7. Run the development server:
   ```bash
   pnpm run dev:server
   ```

## Development Workflow

### Project Structure

Navigator AI is organized as a monorepo using Turborepo. Here's an overview of the directory structure:

```
navigator-ai/
├── apps/
│   ├── extension/       # Chrome extension
│   ├── server/          # Backend API server
│   └── web/             # Web application
├── packages/
│   ├── ui/              # Shared UI components
│   ├── core/            # Core functionality
│   └── utils/           # Shared utilities
└── scripts/             # Development and build scripts
```

### Branch Naming Convention

- `feature/your-feature-name` - For new features
- `fix/issue-description` - For bug fixes
- `docs/what-you-documented` - For documentation changes
- `refactor/what-you-refactored` - For code refactoring

### Development Process

1. Sync with the upstream repository:
   ```bash
   git checkout main
   git pull upstream main
   ```

2. Create a new branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes, commit them, and push to your fork:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

4. Create a Pull Request from your branch to the main repository.

## Pull Request Process

1. Ensure all tests pass and your code meets our coding standards.
2. Update documentation if necessary.
3. Fill out the pull request template completely.
4. Request a review from maintainers.
5. Address any feedback provided during the review.

PRs need at least one approval from a maintainer before they can be merged.

## Coding Standards

### TypeScript/JavaScript

- We follow the [ESLint](https://eslint.org/) configuration in the repository.
- Use TypeScript for all new code.
- Format your code using [Prettier](https://prettier.io/).

### Python

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) style guide.
- Use type hints for all function parameters and return values.
- Format your code using [Black](https://github.com/psf/black).
- Sort imports using [isort](https://pycqa.github.io/isort/).

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types include:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or auxiliary tools

## Testing

### Frontend Tests

- Write tests for all new components using [Jest](https://jestjs.io/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
- Run tests with:
  ```bash
  pnpm test
  ```

### Backend Tests

- Write tests for all new endpoints using [pytest](https://docs.pytest.org/).
- Run tests with:
  ```bash
  cd apps/server
  poetry run pytest
  ```

## Documentation

- Document all public API endpoints.
- Add JSDoc comments to all TypeScript/JavaScript functions.
- Update the README.md if you add or change functionality.
- For major changes, update or add to the project documentation.

## Communication

- For bug reports and feature requests, please open an issue.

## License

By contributing to Navigator AI, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

---

Thank you for contributing to Navigator AI! Your efforts help make this project better for everyone.
