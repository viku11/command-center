import { useState, useEffect } from 'react';

const App = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`/telemetry.json?t=${Date.now()}`);
        if (response.ok) {
          const jsonData = await response.json();
          setData(jsonData);
        }
      } catch (error) {
        console.log("Waiting for Orchestrator to boot...");
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>⏳ Awaiting Orchestrator Connection...</h1>
          <p style={styles.subtitle}>Start the Migration Engine to initialize telemetry.</p>
        </div>
      </div>
    );
  }

  const totalFiles = data.progress.completed + data.progress.pending + data.progress.in_progress;
  const progressPct = totalFiles > 0 ? ((data.progress.completed / totalFiles) * 100).toFixed(1) : 0;

  return (
    <div style={styles.container}>
      <style>{pulseAnimation}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🛡️ Enterprise Migration Command Center</h1>
        <p style={styles.subtitle}>Autonomous TypeScript Migration • Stateless GitOps • Zero-Trust Security</p>
      </div>

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
        {data.batch_details ? (
          <div style={styles.topoContainer}>
            {data.batch_details.map((b) => {
              const completedPct = b.total > 0 ? (b.completed / b.total) * 100 : 0;
              const inProgressPct = b.total > 0 ? (b.in_progress / b.total) * 100 : 0;
              const pendingPct = 100 - completedPct - inProgressPct;
              const isCurrent = b.batch === data.batch.current;
              const isFullyDone = b.completed === b.total;

              return (
                <div key={b.batch} style={styles.topoColumn}>
                  {/* File count label above bar */}
                  <span style={{...styles.topoFileCount, color: isFullyDone ? '#059669' : '#94a3b8'}}>
                    {b.completed}/{b.total}
                  </span>
                  {/* Stacked bar */}
                  <div style={{
                    ...styles.topoBarContainer,
                    border: isCurrent ? '2px solid #3b82f6' : '1px solid #1e293b'
                  }}>
                    {/* Pending (top — gray) */}
                    <div style={{width: '100%', height: `${pendingPct}%`, backgroundColor: '#1f2937', transition: 'height 0.5s ease'}}></div>
                    {/* In-progress (middle — blue) */}
                    <div style={{width: '100%', height: `${inProgressPct}%`, backgroundColor: '#3b82f6', transition: 'height 0.5s ease', animation: inProgressPct > 0 ? 'pulse 2s infinite' : 'none'}}></div>
                    {/* Completed (bottom — green) */}
                    <div style={{width: '100%', height: `${completedPct}%`, backgroundColor: '#059669', transition: 'height 0.5s ease'}}></div>
                  </div>
                  {/* Batch label below bar */}
                  <span style={{
                    ...styles.topoLabel,
                    color: isCurrent ? '#3b82f6' : '#64748b',
                    fontWeight: isCurrent ? 'bold' : 'normal'
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
    marginBottom: '16px',
  },
  progressBarOuter: {
    display: 'flex',
    height: '28px',
    backgroundColor: '#0f172a',
    borderRadius: '14px',
    overflow: 'hidden',
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
    gap: '8px',
    justifyContent: 'center',
    padding: '16px 0',
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
    width: '40px',
    height: '200px',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  topoLabel: {
    fontSize: '0.7rem',
    marginTop: '4px',
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
};

const pulseAnimation = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

export default App;