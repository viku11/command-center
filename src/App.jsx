import React, { useState, useEffect } from 'react';
import { Shield, GitPullRequest, Clock, Cpu, Activity } from 'lucide-react';

const App = () => {
  const [data, setData] = useState({
    progress: { completed: 0, pending: 120, in_progress: 0 },
    roi: { hours_saved: 0, active_agents: 0 },
    batch: { current: 1, total: 1 },
    posture: { security: "Zero-Trust (PR-Gated)", resilience: "Stateless Auto-Resume Active" }
  });

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('/telemetry.json');
        if (response.ok) {
          const jsonData = await response.json();
          setData(jsonData);
        }
      } catch (error) {
        console.log("Waiting for Orchestrator to boot...");
      }
    };
    const intervalId = setInterval(fetchTelemetry, 3000);
    fetchTelemetry();
    return () => clearInterval(intervalId);
  }, []);

  const totalFiles = data.progress.completed + data.progress.pending + data.progress.in_progress;
  const progressPct = totalFiles > 0 ? ((data.progress.completed / totalFiles) * 100).toFixed(1) : 0;

  return (
    <div style={styles.container}>
      <style>{hoverAnimation}</style>
      
      <header style={styles.header}>
        <h1 style={styles.title}>Migration Orchestrator Command Center</h1>
        <p style={styles.subtitle}>Autonomous GitOps Pipeline & AI Fleet Manager</p>
      </header>

      {/* Top Row: Executive ROI */}
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.label}>Human Hours Saved</span>
            <Clock size={20} color="#60a5fa" />
          </div>
          <div style={styles.statContainer}>
            <span style={styles.statValue}>{data.roi.hours_saved}</span>
            <span style={styles.statUnit}>hrs</span>
          </div>
        </div>

        <div style={{...styles.card, borderRight: data.roi.active_agents > 0 ? '4px solid #10b981' : '1px solid #374151'}}>
          <div style={styles.cardHeader}>
            <span style={styles.label}>Active AI Agents</span>
            <Cpu size={20} color={data.roi.active_agents > 0 ? "#10b981" : "#4b5563"} />
          </div>
          <div style={styles.statValue}>{data.roi.active_agents}</div>
          <div style={{...styles.badge, color: '#10b981'}}>
            {data.roi.active_agents > 0 ? "▲ Horizontal Scale Active" : "Wait-State Armed"}
          </div>
        </div>

        <div style={{...styles.card, gridColumn: 'span 2'}}>
          <div style={styles.cardHeader}>
            <span style={styles.label}>Global Migration Progress</span>
            <Activity size={20} color="#a78bfa" />
          </div>
          <div style={styles.progressHeader}>
            <span style={styles.statValue}>{progressPct}%</span>
            <span style={styles.label}>{data.progress.completed} / {totalFiles} Files</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{...styles.progressBar, width: `${progressPct}%`}}></div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}><Shield size={18} color="#10b981" /> Security Posture</h3>
          <div style={styles.list}>
            <div style={styles.listItem}>
              <span>Write Access</span>
              <span style={styles.tagGreen}>{data.posture.security}</span>
            </div>
            <div style={styles.listItem}>
              <span>Architecture</span>
              <span style={styles.tagBlue}>{data.posture.resilience}</span>
            </div>
          </div>
        </div>

        <div style={{...styles.card, gridColumn: 'span 2'}}>
          <h3 style={styles.sectionTitle}><GitPullRequest size={18} color="#60a5fa" /> AST Dependency Topology (Batch {data.batch.current} of {data.batch.total})</h3>
          <div style={styles.topoContainer}>
            {Array.from({ length: Math.max(8, data.batch.total) }).map((_, idx) => {
              const batchNum = idx + 1;
              const isCurrent = batchNum === data.batch.current;
              const isPast = batchNum < data.batch.current;
              return (
                <div key={idx} style={styles.topoColumn}>
                  <div style={{
                    ...styles.topoBar,
                    height: isPast ? '100%' : (isCurrent ? '75%' : '25%'),
                    backgroundColor: isPast ? '#059669' : (isCurrent ? '#3b82f6' : '#1f2937'),
                    animation: isCurrent ? 'pulse 2s infinite' : 'none'
                  }}></div>
                  <span style={styles.topoLabel}>B{batchNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- STYLES (Pure CSS-in-JS for Resiliency) ---
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#030712', color: '#f9fafb', padding: '40px', fontFamily: 'sans-serif' },
  header: { marginBottom: '32px', borderBottom: '1px solid #1f2937', paddingBottom: '16px' },
  title: { fontSize: '2rem', fontWeight: 'bold', margin: 0, background: 'linear-gradient(to right, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.05' },
  subtitle: { color: '#9ca3af', marginTop: '12px', lineHeight: '1.25', marginBottom: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' },
  card: { backgroundColor: '#111827', border: '1px solid #374151', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  label: { color: '#9ca3af', fontSize: '0.875rem' },
  statContainer: { display: 'flex', alignItems: 'baseline', gap: '4px' },
  statValue: { fontSize: '2.25rem', fontWeight: 'bold' },
  statUnit: { fontSize: '0.875rem', color: '#6b7280' },
  badge: { fontSize: '0.75rem', marginTop: '8px', fontWeight: 'bold' },
  progressHeader: { display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '8px' },
  progressTrack: { width: '100%', backgroundColor: '#1f2937', height: '10px', borderRadius: '5px' },
  progressBar: { height: '10px', borderRadius: '5px', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', transition: 'width 1s ease-in-out' },
  sectionTitle: { fontSize: '1rem', color: '#9ca3af', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '12px', borderRadius: '8px' },
  tagGreen: { fontSize: '0.75rem', backgroundColor: 'rgba(6, 78, 59, 0.5)', color: '#34d399', padding: '4px 8px', borderRadius: '4px' },
  tagBlue: { fontSize: '0.75rem', backgroundColor: 'rgba(30, 58, 138, 0.5)', color: '#60a5fa', padding: '4px 8px', borderRadius: '4px' },
  topoContainer: { display: 'flex', gap: '16px', height: '128px', alignItems: 'flex-end' },
  topoColumn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  topoBar: { width: '100%', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', transition: 'height 0.5s ease-in-out' },
  topoLabel: { fontSize: '0.75rem', color: '#6b7280' }
};

const hoverAnimation = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

export default App;