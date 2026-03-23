# 🛡️ Enterprise Migration Command Center

> A real-time executive dashboard and configuration portal for the Devin Migration Engine. Built with React + Vite (frontend) and Express (config API). Provides live telemetry visualization, interactive batch topology, file-level drill-down, and a self-service GitHub integration wizard.

---

## What It Does

The Command Center is the **visual control plane** for the migration pipeline:

- **Live Dashboard** — Polls telemetry every 3 seconds, showing real-time migration progress
- **KPI Cards** — Human hours saved, active AI agents, migration %, security posture
- **Interactive Topology Chart** — Clickable per-batch bars showing completion state (merged / in-flight / pending)
- **File Drill-Down** — Click any batch to see every file's path and live migration status
- **Config Panel** — Self-service wizard: paste a GitHub token → select repo → pick branches → auto-detect source prefix → save. Writes directly to the engine's `.env`

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                           │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  KPI Cards   │  │  Topology Bars   │  │  ConfigPanel Modal   │ │
│  │  Hours Saved │  │  B1–B16 stacked  │  │  GitHub OAuth        │ │
│  │  Active Agts │  │  Click → files   │  │  Repo Selector       │ │
│  │  Progress %  │  │  Live animation  │  │  Branch Picker       │ │
│  │  Posture     │  │                  │  │  Prefix Auto-Detect  │ │
│  └─────────────┘  └──────────────────┘  └──────────────────────┘ │
│           │                                       │                │
│     polls /telemetry.json                   calls /api/*           │
│     every 3 seconds                         (Vite proxy)          │
└───────────┬───────────────────────────────────────┬───────────────┘
            │                                       │
            ▼                                       ▼
   ┌─────────────────┐                  ┌────────────────────────┐
   │  Vite Dev Server │ ──/api proxy──▶ │  Express Config API    │
   │  Port 5173       │                  │  Port 4000             │
   │  (static files)  │                  │                        │
   └─────────────────┘                  │  GET  /api/config      │
                                         │  POST /api/config      │
    ┌────────────────────┐               │  GET  /api/github/user │
    │  telemetry.json    │               │  GET  /api/github/repos│
    │  (written by the   │               │  GET  /api/github/     │
    │   migration engine │               │       branches/:o/:r   │
    │   every poll cycle)│               │  GET  /api/github/     │
    └────────────────────┘               │       tree/:o/:r/:b    │
                                         └───────────┬────────────┘
                                                     │
                                                     ▼
                                         ┌────────────────────────┐
                                         │  devin-migration-      │
                                         │  engine/.env           │
                                         │  (single source of     │
                                         │   truth for all config)│
                                         └────────────────────────┘
```

---

## Project Structure

```
command-center/
├── server.js               # Express config API (port 4000)
├── package.json            # Dependencies + scripts
├── vite.config.js          # Vite config with /api proxy
├── index.html              # Entry HTML
├── public/
│   └── telemetry.json      # Live telemetry (written by migration engine)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Main app: ConfigPanel + Dashboard
    ├── App.css             # Styles
    └── index.css           # Global styles
```

### Key Files Explained

| File | Purpose |
|---|---|
| `server.js` | Express API that reads/writes the migration engine's `.env` file and proxies GitHub API calls. Endpoints: config CRUD, user verification, repo listing, branch listing, tree scanning with auto-prefix detection. |
| `src/App.jsx` | Two components: **ConfigPanel** (GitHub wizard modal) and **App** (live dashboard with KPIs, topology bars, file drill-down, posture cards). |
| `vite.config.js` | Vite dev server config with proxy: `/api/*` → `localhost:4000` |
| `public/telemetry.json` | JSON file written by the migration engine every poll cycle. The dashboard fetches this every 3 seconds for live updates. |

---

## Features

### 📊 Live Dashboard
- **Human Hours Saved** — `completed_files × 2 hours` (estimated manual effort per file)
- **Active AI Agents** — Real-time count of dispatched Devin sessions
- **Migration %** — `completed / total_original_files`
- **Security Posture** — Zero-Trust GitOps status

### 📈 Interactive Batch Topology
- Stacked bar chart showing all 16 batches
- Color-coded: 🟩 Merged, 🟦 In-Flight, ⬛ Pending
- Active batch highlighted with blue border
- Click any batch → slide-down panel with every file path and status

### ⚙️ Configuration Wizard
4-step guided setup:
1. **GitHub Token** — Paste PAT → Connect → shows avatar + username
2. **Repository** — Dropdown of all user/org repos (100, sorted by recent)
3. **Branches** — Side-by-side Original Branch + Target Branch pickers
4. **Paths & Creds** — Auto-detected source prefix (clickable chips), local repo path, Devin API key + Org ID

All values persist directly to the engine's `.env` file.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Read current `.env` as JSON (with masked previews for secrets) |
| `POST` | `/api/config` | Merge incoming key-value pairs into `.env` |
| `GET` | `/api/github/user` | Verify GitHub token, return username + avatar |
| `GET` | `/api/github/repos` | List user's repositories (first 100, sorted by recent) |
| `GET` | `/api/github/branches/:owner/:repo` | List branches for a repository |
| `GET` | `/api/github/tree/:owner/:repo/:branch` | Fetch full tree, auto-detect source prefixes |

---

## How to Run

### Prerequisites
- Node.js 18+

### Setup

```bash
cd command-center
npm install
```

### Start (Recommended)

```bash
npm start
```

This runs both servers concurrently:
- **Config API** → `http://localhost:4000`
- **Dashboard** → `http://localhost:5173`

### Start Individually

```bash
# Config API only
npm run server

# Vite dev server only
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## How It Works

1. The **migration engine** (`main.py`) writes `telemetry.json` to `command-center/public/` every poll cycle
2. The **Vite dev server** serves this as a static file
3. The **React dashboard** fetches `/telemetry.json?t={timestamp}` every 3 seconds (cache-busted)
4. The **Config API** (`server.js`) reads/writes `devin-migration-engine/.env` for the configuration wizard
5. Vite proxies all `/api/*` requests to the Express server on port 4000

### No Database Required

The dashboard is completely stateless:
- Telemetry comes from a flat JSON file (written by the engine)
- Configuration comes from a flat `.env` file (read/written by the config API)
- GitHub data comes from live API calls (proxied through the config server)

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start Vite dev server only |
| `server` | `node server.js` | Start Express config API only |
| `start` | `concurrently "npm run server" "npm run dev"` | Start both servers |
| `build` | `vite build` | Production build |
| `preview` | `vite preview` | Preview production build |
| `lint` | `eslint .` | Run ESLint |

---

## Dependencies

### Runtime
- `react` / `react-dom` — UI framework
- `express` — Config API server
- `cors` — Cross-origin support for API
- `concurrently` — Run both servers with one command
- `lucide-react` — Icon library

### Dev
- `vite` — Build tool + dev server
- `tailwindcss` / `postcss` / `autoprefixer` — Styling
- `eslint` — Linting

---

## License

MIT
