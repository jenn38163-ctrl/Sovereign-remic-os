import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Webhook, 
  Database, 
  ShieldCheck, 
  Plus, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  RefreshCw, 
  Sliders, 
  Terminal, 
  Copy, 
  Check, 
  Trash2, 
  Settings, 
  ArrowRight,
  Zap,
  Layers,
  BarChart3,
  Globe,
  Wallet,
  Download,
  FileText,
  Lock,
  UserCheck,
  Upload
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Integration {
  id: string;
  name: string;
  type: 'LLM' | 'Webhook' | 'REST API' | 'Database';
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  endpoint: string;
  lastSync: string;
  successRate: number;
}

interface LogItem {
  id: string;
  integrationName: string;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  latencyMs: number;
  timestamp: string;
  payload: any;
  response: any;
}

const initialIntegrations: Integration[] = [
  { id: 'int-1', name: 'Gemini AI Core', type: 'LLM', status: 'ACTIVE', endpoint: 'api.google.ai/v1/models/gemini-3.7-flash', lastSync: 'Just now', successRate: 99.4 },
  { id: 'int-2', name: 'GitHub Webhook Receiver', type: 'Webhook', status: 'ACTIVE', endpoint: 'https://ais-dev-ekgvve.../api/webhook/github', lastSync: '12m ago', successRate: 100.0 },
  { id: 'int-3', name: 'Stripe Billing Sync', type: 'REST API', status: 'ACTIVE', endpoint: 'https://api.stripe.com/v1/invoices', lastSync: '1h ago', successRate: 98.2 },
  { id: 'int-4', name: 'PostgreSQL Production DB', type: 'Database', status: 'ACTIVE', endpoint: 'postgres://cloud-sql-cluster-7:5432/main', lastSync: '2m ago', successRate: 99.9 },
  { id: 'int-5', name: 'Slack Alert Dispatcher', type: 'Webhook', status: 'INACTIVE', endpoint: 'https://hooks.slack.com/services/T00/B00/X99', lastSync: '1d ago', successRate: 95.0 }
];

const analyticsData = [
  { time: '00:00', requests: 120, latency: 180 },
  { time: '04:00', requests: 85, latency: 165 },
  { time: '08:00', requests: 340, latency: 240 },
  { time: '12:00', requests: 780, latency: 310 },
  { time: '16:00', requests: 620, latency: 280 },
  { time: '20:00', requests: 450, latency: 195 },
  { time: '24:00', requests: 210, latency: 175 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations' | 'console' | 'logs' | 'analytics' | 'ledger' | 'debt-notes'>('debt-notes');
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Authentication & Role State for 4-Eyes Control Demo
  const [authToken, setAuthToken] = useState<string>('checker_token_456');
  const [userRole, setUserRole] = useState<string>('CHECKER');

  // Debt Note Registry State
  const [debtNotesData, setDebtNotesData] = useState<{ notes: any[], summary: any }>({ notes: [], summary: { total_principal_issued: '50071590.00', registry_count: 3, archived_count: 0 } });
  const [debtNotesLoading, setDebtNotesLoading] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [newNoteId, setNewNoteId] = useState('DN-1038');
  const [newPrincipal, setNewPrincipal] = useState('150000.00');
  const [newTranche, setNewTranche] = useState('JUNIOR TRANCHE');
  const [newNetwork, setNewNetwork] = useState('Ethereum');
  const [auditReportModal, setAuditReportModal] = useState<any>(null);

  // Ledger State
  const [ledgerData, setLedgerData] = useState<any>({ journal_entries: [], audit_logs: [], settlement_intents: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [settleAmount, setSettleAmount] = useState('100.00');
  const [settleCurrency, setSettleCurrency] = useState('USDC');
  const [settleProvider, setSettleProvider] = useState('PAYU');

  // Fetch Debt Notes
  const fetchDebtNotes = async () => {
    setDebtNotesLoading(true);
    try {
      const res = await fetch('/api/debt-notes', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.notes) {
        setDebtNotesData(data);
      }
    } catch (e) {
      console.error('Failed to fetch debt notes', e);
    } finally {
      setDebtNotesLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtNotes();
  }, [authToken]);

  // Fetch ledger data
  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/ledger/state', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to fetch ledger', e);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [authToken]);

  const handleIssueNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/debt-notes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id: newNoteId,
          principal_value: newPrincipal,
          tranche_name: newTranche,
          network: newNetwork
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsIssueModalOpen(false);
        await fetchDebtNotes();
      } else {
        alert(data.error || 'Failed to issue note');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApproveNote = async (id: string) => {
    try {
      const res = await fetch(`/api/debt-notes/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchDebtNotes();
      } else {
        alert(data.error || 'Approval failed (Maker-Checker violation check)');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm(`Are you sure you want to archive note ${id}? Strict retention policy applies.`)) return;
    try {
      const res = await fetch(`/api/debt-notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchDebtNotes();
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleViewAuditReport = async (id: string) => {
    try {
      const res = await fetch(`/api/debt-notes/${id}/audit`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setAuditReportModal(data);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerLoading(true);
    try {
      await fetch('/api/ledger/settle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ amount: settleAmount, currency: settleCurrency, provider: settleProvider })
      });
      await fetchLedger();
    } catch (e) {
      console.error('Failed to settle', e);
    } finally {
      setLedgerLoading(false);
    }
  };

  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.debt_notes && Array.isArray(json.debt_notes)) {
          setDebtNotesData(prev => ({
            ...prev,
            notes: [...json.debt_notes, ...prev.notes]
          }));
        }
        setUploadMessage(`Successfully imported package "${file.name}". Auto-redirected to Debt Note Registry.`);
        setActiveTab('debt-notes');
        setTimeout(() => setUploadMessage(null), 6000);
      } catch (err: any) {
        alert('Failed to parse uploaded JSON package: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadAuditTrail = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      tenant_id: 'tenant-omega',
      signature: 'sig_' + Math.random().toString(36).substring(2) + '_' + Date.now(),
      journal_entries: ledgerData.journal_entries,
      audit_logs: ledgerData.audit_logs,
      settlement_intents: ledgerData.settlement_intents,
      debt_notes: debtNotesData.notes
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovereign_remic_audit_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Console Test State
  const [selectedIntId, setSelectedIntId] = useState<string>('int-1');
  const [testPrompt, setTestPrompt] = useState('Analyze the incoming webhook payload for anomalies and summarize customer intent.');
  const [testEndpoint, setTestEndpoint] = useState('https://api.google.ai/v1/models/gemini-3.7-flash');
  const [testPayload, setTestPayload] = useState('{\n  "event": "customer_feedback",\n  "sentiment": "neutral",\n  "score": 0.65\n}');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // New Integration Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'LLM' | 'Webhook' | 'REST API' | 'Database'>('REST API');
  const [newEndpoint, setNewEndpoint] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [authToken]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/integrations/logs', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const targetInt = integrations.find(i => i.id === selectedIntId);
      const isGemini = targetInt?.type === 'LLM';

      let endpoint = isGemini ? '/api/gemini/generate' : '/api/integrations/test';
      let body: any = {};

      if (isGemini) {
        body = { prompt: testPrompt };
      } else {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(testPayload);
        } catch (e) {
          parsedPayload = { raw: testPayload };
        }
        body = {
          integrationName: targetInt?.name || 'Custom Integration',
          type: targetInt?.type || 'REST API',
          endpointUrl: testEndpoint,
          payload: parsedPayload
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setTestResult(data);
      await fetchLogs();
    } catch (e: any) {
      setTestResult({ error: e.message || 'Test execution failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleAddIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEndpoint) return;
    const newInt: Integration = {
      id: `int-${Date.now()}`,
      name: newName,
      type: newType,
      status: 'ACTIVE',
      endpoint: newEndpoint,
      lastSync: 'Just now',
      successRate: 100.0
    };
    setIntegrations([newInt, ...integrations]);
    setNewName('');
    setNewEndpoint('');
    setIsModalOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold tracking-tight text-white">Sovereign Remic OS (v17 Production)</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-medium border border-emerald-800">
                Authoritative Kernel v17
              </span>
            </div>
            <p className="text-xs text-neutral-400">Institutional Secured Debt Instrument Registry & Settlement Engine</p>
          </div>
        </div>

        {/* 4-Eyes Role & Authentication Switcher */}
        <div className="flex items-center space-x-4 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-800">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-neutral-400">Active Role (4-Eyes):</span>
          </div>
          <select
            value={authToken}
            onChange={(e) => {
              const val = e.target.value;
              setAuthToken(val);
              if (val.includes('maker')) setUserRole('MAKER');
              else if (val.includes('checker')) setUserRole('CHECKER');
              else if (val.includes('admin')) setUserRole('ADMIN');
              else setUserRole('AUDITOR');
            }}
            className="bg-neutral-900 border border-neutral-700 text-emerald-400 text-xs rounded-lg px-3 py-1 font-mono font-semibold focus:outline-none">
            <option value="checker_token_456">Bob Checker (Risk Officer - CHECKER)</option>
            <option value="maker_token_123">Alice Maker (Treasury - MAKER)</option>
            <option value="admin_token_789">Carol Admin (ADMIN)</option>
            <option value="auditor_token_321">David Auditor (AUDITOR)</option>
          </select>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload Package</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={() => setActiveTab('debt-notes')}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Issue New Note</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-3 pb-2">Sovereign Core</div>
          <button
            onClick={() => setActiveTab('debt-notes')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'debt-notes' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <FileText className="w-4 h-4" />
            <span>Debt Note Registry</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'ledger' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Wallet className="w-4 h-4" />
            <span>Financial Ledger</span>
          </button>

          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-3 pb-2 pt-6">Integration Hub</div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Activity className="w-4 h-4" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'integrations' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Webhook className="w-4 h-4" />
            <span>Integrations ({integrations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'console' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Terminal className="w-4 h-4" />
            <span>Live Test Console</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'logs' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Clock className="w-4 h-4" />
            <span>Execution Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'analytics' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <BarChart3 className="w-4 h-4" />
            <span>Performance & Metrics</span>
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 space-y-6">
          {uploadMessage && (
            <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{uploadMessage}</span>
              </div>
              <button onClick={() => setUploadMessage(null)} className="text-emerald-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>
          )}

          {activeTab === 'debt-notes' && (
            <div className="space-y-6">
              {/* Debt Note Registry Header Banner Matching Screenshot */}
              <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-6 h-6 text-emerald-400" />
                      <h2 className="text-xl font-bold tracking-tight text-white">Debt Note Registry</h2>
                    </div>
                    <p className="text-xs text-red-400 font-mono mt-1 font-semibold">
                      INSTITUTIONAL RECORD OF SECURED INSTRUMENTS . STRICT NO-DELETE POLICY ACTIVE
                    </p>
                  </div>
                  <button
                    onClick={() => setIsIssueModalOpen(true)}
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>Issue New Note</span>
                  </button>
                </div>

                {/* Top Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Total Principal Issued</div>
                    <div className="text-2xl font-bold tracking-tight text-white font-mono">
                      ${Number(debtNotesData.summary?.total_principal_issued || 50071590).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Registry Count</div>
                    <div className="text-2xl font-bold tracking-tight text-white font-mono">
                      {debtNotesData.summary?.registry_count || 3} Instruments
                    </div>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">Archived Items (Soft-Deleted)</div>
                    <div className="text-2xl font-bold tracking-tight text-white font-mono">
                      {debtNotesData.summary?.archived_count || 0} Records
                    </div>
                  </div>
                </div>

                {/* Search & Network Filter Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search CUSIP, ISIN, Symbol..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
                    <select className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs rounded-xl px-4 py-2 font-mono focus:outline-none">
                      <option>All Networks</option>
                      <option>Mainnet</option>
                      <option>Ethereum</option>
                      <option>Polygon</option>
                    </select>

                    <span className="inline-flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-400 font-mono border border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>AUDIT LEDGER: LIVE SYNCHRONIZED</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Debt Notes Table */}
              <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-400 bg-neutral-950/60 font-mono">
                        <th className="px-6 py-4">Identification</th>
                        <th className="px-6 py-4">Tranche / Network</th>
                        <th className="px-6 py-4">Status & G-ANP Code</th>
                        <th className="px-6 py-4">Principal Value</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {debtNotesData.notes.filter(n => !n.archived).map((note) => (
                        <tr key={note.id} className="hover:bg-neutral-800/40 transition-colors font-mono">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-bold text-white">{note.id}</span>
                              <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">JM6-SS</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-1">
                              CUSIP: {note.cusip} • ISIN: {note.isin}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-semibold text-emerald-400">{note.tranche_name}</div>
                            <div className="text-[11px] text-neutral-400 flex items-center space-x-1 mt-1">
                              <span>⚡</span>
                              <span>{note.network}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                              <span>🛡️</span>
                              <span>{note.status}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-1 font-mono">{note.ganp_code}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-white">
                              ${Number(note.principal_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-1">
                              {note.interest_rate} Interest • {note.issuance_date}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {note.status === 'PENDING_CHECKER_APPROVAL' && (
                              <button
                                onClick={() => handleApproveNote(note.id)}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer">
                                Approve (4-Eyes)
                              </button>
                            )}
                            <button
                              onClick={() => handleViewAuditReport(note.id)}
                              className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer">
                              Audit Report
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1.5 rounded bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 border border-neutral-700 transition-colors cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom UCC & Collateral Asset Statement Cards Matching Screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 font-mono">UCC-1 SECURED</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">PERFECTED</span>
                  </div>
                  <p className="text-xs text-neutral-300">Fiduciary collateral perfect filing</p>
                  <div className="pt-2 border-t border-neutral-800 flex justify-between text-[11px] font-mono text-neutral-400">
                    <span>JURISDICTION: Delaware</span>
                    <span>FILING DATE: 2025-02-25</span>
                  </div>
                </div>

                <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 font-mono">UCC-9 DISCLOSURE</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">VALIDATED</span>
                  </div>
                  <p className="text-xs text-neutral-300">Asset pool inventory certificate</p>
                  <div className="pt-2 border-t border-neutral-800 flex justify-between text-[11px] font-mono text-neutral-400">
                    <span>JURISDICTION: Nevada</span>
                    <span>FILING DATE: 2026-06-07</span>
                  </div>
                </div>

                <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-md space-y-3">
                  <div className="text-xs font-bold text-emerald-400 font-mono">COLLATERAL ASSET STATEMENT</div>
                  <p className="text-[11px] text-neutral-300 italic leading-relaxed">
                    "This sovereign note represents a secured digital debt asset structured under CAF Agent ID #91665509, anchored perfectly on the Malachite immutable core block."
                  </p>
                  <div className="pt-2 border-t border-neutral-800 text-[10px] font-mono text-neutral-400 truncate">
                    SSI CODE: 982234567894523458
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Endpoints</span>
                    <Globe className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white">
                    {integrations.filter(i => i.status === 'ACTIVE').length} / {integrations.length}
                  </div>
                  <div className="text-xs text-emerald-400 font-medium mt-1">All core services healthy</div>
                </div>

                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">24h Throughput</span>
                    <Activity className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white">2,605 req</div>
                  <div className="text-xs text-emerald-400 font-medium mt-1">+12.4% from yesterday</div>
                </div>

                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
                    <Clock className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white">214 ms</div>
                  <div className="text-xs text-neutral-400 font-medium mt-1">Optimal response time</div>
                </div>

                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
                    <ShieldCheck className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-white">99.3%</div>
                  <div className="text-xs text-emerald-400 font-medium mt-1">0 critical faults</div>
                </div>
              </div>

              {/* Main Chart Card */}
              <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-white">Request Traffic & Latency</h2>
                    <p className="text-xs text-neutral-400">Real-time throughput across all registered webhooks and LLM connectors</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 font-medium">Live Telemetry</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#737373" fontSize={12} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={12} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', color: '#fff' }} />
                      <Area type="monotone" dataKey="requests" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Manage Integrations</h2>
                  <p className="text-xs text-neutral-400">Configure external endpoints, AI engines, and secure webhook tunnels.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors cursor-pointer">
                  Add Integration
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {integrations.map((item) => (
                  <div key={item.id} className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 shadow-xs flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-emerald-400 shrink-0">
                        {item.type === 'LLM' && <Cpu className="w-5 h-5" />}
                        {item.type === 'Webhook' && <Webhook className="w-5 h-5" />}
                        {item.type === 'REST API' && <Globe className="w-5 h-5" />}
                        {item.type === 'Database' && <Database className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono font-medium">{item.type}</span>
                        </div>
                        <div className="text-xs font-mono text-neutral-400 mt-1">{item.endpoint}</div>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-neutral-500">
                          <span>Last sync: {item.lastSync}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-medium">{item.successRate}% reliability</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => {
                          setSelectedIntId(item.id);
                          setActiveTab('console');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-neutral-700 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer flex items-center space-x-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Test</span>
                      </button>
                      <button 
                        onClick={() => setIntegrations(integrations.filter(i => i.id !== item.id))}
                        className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-red-400 hover:border-red-800 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Live Test Console</h2>
                  <p className="text-xs text-neutral-400">Execute test payloads against connected APIs or Gemini AI models in real-time.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedIntId}
                    onChange={(e) => setSelectedIntId(e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-1.5 font-medium focus:outline-none">
                    {integrations.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Request Configuration</span>
                    <span className="text-xs font-mono text-neutral-500">POST /api/test</span>
                  </div>

                  {integrations.find(i => i.id === selectedIntId)?.type === 'LLM' ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-neutral-300">Prompt / Query for Gemini AI</label>
                      <textarea
                        rows={6}
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        className="w-full text-sm font-mono p-3 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-neutral-950 text-neutral-100"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">Target Endpoint URL</label>
                        <input
                          type="text"
                          value={testEndpoint}
                          onChange={(e) => setTestEndpoint(e.target.value)}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">JSON Payload</label>
                        <textarea
                          rows={6}
                          value={testPayload}
                          onChange={(e) => setTestPayload(e.target.value)}
                          className="w-full text-xs font-mono p-3 rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRunTest}
                    disabled={testing}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50">
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Transmitting Request...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Send Test Request</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-6 bg-neutral-950 text-neutral-100 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Response Inspector</span>
                      {testResult && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">200 OK</span>
                          <span className="text-xs text-neutral-400">{testResult.latencyMs || 240}ms</span>
                        </div>
                      )}
                    </div>

                    <div className="font-mono text-xs overflow-x-auto min-h-[220px] max-h-[320px] p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                      {testing ? (
                        <div className="flex items-center justify-center h-full text-neutral-500 py-16">
                          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                          <span>Waiting for endpoint response...</span>
                        </div>
                      ) : testResult ? (
                        <pre className="text-emerald-400">{JSON.stringify(testResult, null, 2)}</pre>
                      ) : (
                        <div className="text-neutral-500 py-16 text-center">
                          Click "Send Test Request" to inspect live payload exchange.
                        </div>
                      )}
                    </div>
                  </div>

                  {testResult && (
                    <div className="pt-4 flex items-center justify-between border-t border-neutral-800 mt-4">
                      <span className="text-xs text-neutral-400">Payload verified successfully</span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2))}
                        className="flex items-center space-x-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 px-3 py-1.5 rounded-md transition-colors cursor-pointer">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy Response'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Execution Audit Logs</h2>
                  <p className="text-xs text-neutral-400">Chronological trace of all requests, webhook dispatches, and LLM completions.</p>
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer flex items-center space-x-1">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="divide-y divide-neutral-800">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400 text-sm">No logs recorded yet. Run a test from the console.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-800/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="text-sm font-semibold text-white">{log.integrationName}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">{log.type}</span>
                        </div>
                        <div className="text-xs text-neutral-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()} • {log.latencyMs}ms latency
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-xs">
                <h2 className="text-base font-semibold text-white mb-1">Throughput Volume</h2>
                <p className="text-xs text-neutral-400 mb-6">Hourly request volume across all active endpoints</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <XAxis dataKey="time" stroke="#737373" fontSize={12} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={12} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', color: '#fff' }} />
                      <Bar dataKey="requests" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-white">Settlement Orchestrator</h2>
                    <p className="text-xs text-neutral-400">Hardened financial kernel tests. Securely routes transactions through internal double-entry accounting before provider settlement.</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 font-medium border border-emerald-800 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Kernel Hardened
                  </span>
                </div>

                <form onSubmit={handleSettle} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Amount</label>
                    <input
                      type="text"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full text-sm font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Currency</label>
                    <select
                      value={settleCurrency}
                      onChange={(e) => setSettleCurrency(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-white focus:outline-none font-mono">
                      <option value="USDC">USDC</option>
                      <option value="PLN">PLN</option>
                      <option value="BTC">BTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">Provider</label>
                    <select
                      value={settleProvider}
                      onChange={(e) => setSettleProvider(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-neutral-700 bg-neutral-900 text-white focus:outline-none font-mono">
                      <option value="PAYU">PayU Gateway</option>
                      <option value="STARKNET">Starknet L2</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={ledgerLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 h-[42px] flex justify-center items-center shadow-sm">
                    {ledgerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Authorize Settlement'}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
                    <h3 className="text-sm font-semibold text-white">Settlement Intents & Journal</h3>
                  </div>
                  <div className="divide-y divide-neutral-800 max-h-[400px] overflow-y-auto">
                    {ledgerData.settlement_intents.map((intent: any) => (
                      <div key={intent.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-medium text-white">{intent.id}</span>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{intent.provider}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                            intent.state === 'SETTLEMENT_CONFIRMED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 
                            intent.state === 'SETTLEMENT_FAILED' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {intent.state}
                          </span>
                        </div>
                        
                        <div className="bg-neutral-950 rounded p-2 text-xs font-mono space-y-1">
                          {ledgerData.journal_entries.filter((j: any) => j.intent_id === intent.id).map((entry: any) => (
                            <div key={entry.id} className="flex justify-between border-b border-neutral-800 last:border-0 pb-1 last:pb-0">
                              <span className={entry.type === 'CREDIT' ? 'text-emerald-400' : 'text-neutral-400'}>{entry.type}</span>
                              <span className="font-semibold">{entry.amount} {intent.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {ledgerData.settlement_intents.length === 0 && (
                      <div className="p-8 text-center text-neutral-400 text-xs">No settlements recorded.</div>
                    )}
                  </div>
                </div>

                <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-white">Cryptographic Audit Chain</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">APPEND-ONLY</span>
                    </div>
                    <button
                      onClick={handleDownloadAuditTrail}
                      className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer">
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Audit Trail</span>
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-800 max-h-[400px] overflow-y-auto">
                    {ledgerData.audit_logs.map((log: any) => (
                      <div key={log.id} className="p-4 text-xs font-mono space-y-2 hover:bg-neutral-800/40 transition-colors">
                        <div className="flex justify-between items-center text-white font-semibold">
                          <span>#{log.sequence_number} — {log.action}</span>
                          <span className="text-[10px] text-neutral-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-neutral-300 truncate bg-neutral-950 px-2 py-1 rounded">
                          Payload: {JSON.stringify(log.payload)}
                        </div>
                        <div className="text-[10px] space-y-0.5">
                          <div className="flex items-center text-neutral-400">
                            <span className="w-8 shrink-0">Prev:</span> 
                            <span className="truncate">{log.previous_hash}</span>
                          </div>
                          <div className="flex items-center text-white font-semibold">
                            <span className="w-8 shrink-0">Hash:</span> 
                            <span className="truncate text-emerald-400">{log.hash}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {ledgerData.audit_logs.length === 0 && (
                      <div className="p-8 text-center text-neutral-400 text-xs">No audit logs recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Issue New Debt Note Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Issue Secured Debt Note</h3>
              <button 
                onClick={() => setIsIssueModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Note ID / Identifier</label>
                <input
                  type="text"
                  value={newNoteId}
                  onChange={(e) => setNewNoteId(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Principal Value (USD)</label>
                <input
                  type="text"
                  value={newPrincipal}
                  onChange={(e) => setNewPrincipal(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Tranche Structure</label>
                <select
                  value={newTranche}
                  onChange={(e) => setNewTranche(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none">
                  <option value="SUPER-SENIOR TRANCHE">SUPER-SENIOR TRANCHE</option>
                  <option value="JUNIOR TRANCHE">JUNIOR TRANCHE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Settlement Network</label>
                <select
                  value={newNetwork}
                  onChange={(e) => setNewNetwork(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none">
                  <option value="Mainnet">Mainnet</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="Polygon">Polygon</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-700 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm cursor-pointer">
                  Submit for 4-Eyes Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Report Modal */}
      {auditReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-800 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Cryptographic Audit Report: {auditReportModal.note_id}</h3>
              <button 
                onClick={() => setAuditReportModal(null)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-neutral-300">
              <div><strong className="text-neutral-400">CUSIP:</strong> {auditReportModal.cusip}</div>
              <div><strong className="text-neutral-400">ISIN:</strong> {auditReportModal.isin}</div>
              <div><strong className="text-neutral-400">Principal:</strong> ${auditReportModal.principal}</div>
              <div><strong className="text-neutral-400">Compliance:</strong> {auditReportModal.compliance}</div>
              <div className="pt-2 border-t border-neutral-800">
                <strong className="text-neutral-400">Digital Signature Valid:</strong>{' '}
                <span className={auditReportModal.signature_valid ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {auditReportModal.signature_valid ? 'VERIFIED (RSA-SHA256)' : 'INVALID'}
                </span>
              </div>
              <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-[10px] break-all text-neutral-400 mt-2">
                Signature Hash: {auditReportModal.signature}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setAuditReportModal(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Integration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Register New Integration</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Integration Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Oracle ERP Connector"
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Integration Type</label>
                <select
                  value={newType}
                  onChange={(e: any) => setNewType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none">
                  <option value="REST API">REST API</option>
                  <option value="Webhook">Webhook</option>
                  <option value="LLM">LLM Connector</option>
                  <option value="Database">Database Connector</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Endpoint URL / Identifier</label>
                <input
                  type="text"
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  placeholder="https://api.service.com/v1"
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-700 text-xs font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm cursor-pointer">
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
