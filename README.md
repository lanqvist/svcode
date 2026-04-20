# Vibe Coding Tool

Frontend development tool that transforms natural language prompts into working React applications with live preview and automatic PR creation.

## Features

- 📝 Natural language prompts
- ⚛️ React component generation
- 🐳 Docker-based preview
- 🔄 Automatic GitHub PR creation
- ✏️ Iterative validation and correction

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure GitHub token

Copy `.env.example` to `.env` and add your GitHub PAT:

```bash
cp .env.example .env
```

Edit `.env` and set your token:
```
GITHUB_TOKEN=ghp_your_token_here
```

Create a token at: https://github.com/settings/tokens  
Required scopes: `repo`, `read:user`

### 3. Run development mode

Run frontend (Vite dev server on port 3000):
```bash
npm run dev
```

Run backend (Express on port 8080) in another terminal:
```bash
npm run dev:server
```

Open http://localhost:3000

### 4. Build for production

```bash
npm run build
npm run build:server
```

Start the production server:
```bash
node dist/server/index.js
```

### 5. Run with Docker

```bash
docker-compose up --build
```

## Usage

1. **Enter your app description** in natural language
2. **Click "Generate & Create PR"**
3. **Review preview** and PR link

### Example Prompts

**Todo App:**
```
Create a todo list application with:
- Header with app title
- Input field to add new tasks
- List of tasks with checkboxes
- Delete button for each task
- Filter buttons: All / Active / Completed
```

**Weather Dashboard:**
```
Build a weather dashboard with:
- Search input for city name
- Current weather card with temperature and icon
- 5-day forecast list
- Loading spinner
```

**Blog:**
```
Create a blog homepage with:
- Header with navigation
- Featured post card
- List of recent posts
- Sidebar with categories
- Footer
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript
- **Git**: simple-git for repository operations
- **GitHub**: Octokit for API interactions
- **Preview**: Docker containers for isolated rendering

## Project Structure

```
├── src/
│   ├── App.tsx          # Main UI
│   ├── main.tsx         # Entry point
│   ├── index.css        # Styles
│   └── server/
│       └── index.ts     # Backend API
├── projects/            # Generated projects
├── Dockerfile           # Production build
├── docker-compose.yml   # Development environment
└── example-requirements.json  # Sample input
```

## License

MIT
