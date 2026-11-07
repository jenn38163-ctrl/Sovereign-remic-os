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
  Download
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
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations' | 'console' | 'logs' | 'analytics' | 'ledger'>('overview');
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Ledger State
  const [ledgerData, setLedgerData] = useState<any>({ journal_entries: [], audit_logs: [], settlement_intents: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [settleAmount, setSettleAmount] = useState('100.00');
  const [settleCurrency, setSettleCurrency] = useState('USDC');
  const [settleProvider, setSettleProvider] = useState('PAYU');

  // Fetch ledger data
  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/ledger/state');
      const data = await res.json();
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to fetch ledger', e);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerLoading(true);
    try {
      await fetch('/api/ledger/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: settleAmount, currency: settleCurrency, provider: settleProvider })
      });
      await fetchLedger();
    } catch (e) {
      console.error('Failed to settle', e);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleDownloadAuditTrail = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      tenant_id: 'tenant-demo',
      signature: 'sig_' + Math.random().toString(36).substring(2) + '_' + Date.now(),
      journal_entries: ledgerData.journal_entries,
      audit_logs: ledgerData.audit_logs,
      settlement_intents: ledgerData.settlement_intents
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
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

  // Fetch logs on mount
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/integrations/logs');
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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <Layers className="w-5 h-5 text-neutral-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Integration Hub</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                System Operational
              </span>
            </div>
            <p className="text-xs text-neutral-500">Unified API & Event Connector Studio</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>New Integration</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-3 pb-2">Workspace</div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <Activity className="w-4 h-4" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'integrations' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <Webhook className="w-4 h-4" />
            <span>Integrations ({integrations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'console' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <Terminal className="w-4 h-4" />
            <span>Live Test Console</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'logs' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <Clock className="w-4 h-4" />
            <span>Execution Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'analytics' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <BarChart3 className="w-4 h-4" />
            <span>Performance & Metrics</span>
          </button>
          
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-3 pb-2 pt-6">Agent Wallet OS</div>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'ledger' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
            }`}>
            <Wallet className="w-4 h-4" />
            <span>Financial Ledger</span>
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Endpoints</span>
                    <Globe className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-neutral-900">
                    {integrations.filter(i => i.status === 'ACTIVE').length} / {integrations.length}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">All core services healthy</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">24h Throughput</span>
                    <Activity className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-neutral-900">2,605 req</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">+12.4% from yesterday</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
                    <Clock className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-neutral-900">214 ms</div>
                  <div className="text-xs text-neutral-500 font-medium mt-1">Optimal response time</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
                    <ShieldCheck className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-neutral-900">99.3%</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">0 critical faults</div>
                </div>
              </div>

              {/* Main Chart Card */}
              <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-900">Request Traffic & Latency</h2>
                    <p className="text-xs text-neutral-500">Real-time throughput across all registered webhooks and LLM connectors</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 font-medium">Live Telemetry</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#171717" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#171717" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#a3a3a3" fontSize={12} tickLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="requests" stroke="#171717" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Connected Services Table Preview */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-900">Registered Integrations</h2>
                  <button 
                    onClick={() => setActiveTab('integrations')}
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center space-x-1 cursor-pointer">
                    <span>View all</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-neutral-200">
                  {integrations.slice(0, 4).map((item) => (
                    <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
                          {item.type === 'LLM' && <Cpu className="w-4 h-4" />}
                          {item.type === 'Webhook' && <Webhook className="w-4 h-4" />}
                          {item.type === 'REST API' && <Globe className="w-4 h-4" />}
                          {item.type === 'Database' && <Database className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{item.name}</div>
                          <div className="text-xs text-neutral-500 font-mono">{item.endpoint}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">{item.successRate}% success</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Manage Integrations</h2>
                  <p className="text-xs text-neutral-500">Configure external endpoints, AI engines, and secure webhook tunnels.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors cursor-pointer">
                  Add Integration
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {integrations.map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
                        {item.type === 'LLM' && <Cpu className="w-5 h-5" />}
                        {item.type === 'Webhook' && <Webhook className="w-5 h-5" />}
                        {item.type === 'REST API' && <Globe className="w-5 h-5" />}
                        {item.type === 'Database' && <Database className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-semibold text-neutral-900">{item.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono font-medium">{item.type}</span>
                        </div>
                        <div className="text-xs font-mono text-neutral-500 mt-1">{item.endpoint}</div>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-neutral-400">
                          <span>Last sync: {item.lastSync}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">{item.successRate}% reliability</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => {
                          setSelectedIntId(item.id);
                          setActiveTab('console');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer flex items-center space-x-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Test</span>
                      </button>
                      <button 
                        onClick={() => setIntegrations(integrations.filter(i => i.id !== item.id))}
                        className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Live Test Console</h2>
                  <p className="text-xs text-neutral-500">Execute test payloads against connected APIs or Gemini AI models in real-time.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedIntId}
                    onChange={(e) => setSelectedIntId(e.target.value)}
                    className="bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs rounded-lg px-3 py-1.5 font-medium focus:outline-none">
                    {integrations.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
                {/* Request Editor */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Request Configuration</span>
                    <span className="text-xs font-mono text-neutral-400">POST /api/test</span>
                  </div>

                  {integrations.find(i => i.id === selectedIntId)?.type === 'LLM' ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-neutral-700">Prompt / Query for Gemini AI</label>
                      <textarea
                        rows={6}
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        className="w-full text-sm font-mono p-3 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-neutral-50"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Target Endpoint URL</label>
                        <input
                          type="text"
                          value={testEndpoint}
                          onChange={(e) => setTestEndpoint(e.target.value)}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">JSON Payload</label>
                        <textarea
                          rows={6}
                          value={testPayload}
                          onChange={(e) => setTestPayload(e.target.value)}
                          className="w-full text-xs font-mono p-3 rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRunTest}
                    disabled={testing}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50">
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

                {/* Response Viewer */}
                <div className="p-6 bg-neutral-900 text-neutral-100 flex flex-col justify-between">
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

                    <div className="font-mono text-xs overflow-x-auto min-h-[220px] max-h-[320px] p-3 rounded-lg bg-neutral-950 border border-neutral-800">
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
            <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Execution Audit Logs</h2>
                  <p className="text-xs text-neutral-500">Chronological trace of all requests, webhook dispatches, and LLM completions.</p>
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer flex items-center space-x-1">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="divide-y divide-neutral-200">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500 text-sm">No logs recorded yet. Run a test from the console.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="text-sm font-semibold text-neutral-900">{log.integrationName}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono">{log.type}</span>
                        </div>
                        <div className="text-xs text-neutral-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()} • {log.latencyMs}ms latency
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
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
              <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-xs">
                <h2 className="text-base font-semibold text-neutral-900 mb-1">Throughput Volume</h2>
                <p className="text-xs text-neutral-500 mb-6">Hourly request volume across all active endpoints</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <XAxis dataKey="time" stroke="#a3a3a3" fontSize={12} tickLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#171717" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-xs">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-4">Integration Distribution</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600">Gemini AI LLM Engine</span>
                      <span className="font-semibold text-neutral-900">42%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-neutral-900 h-full w-[42%]"></div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-neutral-600">Webhook Receivers</span>
                      <span className="font-semibold text-neutral-900">28%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-neutral-700 h-full w-[28%]"></div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-neutral-600">REST API Connectors</span>
                      <span className="font-semibold text-neutral-900">20%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-neutral-500 h-full w-[20%]"></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 mb-1">Security & SSL Certificates</h3>
                    <p className="text-xs text-neutral-500">All outbound and inbound integration tunnels are secured with TLS 1.3 encryption and API token hashing.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center space-x-3 mt-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <span className="font-semibold">Zero Vulnerabilities</span> detected in webhook signature verification.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-900">Settlement Orchestrator</h2>
                    <p className="text-xs text-neutral-500">Hardened financial kernel tests. Securely routes transactions through internal double-entry accounting before provider settlement.</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Kernel Hardened
                  </span>
                </div>

                <form onSubmit={handleSettle} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Amount</label>
                    <input
                      type="text"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full text-sm font-mono p-2.5 rounded-lg border border-neutral-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Currency</label>
                    <select
                      value={settleCurrency}
                      onChange={(e) => setSettleCurrency(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-neutral-200 focus:outline-none font-mono">
                      <option value="USDC">USDC</option>
                      <option value="PLN">PLN</option>
                      <option value="BTC">BTC (Fails on PayU)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Provider</label>
                    <select
                      value={settleProvider}
                      onChange={(e) => setSettleProvider(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-neutral-200 focus:outline-none font-mono">
                      <option value="PAYU">PayU Gateway</option>
                      <option value="STARKNET">Starknet L2</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={ledgerLoading}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 h-[42px] flex justify-center items-center">
                    {ledgerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Authorize Settlement'}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
                    <h3 className="text-sm font-semibold text-neutral-900">Settlement Intents & Journal</h3>
                  </div>
                  <div className="divide-y divide-neutral-200 max-h-[400px] overflow-y-auto">
                    {ledgerData.settlement_intents.map((intent: any) => (
                      <div key={intent.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-medium text-neutral-900">{intent.id}</span>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{intent.provider}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                            intent.state === 'SETTLEMENT_CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 
                            intent.state === 'SETTLEMENT_FAILED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {intent.state}
                          </span>
                        </div>
                        
                        <div className="bg-neutral-50 rounded p-2 text-xs font-mono space-y-1">
                          {ledgerData.journal_entries.filter((j: any) => j.intent_id === intent.id).map((entry: any) => (
                            <div key={entry.id} className="flex justify-between border-b border-neutral-200/50 last:border-0 pb-1 last:pb-0">
                              <span className={entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-neutral-600'}>{entry.type}</span>
                              <span className="font-semibold">{entry.amount} {intent.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {ledgerData.settlement_intents.length === 0 && (
                      <div className="p-8 text-center text-neutral-500 text-xs">No settlements recorded.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-neutral-900">Cryptographic Audit Chain</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded font-mono">APPEND-ONLY</span>
                    </div>
                    <button
                      onClick={handleDownloadAuditTrail}
                      className="inline-flex items-center space-x-1.5 bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer">
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Audit Trail</span>
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-200 max-h-[400px] overflow-y-auto">
                    {ledgerData.audit_logs.map((log: any) => (
                      <div key={log.id} className="p-4 text-xs font-mono space-y-2 hover:bg-neutral-50 transition-colors">
                        <div className="flex justify-between items-center text-neutral-900 font-semibold">
                          <span>#{log.sequence_number} — {log.action}</span>
                          <span className="text-[10px] text-neutral-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-neutral-600 truncate bg-neutral-100 px-2 py-1 rounded">
                          Payload: {JSON.stringify(log.payload)}
                        </div>
                        <div className="text-[10px] space-y-0.5">
                          <div className="flex items-center text-neutral-500">
                            <span className="w-8 shrink-0">Prev:</span> 
                            <span className="truncate">{log.previous_hash}</span>
                          </div>
                          <div className="flex items-center text-neutral-900 font-semibold">
                            <span className="w-8 shrink-0">Hash:</span> 
                            <span className="truncate text-emerald-700">{log.hash}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {ledgerData.audit_logs.length === 0 && (
                      <div className="p-8 text-center text-neutral-500 text-xs">No audit logs recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Integration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900">Register New Integration</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Integration Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Salesforce Webhook"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Integration Type</label>
                <select
                  value={newType}
                  onChange={(e: any) => setNewType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none">
                  <option value="REST API">REST API</option>
                  <option value="Webhook">Webhook</option>
                  <option value="LLM">Gemini AI / LLM</option>
                  <option value="Database">Database Connector</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Endpoint URL / Connection String</label>
                <input
                  type="text"
                  required
                  placeholder="https://api.service.com/v1/webhook"
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium shadow-xs cursor-pointer">
                  Save Integration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
