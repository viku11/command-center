import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// ConfigPanel — GitHub integration + Engine configuration
// ═══════════════════════════════════════════════════════════════════════════
const ConfigPanel = ({ onClose }) => {
  const [config, setConfig] = useState({});
  const [ghUser, setGhUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [treeInfo, setTreeInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok'|'err', msg }
  const [step, setStep] = useState(1); // wizard step: 1=token, 2=repo, 3=branches, 4=paths

  // ── Load existing config on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/config');
        const json = await res.json();
        if (json.ok) {
          setConfig(json.config);
          // If token already exists, skip to step 2+ and verify
          if (json.config.GITHUB_TOKEN) {
            verifyToken(json.config.GITHUB_TOKEN);
          }
        }
      } catch { /* first run — no config yet */ }
    })();
  }, []);

  // ── Verify GitHub token ──
  const verifyToken = async (token) => {
    try {
      const res = await fetch('/api/github/user');
      const json = await res.json();
      if (json.ok) {
        setGhUser(json);
        setStep(2);
        loadRepos();
      } else {
        setGhUser(null);
        setStep(1);
      }
    } catch {
      setGhUser(null);
    }
  };

  // ── Connect: save token then verify ──
  const handleConnect = async () => {
    if (!config.GITHUB_TOKEN) return;
    setStatus(null);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ GITHUB_TOKEN: config.GITHUB_TOKEN }),
      });
      await verifyToken(config.GITHUB_TOKEN);
    } catch (err) {
      setStatus({ type: 'err', msg: 'Failed to connect: ' + err.message });
    }
  };

  // ── Load repos ──
  const loadRepos = async () => {
    try {
      const res = await fetch('/api/github/repos');
      const json = await res.json();
      if (json.ok) setRepos(json.repos);
    } catch { /* ignore */ }
  };

  // ── Select repo → load branches ──
  const handleRepoSelect = async (fullName) => {
    const [owner, name] = fullName.split('/');
    setConfig(prev => ({ ...prev, REPO_OWNER: owner, REPO_NAME: name, GITHUB_REPO: fullName }));
    setBranches([]);
    setTreeInfo(null);
    setStep(3);
    try {
      const res = await fetch(`/api/github/branches/${owner}/${name}`);
      const json = await res.json();
      if (json.ok) setBranches(json.branches);
    } catch { /* ignore */ }
  };

  // ── Select branch → scan tree ──
  const handleBranchSelect = async (branchName, field) => {
    setConfig(prev => ({ ...prev, [field]: branchName }));

    // When ORIGINAL_BRANCH is selected, scan tree for prefix auto-detect
    if (field === 'ORIGINAL_BRANCH' && config.REPO_OWNER && config.REPO_NAME) {
      setStep(4);
      try {
        const res = await fetch(`/api/github/tree/${config.REPO_OWNER}/${config.REPO_NAME}/${branchName}`);
        const json = await res.json();
        if (json.ok) {
          setTreeInfo(json);
          // Auto-select the prefix with the most files
          if (json.detectedPrefixes?.length > 0) {
            setConfig(prev => ({ ...prev, SOURCE_PREFIX: json.detectedPrefixes[0].prefix }));
          }
        }
      } catch { /* ignore */ }
    }
  };

  // ── Save all config ──
  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: 'ok', msg: `Saved ${json.saved.length} config values to .env` });
      } else {
        setStatus({ type: 'err', msg: json.error });
      }
    } catch (err) {
      setStatus({ type: 'err', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, placeholder, type = 'text') => (
    <div style={cfgStyles.field}>
      <label style={cfgStyles.label}>{label}</label>
      <input
        style={cfgStyles.input}
        type={type}
        placeholder={placeholder}
        value={config[key] || ''}
        onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div style={cfgStyles.overlay}>
      <div style={cfgStyles.panel}>
        {/* Header */}
        <div style={cfgStyles.panelHeader}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>⚙️ Configuration</h2>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Connect GitHub · Select Repository · Configure Engine</span>
          </div>
          <button onClick={onClose} style={cfgStyles.closeBtn}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={cfgStyles.steps}>
          {['GitHub Token', 'Repository', 'Branches', 'Paths & Creds'].map((label, i) => (
            <div key={i} style={{
              ...cfgStyles.stepPill,
              backgroundColor: step > i + 1 ? '#059669' : step === i + 1 ? '#3b82f6' : '#334155',
              color: step >= i + 1 ? '#f8fafc' : '#64748b',
            }}>
              {step > i + 1 ? '✓' : i + 1}. {label}
            </div>
          ))}
        </div>

        <div style={cfgStyles.body}>
          {/* Step 1: GitHub Token */}
          <div style={cfgStyles.section}>
            <h3 style={cfgStyles.sectionTitle}>🔑 GitHub Connection</h3>
            {ghUser ? (
              <div style={cfgStyles.userBadge}>
                <img src={ghUser.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <div>
                  <div style={{ color: '#f8fafc', fontWeight: 600 }}>{ghUser.name || ghUser.login}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>@{ghUser.login} — Connected ✅</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...cfgStyles.input, flex: 1 }}
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={config.GITHUB_TOKEN || ''}
                  onChange={e => setConfig(prev => ({ ...prev, GITHUB_TOKEN: e.target.value }))}
                />
                <button onClick={handleConnect} style={cfgStyles.btn}>Connect</button>
              </div>
            )}
          </div>

          {/* Step 2: Repository */}
          {step >= 2 && (
            <div style={cfgStyles.section}>
              <h3 style={cfgStyles.sectionTitle}>📦 Repository</h3>
              {repos.length > 0 ? (
                <select
                  style={cfgStyles.select}
                  value={config.GITHUB_REPO || ''}
                  onChange={e => handleRepoSelect(e.target.value)}
                >
                  <option value="">— Select a repository —</option>
                  {repos.map(r => (
                    <option key={r.full_name} value={r.full_name}>
                      {r.full_name} {r.private ? '🔒' : ''} ({r.language || 'n/a'})
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: '#64748b', margin: 0 }}>Loading repositories...</p>
              )}
              {config.GITHUB_REPO && (
                <span style={{ color: '#059669', fontSize: '0.8rem' }}>
                  Selected: {config.GITHUB_REPO}
                </span>
              )}
            </div>
          )}

          {/* Step 3: Branches */}
          {step >= 3 && branches.length > 0 && (
            <div style={cfgStyles.section}>
              <h3 style={cfgStyles.sectionTitle}>🌿 Branches</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={cfgStyles.field}>
                  <label style={cfgStyles.label}>Original Branch (frozen source)</label>
                  <select
                    style={cfgStyles.select}
                    value={config.ORIGINAL_BRANCH || ''}
                    onChange={e => handleBranchSelect(e.target.value, 'ORIGINAL_BRANCH')}
                  >
                    <option value="">— Select —</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div style={cfgStyles.field}>
                  <label style={cfgStyles.label}>Target Branch (merge destination)</label>
                  <select
                    style={cfgStyles.select}
                    value={config.TARGET_BRANCH || ''}
                    onChange={e => handleBranchSelect(e.target.value, 'TARGET_BRANCH')}
                  >
                    <option value="">— Select —</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Source prefix auto-detect + remaining config */}
          {step >= 4 && (
            <div style={cfgStyles.section}>
              <h3 style={cfgStyles.sectionTitle}>📁 Source Prefix & Paths</h3>

              {treeInfo && treeInfo.detectedPrefixes?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={cfgStyles.label}>Auto-detected source prefixes (click to select):</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {treeInfo.detectedPrefixes.map(p => (
                      <button
                        key={p.prefix}
                        onClick={() => setConfig(prev => ({ ...prev, SOURCE_PREFIX: p.prefix }))}
                        style={{
                          ...cfgStyles.prefixChip,
                          backgroundColor: config.SOURCE_PREFIX === p.prefix ? '#059669' : '#334155',
                          borderColor: config.SOURCE_PREFIX === p.prefix ? '#059669' : '#475569',
                        }}
                      >
                        {p.prefix} ({p.fileCount} files)
                      </button>
                    ))}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    Total source files in branch: {treeInfo.totalFiles}
                  </span>
                </div>
              )}

              {field('SOURCE_PREFIX', 'Source Prefix', 'frontend/src/')}
              {field('TARGET_REPO_PATH', 'Local Repo Path', 'C:/path/to/repo/frontend/src')}

              <h3 style={{ ...cfgStyles.sectionTitle, marginTop: '20px' }}>🤖 Devin Credentials</h3>
              {field('DEVIN_API_KEY', 'Devin API Key', 'cog_xxxx...', 'password')}
              {field('DEVIN_ORG_ID', 'Devin Org ID', 'org-xxxx...')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={cfgStyles.footer}>
          {status && (
            <span style={{ color: status.type === 'ok' ? '#059669' : '#ef4444', fontSize: '0.85rem' }}>
              {status.msg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...cfgStyles.btn, ...cfgStyles.saveBtn }}
          >
            {saving ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ConfigPanel styles
const cfgStyles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  panel: {
    backgroundColor: '#1e293b', borderRadius: '16px', width: '680px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #334155',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #334155',
  },
  closeBtn: {
    background: 'none', border: '1px solid #475569', color: '#94a3b8',
    fontSize: '1rem', cursor: 'pointer', borderRadius: '6px',
    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  steps: {
    display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid #0f172a',
    flexWrap: 'wrap',
  },
  stepPill: {
    padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  body: {
    padding: '20px 24px', overflowY: 'auto', flex: 1,
  },
  section: {
    marginBottom: '20px', padding: '16px', backgroundColor: '#0f172a',
    borderRadius: '8px', border: '1px solid #334155',
  },
  sectionTitle: {
    margin: '0 0 12px 0', color: '#f8fafc', fontSize: '0.95rem', fontWeight: 600,
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px',
  },
  label: {
    fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500,
  },
  input: {
    backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px',
    padding: '10px 12px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none',
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  select: {
    backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px',
    padding: '10px 12px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none',
    cursor: 'pointer', width: '100%',
  },
  btn: {
    backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    backgroundColor: '#059669', marginLeft: 'auto',
  },
  prefixChip: {
    border: '1px solid', borderRadius: '20px', padding: '6px 14px',
    color: '#e2e8f0', fontSize: '0.8rem', cursor: 'pointer', background: 'none',
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  userBadge: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderTop: '1px solid #334155', gap: '12px',
  },
};

const App = () => {
  const [data, setData] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`/telemetry.json?t=${Date.now()}`);
        if (response.ok) {
          const jsonData = await response.json();
          setData(jsonData);

          // Live-refresh the open detail panel with fresh data
          if (selectedBatch) {
            const updated = jsonData.batch_details?.find(b => b.batch === selectedBatch.batch);
            if (updated) setSelectedBatch(updated);
          }
        }
      } catch (error) {
        console.log("Waiting for Orchestrator to boot...");
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [selectedBatch]);

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>⏳ Awaiting Orchestrator Connection...</h1>
          <p style={styles.subtitle}>Start the Migration Engine to initialize telemetry.</p>
          <button
            onClick={() => setShowConfig(true)}
            style={{ ...styles.configBtn, marginTop: '20px', fontSize: '1rem', padding: '12px 28px' }}
          >
            ⚙️ Configure Migration
          </button>
        </div>
        {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
      </div>
    );
  }

  const totalFiles = data.progress.completed + data.progress.pending + data.progress.in_progress;
  const progressPct = totalFiles > 0 ? ((data.progress.completed / totalFiles) * 100).toFixed(1) : 0;

  // Scale bars proportionally — tallest batch = 200px
  const maxBatchSize = data.batch_details
    ? Math.max(...data.batch_details.map(b => b.total))
    : 1;

  return (
    <div style={styles.container}>
      <style>{animations}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🛡️ Enterprise Migration Command Center</h1>
        <p style={styles.subtitle}>Autonomous TypeScript Migration • Stateless GitOps • Zero-Trust Security</p>
        <button onClick={() => setShowConfig(true)} style={styles.configBtn}>⚙️</button>
      </div>

      {/* Config Panel Modal */}
      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}

      {/* KPI Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiValue}>{data.roi.hours_saved}</span>
          <span style={styles.kpiLabel}>Human Hours Saved</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={{...styles.kpiValue, color: '#3b82f6'}}>{data.roi.active_agents}</span>
          <span style={styles.kpiLabel}>Active AI Agents</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={{...styles.kpiValue, color: '#059669'}}>{progressPct}%</span>
          <span style={styles.kpiLabel}>Migration Complete</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={{...styles.kpiValue, color: '#f59e0b', fontSize: '1.2rem'}}>{data.posture.security}</span>
          <span style={styles.kpiLabel}>Security Posture</span>
        </div>
      </div>

      {/* Global Progress Bar */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Repository Migration Progress</h2>
        <div style={styles.progressBarOuter}>
          <div style={{...styles.progressBarSegment, width: `${progressPct}%`, backgroundColor: '#059669'}}></div>
          <div style={{...styles.progressBarSegment, width: `${totalFiles > 0 ? ((data.progress.in_progress / totalFiles) * 100) : 0}%`, backgroundColor: '#3b82f6'}}></div>
        </div>
        <div style={styles.progressLabels}>
          <span>✅ {data.progress.completed} Merged</span>
          <span>🔵 {data.progress.in_progress} In-Flight</span>
          <span>⬜ {data.progress.pending} Pending</span>
        </div>
      </div>

      {/* AST Dependency Topology — Per-Batch Stacked Bars */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>AST Dependency Topology — Batch Progress</h2>
        <p style={{color: '#64748b', fontSize: '0.8rem', margin: '0 0 16px 0'}}>Click any batch to inspect individual files</p>

        {data.batch_details ? (
          <div style={styles.topoContainer}>
            {data.batch_details.map((b) => {
              const barHeight = Math.max((b.total / maxBatchSize) * 200, 24);
              const completedPct = b.total > 0 ? (b.completed / b.total) * 100 : 0;
              const inProgressPct = b.total > 0 ? (b.in_progress / b.total) * 100 : 0;
              const pendingPct = 100 - completedPct - inProgressPct;

              const isCurrent = b.batch === data.batch.current;
              const isFullyDone = b.completed === b.total;
              const isSelected = selectedBatch?.batch === b.batch;

              return (
                <div
                  key={b.batch}
                  style={{
                    ...styles.topoColumn,
                    cursor: 'pointer',
                    transform: isSelected ? 'translateY(-4px)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() => setSelectedBatch(isSelected ? null : b)}
                >
                  <span style={{...styles.topoFileCount, color: isFullyDone ? '#059669' : '#94a3b8'}}>
                    {b.completed}/{b.total}
                  </span>

                  <div style={{
                    ...styles.topoBarContainer,
                    height: `${barHeight}px`,
                    border: isSelected
                      ? '2px solid #f8fafc'
                      : isCurrent
                        ? '2px solid #3b82f6'
                        : '1px solid #334155',
                  }}>
                    <div style={{width: '100%', height: `${pendingPct}%`, backgroundColor: '#1f2937', transition: 'height 0.5s ease'}}></div>
                    <div style={{width: '100%', height: `${inProgressPct}%`, backgroundColor: '#3b82f6', transition: 'height 0.5s ease', animation: inProgressPct > 0 ? 'pulse 2s infinite' : 'none'}}></div>
                    <div style={{width: '100%', height: `${completedPct}%`, backgroundColor: '#059669', transition: 'height 0.5s ease'}}></div>
                  </div>

                  <span style={{
                    ...styles.topoLabel,
                    color: isSelected ? '#f8fafc' : isCurrent ? '#3b82f6' : '#64748b',
                    fontWeight: isSelected || isCurrent ? 'bold' : 'normal',
                  }}>
                    B{b.batch}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{color: '#64748b'}}>Waiting for batch manifest...</p>
        )}

        <div style={{...styles.progressLabels, marginTop: '12px'}}>
          <span>🟩 Merged</span>
          <span>🟦 In-Flight</span>
          <span>⬛ Pending</span>
          <span style={{color: '#3b82f6'}}>[ ] = Active Batch</span>
        </div>

        {/* Slide-down file detail panel */}
        {selectedBatch && selectedBatch.files && (
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              <div>
                <h3 style={{margin: 0, color: '#f8fafc', fontSize: '1rem'}}>
                  Batch {selectedBatch.batch} — {selectedBatch.total} Files
                </h3>
                <span style={{color: '#64748b', fontSize: '0.8rem'}}>
                  {selectedBatch.completed} migrated · {selectedBatch.pending} remaining
                </span>
              </div>
              <button onClick={() => setSelectedBatch(null)} style={styles.closeButton}>✕</button>
            </div>

            <div style={styles.fileGrid}>
              {/* Sort: pending first (actionable), then completed */}
              {[...selectedBatch.files]
                .sort((a, _b) => (a.state === 'COMPLETED' ? 1 : -1))
                .map((file, idx) => {
                  const done = file.state === 'COMPLETED';
                  const inFlight = file.state === 'IN_PROGRESS';
                  return (
                    <div key={idx} style={{
                      ...styles.fileRow,
                      borderLeft: done
                        ? '3px solid #059669'
                        : inFlight
                          ? '3px solid #3b82f6'
                          : '3px solid #475569',
                    }}>
                      <span style={{fontSize: '0.85rem', flexShrink: 0}}>
                        {done ? '✅' : inFlight ? '🔵' : '⬜'}
                      </span>
                      <span style={{
                        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                        fontSize: '0.82rem',
                        color: done ? '#059669' : inFlight ? '#3b82f6' : '#cbd5e1',
                        wordBreak: 'break-all',
                      }}>
                        {file.path}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* System Posture */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>System Posture</h2>
        <div style={styles.postureRow}>
          <div style={styles.postureCard}>
            <span style={{fontSize: '1.5rem'}}>🛡️</span>
            <span style={styles.postureLabel}>{data.posture.security}</span>
          </div>
          <div style={styles.postureCard}>
            <span style={{fontSize: '1.5rem'}}>🔄</span>
            <span style={styles.postureLabel}>{data.posture.resilience}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    padding: '32px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    position: 'relative',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#64748b',
    margin: 0,
  },
  kpiRow: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginBottom: '40px',
    flexWrap: 'wrap',
  },
  kpiCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '180px',
  },
  kpiValue: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#059669',
  },
  kpiLabel: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 0,
    marginBottom: '4px',
  },
  progressBarOuter: {
    display: 'flex',
    height: '28px',
    backgroundColor: '#0f172a',
    borderRadius: '14px',
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressBarSegment: {
    height: '100%',
    transition: 'width 0.5s ease',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '0.85rem',
    color: '#94a3b8',
  },
  topoContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
    justifyContent: 'center',
    padding: '16px 0',
    flexWrap: 'wrap',
  },
  topoColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  topoFileCount: {
    fontSize: '0.7rem',
    fontWeight: '600',
  },
  topoBarContainer: {
    width: '44px',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  topoLabel: {
    fontSize: '0.7rem',
    marginTop: '4px',
  },
  detailPanel: {
    marginTop: '20px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #1e293b',
  },
  closeButton: {
    background: 'none',
    border: '1px solid #475569',
    color: '#94a3b8',
    fontSize: '1rem',
    cursor: 'pointer',
    borderRadius: '4px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileGrid: {
    padding: '12px 20px 20px',
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    borderRadius: '4px',
  },
  postureRow: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
  },
  postureCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '16px 24px',
  },
  postureLabel: {
    fontSize: '0.95rem',
    color: '#e2e8f0',
  },
  configBtn: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: 'none',
    border: '1px solid #475569',
    color: '#94a3b8',
    fontSize: '1.4rem',
    cursor: 'pointer',
    borderRadius: '8px',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.2s',
  },
};

const animations = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

export default App;