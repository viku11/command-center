// Express Config API — bridges the Command Center UI to the migration engine's .env
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(__dirname, '..', 'devin-migration-engine');
const ENV_PATH = path.join(ENGINE_DIR, '.env');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Helpers ────────────────────────────────────────────────────────────────

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const raw = fs.readFileSync(ENV_PATH, 'utf-8');
  const config = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    config[key] = val;
  }
  return config;
}

function writeEnv(config) {
  const header = [
    '# Managed by Command Center — edits via UI are persisted here',
    '# NEVER commit .env to git',
    '',
  ];
  const lines = header.concat(
    Object.entries(config).map(([k, v]) => `${k}=${v}`)
  );
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

function ghHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'CommandCenter/1.0',
  };
}

// ─── Config CRUD ────────────────────────────────────────────────────────────

// GET  /api/config — return current .env as JSON (mask secrets)
app.get('/api/config', (_req, res) => {
  try {
    const config = readEnv();
    // Send full values so UI fields pre-fill, but mask sensitive keys in a separate field
    const masked = { ...config };
    if (masked.GITHUB_TOKEN) masked.GITHUB_TOKEN_PREVIEW = '••••' + masked.GITHUB_TOKEN.slice(-4);
    if (masked.DEVIN_API_KEY) masked.DEVIN_API_KEY_PREVIEW = '••••' + masked.DEVIN_API_KEY.slice(-4);
    res.json({ ok: true, config: masked });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/config — merge incoming keys into .env
app.post('/api/config', (req, res) => {
  try {
    const current = readEnv();
    const incoming = req.body;

    // Only allow known keys
    const ALLOWED = [
      'GITHUB_TOKEN', 'GITHUB_REPO', 'REPO_OWNER', 'REPO_NAME',
      'ORIGINAL_BRANCH', 'TARGET_BRANCH', 'SOURCE_PREFIX',
      'TARGET_REPO_PATH', 'DEVIN_API_KEY', 'DEVIN_ORG_ID',
    ];

    for (const key of ALLOWED) {
      if (incoming[key] !== undefined && incoming[key] !== '') {
        current[key] = incoming[key];
      }
    }

    // Auto-derive GITHUB_REPO from REPO_OWNER + REPO_NAME
    if (current.REPO_OWNER && current.REPO_NAME) {
      current.GITHUB_REPO = `${current.REPO_OWNER}/${current.REPO_NAME}`;
    }

    writeEnv(current);
    res.json({ ok: true, saved: Object.keys(incoming).filter(k => ALLOWED.includes(k)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GitHub API Proxy ───────────────────────────────────────────────────────

// GET /api/github/user — verify token & return username + avatar
app.get('/api/github/user', async (_req, res) => {
  try {
    const { GITHUB_TOKEN } = readEnv();
    if (!GITHUB_TOKEN) return res.status(400).json({ ok: false, error: 'No GITHUB_TOKEN configured' });

    const resp = await fetch('https://api.github.com/user', { headers: ghHeaders(GITHUB_TOKEN) });
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'GitHub auth failed' });
    const user = await resp.json();
    res.json({ ok: true, login: user.login, avatar: user.avatar_url, name: user.name });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/github/repos — list user's repos (first 100)
app.get('/api/github/repos', async (_req, res) => {
  try {
    const { GITHUB_TOKEN } = readEnv();
    if (!GITHUB_TOKEN) return res.status(400).json({ ok: false, error: 'No GITHUB_TOKEN configured' });

    const resp = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
      { headers: ghHeaders(GITHUB_TOKEN) }
    );
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'Failed to fetch repos' });
    const repos = await resp.json();
    const slim = repos.map(r => ({
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      default_branch: r.default_branch,
      language: r.language,
      private: r.private,
    }));
    res.json({ ok: true, repos: slim });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/github/branches/:owner/:repo — list branches
app.get('/api/github/branches/:owner/:repo', async (req, res) => {
  try {
    const { GITHUB_TOKEN } = readEnv();
    if (!GITHUB_TOKEN) return res.status(400).json({ ok: false, error: 'No GITHUB_TOKEN configured' });

    const { owner, repo } = req.params;
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      { headers: ghHeaders(GITHUB_TOKEN) }
    );
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'Failed to fetch branches' });
    const branches = await resp.json();
    res.json({ ok: true, branches: branches.map(b => b.name) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/github/tree/:owner/:repo/:branch — full tree + auto-detect source prefix
app.get('/api/github/tree/:owner/:repo/:branch', async (req, res) => {
  try {
    const { GITHUB_TOKEN } = readEnv();
    if (!GITHUB_TOKEN) return res.status(400).json({ ok: false, error: 'No GITHUB_TOKEN configured' });

    const { owner, repo, branch } = req.params;
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: ghHeaders(GITHUB_TOKEN) }
    );
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'Failed to fetch tree' });
    const treeData = await resp.json();

    // Find all .js/.jsx/.ts/.tsx files
    const sourceFiles = treeData.tree
      .filter(n => n.type === 'blob' && /\.(jsx?|tsx?)$/.test(n.path))
      .map(n => n.path);

    // Auto-detect common source prefixes
    const prefixCandidates = ['frontend/src/', 'src/', 'app/', 'client/src/', 'packages/'];
    const detectedPrefixes = prefixCandidates
      .filter(p => sourceFiles.some(f => f.startsWith(p)))
      .map(p => ({
        prefix: p,
        fileCount: sourceFiles.filter(f => f.startsWith(p)).length,
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    res.json({
      ok: true,
      totalFiles: sourceFiles.length,
      detectedPrefixes,
      sampleFiles: sourceFiles.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.CONFIG_PORT || 4000;
app.listen(PORT, () => {
  console.log(`⚙️  Config API running on http://localhost:${PORT}`);
  console.log(`   .env path: ${ENV_PATH}`);
});
