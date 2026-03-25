# 🎯 RBIN BDO Genie — Agentic Chatbot Dashboard

A modern frontend web application for orchestrating and coordinating multiple AI agents from a unified dashboard.

## ✨ Features

- **Orchestrator Chat** — Chat interface where the master orchestrator delegates tasks to specialized agents
- **Agent Management** — View and manage all registered AI agents with real-time status
- **Workflow Orchestrations** — Define multi-step workflows that chain agents together
- **Analytics & Monitoring** — Track agent performance, task completion, and system health
- **Agent Detail Modals** — Drill into any agent to view logs, capabilities, and performance metrics

## 🛠 Tech Stack

- **React 18** + **Vite** — Fast, modern frontend tooling
- **CSS Custom Properties** — Dark theme with design tokens
- **Azure Static Web Apps** — Cloud deployment target

## 📁 Project Structure

```
agentic-dashboard/
├── public/                     # Static assets
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx         # Navigation sidebar with conversations
│   │   ├── DashboardHeader.jsx # Top header bar with search
│   │   ├── ChatPanel.jsx       # Main chat interface
│   │   ├── AgentPanel.jsx      # Side panel showing active agents
│   │   └── AgentDetailModal.jsx# Agent detail/config modal
│   ├── context/
│   │   └── AgentContext.jsx    # Global state: agents, messages, conversations
│   ├── styles/                 # All CSS modules
│   └── App.jsx                 # Root app with routing between views
├── staticwebapp.config.json    # Azure Static Web Apps config
├── .github/workflows/          # CI/CD pipeline for Azure deployment
├── package.json
└── vite.config.js
```

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) >= 18
- npm or yarn

### Install & Run

```bash
cd agentic-dashboard
npm install
npm run dev
```

The app will open at `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

Output goes to `/dist`.

## ☁️ Deploy to Azure Static Web Apps

### Option 1: Azure CLI

```bash
# Install Azure SWA CLI
npm install -g @azure/static-web-apps-cli

# Build the app
npm run build

# Deploy
swa deploy ./dist --deployment-token <YOUR_DEPLOYMENT_TOKEN>
```

### Option 2: GitHub Actions (CI/CD)

1. Create an Azure Static Web App resource in the Azure Portal
2. Copy the **deployment token** from the resource
3. Add it as a GitHub secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Push to `main` — the included `.github/workflows/azure-static-web-apps.yml` will auto-deploy

### Option 3: Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **Static Web App**
3. Link your GitHub repo
4. Set:
   - **App location**: `/agentic-dashboard`
   - **Output location**: `dist`
   - **Build command**: `npm run build`

## 📊 Dashboard Views

| View | Description |
|------|-------------|
| 💬 Chat | Talk to the orchestrator; see task delegations in real-time |
| 🤖 Agents | Grid of all agents with status, stats, and capabilities |
| 🔗 Workflows | Multi-agent pipelines you can create and run |
| 📈 Analytics | Performance metrics, charts, and uptime data |

## 🔧 Configuration

Agents are defined in `src/context/AgentContext.jsx`. To add a new agent, add an entry to the `initialAgents` array with:

```js
{
  id: 'my-agent',
  name: 'My Agent',
  icon: '🚀',
  status: 'active',       // 'active' | 'idle' | 'error'
  description: '...',
  capabilities: ['...'],
  tasksCompleted: 0,
  avgResponseTime: '0s',
  successRate: '0%',
  model: 'GPT-4o',
  lastActive: 'Never',
  logs: [],
}
```

## 📜 License

MIT
