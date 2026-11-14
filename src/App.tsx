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
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations' | 'console' | 'logs' | 'analytics' | 'ledger' | 'debt-notes' | 'ppm' | 'pools'>('ppm');
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Authentication & Role State for 4-Eyes Control Demo
  const [authToken, setAuthToken] = useState<string>('checker_token_456');
  const [userRole, setUserRole] = useState<string>('CHECKER');

  // Debt Note Registry State
  const [debtNotesData, setDebtNotesData] = useState<{ notes: any[], summary: any }>({ notes: [], summary: { total_principal_issued: '50071590.00', registry_count: 3, archived_count: 0 } });
  const [debtNotesLoading, setDebtNotesLoading] = useState(false);
  const [debtNoteFeedback, setDebtNoteFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [newNoteId, setNewNoteId] = useState('DN-1038');
  const [newPrincipal, setNewPrincipal] = useState('150000.00');
  const [newTranche, setNewTranche] = useState('JUNIOR TRANCHE');
  const [newNetwork, setNewNetwork] = useState('Ethereum');
  const [auditReportModal, setAuditReportModal] = useState<any>(null);

  // Collateral Asset Pools State
  const [poolsData, setPoolsData] = useState<{ pools: any[]; summary: any }>({
    pools: [],
    summary: { pool_count: 0, active_count: 0, perfected_and_link_ready_count: 0, total_principal_value: '0.00' }
  });
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolFeedback, setPoolFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [newPoolName, setNewPoolName] = useState('Sovereign Institutional REMIC Pool III');
  const [newPoolType, setNewPoolType] = useState('MORTGAGE_REMIC');
  const [newPoolPrincipal, setNewPoolPrincipal] = useState('25000000.00');
  const [newPoolCoupon, setNewPoolCoupon] = useState('9.25%');
  const [newPoolMaturity, setNewPoolMaturity] = useState('36');
  const [newPoolAssetCount, setNewPoolAssetCount] = useState('64');
  const [newPoolJurisdiction, setNewPoolJurisdiction] = useState('Delaware');
  const [newPoolDebtorName, setNewPoolDebtorName] = useState('Sovereign REMIC Trust III LLC');
  const [newPoolCustodian, setNewPoolCustodian] = useState('Malachite Fiduciary Trust (31 CFR Custody)');
  const [newPoolUccRef, setNewPoolUccRef] = useState('UCC-1 #DE-2026-44102');
  const [newPoolAssetsEvidenceRef, setNewPoolAssetsEvidenceRef] = useState('COLLATERAL-TAPE-AUDIT-2026-03');
  const [newPoolOwnershipRef, setNewPoolOwnershipRef] = useState('TITLE-DEED-SCHEDULE-2026-03');
  const [newPoolCustodyRef, setNewPoolCustodyRef] = useState('CUSTODY-ACK-MALACHITE-03');

  // Pool Stage Verification & Collateral Allocation Form State
  const [linkTargetType, setLinkTargetType] = useState<'DEBT_NOTE' | 'PPM_OFFERING'>('PPM_OFFERING');
  const [linkTargetId, setLinkTargetId] = useState('PPM-2026-SR1');
  const [linkAmount, setLinkAmount] = useState('5000000.00');
  const [stageReviewer, setStageReviewer] = useState('Elena Vance, Esq. (Collateral Counsel)');
  const [stageAssignRef, setStageAssignRef] = useState('ASSIGN-AUTH-2026-01');

  // PPM Offerings State
  const [ppmOfferings, setPpmOfferings] = useState<any[]>([]);
  const [ppmLoading, setPpmLoading] = useState(false);
  const [ppmFeedback, setPpmFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isPpmModalOpen, setIsPpmModalOpen] = useState(false);
  const [selectedPpmId, setSelectedPpmId] = useState<string | null>(null);

  // Draft New PPM Offering Modal Fields
  const [newPpmTitle, setNewPpmTitle] = useState('Sovereign Junior Secured Notes Tranche B');
  const [newPpmAmount, setNewPpmAmount] = useState('10000000.00');
  const [newPpmAffiliateAmount, setNewPpmAffiliateAmount] = useState('0.00');
  const [newPpmMinInvestment, setNewPpmMinInvestment] = useState('100000.00');
  const [newPpmMaturity, setNewPpmMaturity] = useState('36');
  const [newPpmExemption, setNewPpmExemption] = useState('RULE_506_C');
  const [newPpmInterest, setNewPpmInterest] = useState('9.5%');
  const [newPpmLinkedNoteId, setNewPpmLinkedNoteId] = useState('DN-1037');
  const [newPpmIsTokenized, setNewPpmIsTokenized] = useState(true);
  const [newPpmGeneralSolicitation, setNewPpmGeneralSolicitation] = useState(true);
  const [newPpmAuditedFinancials, setNewPpmAuditedFinancials] = useState(false);
  const [newPpmAuditorFirm, setNewPpmAuditorFirm] = useState('RSM US LLP');
  const [newPpmRegAStates, setNewPpmRegAStates] = useState('NV, DE');
  const [newPpmHasPlacementAgent, setNewPpmHasPlacementAgent] = useState(false);
  const [newPpmFinraMember, setNewPpmFinraMember] = useState(false);
  const [newPpmPlacementFirm, setNewPpmPlacementFirm] = useState('');
  const [newPpmRiskFactors, setNewPpmRiskFactors] = useState('Illiquidity of private debt securities\nSmart contract and settlement protocol risk\nRegulatory & SEC Release 33-11412 classification risk');
  const [newPpmUseOfProceeds, setNewPpmUseOfProceeds] = useState('Acquisition of secured mortgage-backed collateral pools and fiduciary custody reserves.');
  const [newPpmExpenses, setNewPpmExpenses] = useState('Legal, audit, and NASAA EFD / Nevada NAC 90.5145 notice filing fees.');
  const [newPpmFees, setNewPpmFees] = useState('Sponsor administration fee 1.0% p.a.; no undisclosed finder fees.');
  const [newPpmConflicts, setNewPpmConflicts] = useState('Affiliated servicing entity operates under fiduciary oversight agreement.');
  const [newPpmEligibility, setNewPpmEligibility] = useState('Verified Accredited Investors under Rule 506(c) documentary verification.');
  const [newPpmTransferRestrictions, setNewPpmTransferRestrictions] = useState('Restricted securities pursuant to Securities Act Rule 144 and statutory lockups.');

  // Counsel Review Form State
  const [counselName, setCounselName] = useState('Elena Vance, Esq.');
  const [counselBarRef, setCounselBarRef] = useState('Sovereign Compliance & Legal Counsel LLP (Bar #NV-88421)');
  const [counselScope, setCounselScope] = useState('Federal/State exemption pathway, PPM disclosures & SEC Release 33-11412');
  const [counselDecision, setCounselDecision] = useState<'APPROVED' | 'CONDITIONAL' | 'REJECTED'>('APPROVED');
  const [counselEvidenceRef, setCounselEvidenceRef] = useState('COUNSEL-OPINION-2026-01');

  // Investor Onboarding Form Fields (inside Compliance Modal)
  const [invLabel, setInvLabel] = useState('Horizon Institutional Credit Fund LP');
  const [invAccredited, setInvAccredited] = useState(true);
  const [invVerificationMethod, setInvVerificationMethod] = useState('THIRD_PARTY_CPA_ATTORNEY');
  const [invEvidenceRef, setInvEvidenceRef] = useState('CPA-VERIF-2026-8841');
  const [invSolicitedBy, setInvSolicitedBy] = useState('Issuer Direct Officer (No FINRA Agent)');
  const [invState, setInvState] = useState('NV');
  const [invAmount, setInvAmount] = useState('250000.00');
  const [invIncomeUsd, setInvIncomeUsd] = useState('3500000.00');
  const [invNetWorthUsd, setInvNetWorthUsd] = useState('5000000.00');
  const [invTier2CapVerified, setInvTier2CapVerified] = useState(true);
  const [inv501eWeight, setInv501eWeight] = useState('1');
  const [inv501eReason, setInv501eReason] = useState('');
  const [invQaAck, setInvQaAck] = useState(true);
  const [inv502bDelivered, setInv502bDelivered] = useState(true);
  const [invSophisticated, setInvSophisticated] = useState(true);
  const [invUsPerson, setInvUsPerson] = useState(true);

  const [auditVerifyResult, setAuditVerifyResult] = useState<any>(null);

  const selectedPpmDetail = ppmOfferings.find(o => o.id === selectedPpmId) || null;
  const selectedPoolDetail = poolsData.pools.find(p => p.id === selectedPoolId) || null;

  const fetchPpmOfferings = async () => {
    setPpmLoading(true);
    try {
      const res = await fetch('/api/ppm/offerings', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.offerings) {
        setPpmOfferings(data.offerings);
      }
    } catch (e) {
      console.error('Failed to fetch PPM offerings', e);
    } finally {
      setPpmLoading(false);
    }
  };

  const fetchPools = async () => {
    setPoolsLoading(true);
    try {
      const res = await fetch('/api/pools', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.pools) {
        setPoolsData(data);
      }
    } catch (e) {
      console.error('Failed to fetch asset pools', e);
    } finally {
      setPoolsLoading(false);
    }
  };

  useEffect(() => {
    fetchPpmOfferings();
    fetchPools();
  }, [authToken]);

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoolFeedback(null);
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          pool_name: newPoolName,
          pool_type: newPoolType,
          total_principal_value: newPoolPrincipal,
          weighted_avg_coupon: newPoolCoupon,
          weighted_avg_maturity_months: Number(newPoolMaturity),
          asset_count: Number(newPoolAssetCount),
          jurisdiction: newPoolJurisdiction,
          debtor_legal_name: newPoolDebtorName,
          custodian: newPoolCustodian,
          ucc_filing_ref: newPoolUccRef,
          underlying_assets_evidence_ref: newPoolAssetsEvidenceRef,
          ownership_evidence_ref: newPoolOwnershipRef,
          custody_evidence_ref: newPoolCustodyRef
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsPoolModalOpen(false);
        setActiveTab('pools');
        setPoolFeedback({
          type: 'success',
          message: `Created collateral pool ${data.pool.id} ($${Number(data.pool.total_principal_value).toLocaleString()}). Pending 4-eyes approval and 8-stage legal perfection review before offering linkage.`
        });
        await fetchPools();
      } else {
        setPoolFeedback({ type: 'error', message: data.error || 'Failed to create asset pool' });
      }
    } catch (e: any) {
      setPoolFeedback({ type: 'error', message: e.message });
    }
  };

  const handleApprovePool = async (id: string) => {
    setPoolFeedback(null);
    try {
      const res = await fetch(`/api/pools/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setPoolFeedback({ type: 'success', message: data.message });
        await fetchPools();
      } else {
        setPoolFeedback({ type: 'error', message: data.error || 'Pool approval failed' });
      }
    } catch (e: any) {
      setPoolFeedback({ type: 'error', message: e.message });
    }
  };

  const handleVerifyPoolStages = async (pool: any, patch: Record<string, any>) => {
    setPoolFeedback(null);
    try {
      const res = await fetch(`/api/pools/${pool.id}/verify-stages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (data.success) {
        setPoolFeedback({
          type: 'success',
          message: data.link_readiness?.ready_for_linkage
            ? `All 8 collateral perfection & verification stages cleared for ${pool.id}.`
            : `Updated verification stages for ${pool.id}. Remaining: ${(data.link_readiness?.missing_stages || []).length} stage(s).`
        });
        await fetchPools();
      } else {
        setPoolFeedback({ type: 'error', message: data.error || 'Verification update failed' });
      }
    } catch (e: any) {
      setPoolFeedback({ type: 'error', message: e.message });
    }
  };

  const handleLinkPool = async (e: React.FormEvent, poolId: string) => {
    e.preventDefault();
    setPoolFeedback(null);
    try {
      const payload =
        linkTargetType === 'DEBT_NOTE'
          ? { debt_note_id: linkTargetId, allocated_amount: linkAmount }
          : { ppm_id: linkTargetId, allocated_amount: linkAmount };
      const res = await fetch(`/api/pools/${poolId}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setPoolFeedback({
          type: 'success',
          message: `Linked $${Number(linkAmount).toLocaleString()} of pool ${poolId} collateral to ${linkTargetId}. Remaining unpledged: $${Number(data.link_readiness?.available_principal || 0).toLocaleString()}.`
        });
        await fetchPools();
        await fetchPpmOfferings();
      } else {
        setPoolFeedback({ type: 'error', message: data.error || 'Collateral linkage rejected' });
      }
    } catch (e: any) {
      setPoolFeedback({ type: 'error', message: e.message });
    }
  };

  const handleCreatePpm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPpmFeedback(null);
    try {
      const parsedStates = newPpmRegAStates
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
        .map(state => ({ state, status: 'REGISTERED', filing_ref: `STATE-REG-${state}-2026` }));

      const res = await fetch('/api/ppm/offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: newPpmTitle,
          exemption_pathway: newPpmExemption,
          offering_amount: newPpmAmount,
          affiliate_offering_amount: newPpmAffiliateAmount,
          minimum_investment: newPpmMinInvestment,
          maturity_months: Number(newPpmMaturity),
          target_interest_rate: newPpmInterest,
          linked_debt_note_id: newPpmLinkedNoteId,
          is_tokenized_security: newPpmIsTokenized,
          general_solicitation_used: newPpmExemption === 'RULE_506_B' ? false : newPpmGeneralSolicitation,
          audited_financials_attached: newPpmAuditedFinancials,
          auditor_firm: newPpmAuditedFinancials ? newPpmAuditorFirm : '',
          reg_a_state_registrations: newPpmExemption === 'REG_A_TIER_1' ? parsedStates : [],
          ongoing_sec_reporting: { form_1u_monitoring_enabled: newPpmExemption === 'REG_A_TIER_2' },
          risk_factors: newPpmRiskFactors.split('\n').map(s => s.trim()).filter(Boolean),
          use_of_proceeds: newPpmUseOfProceeds,
          offering_expenses: newPpmExpenses,
          fees_and_compensation: newPpmFees,
          conflicts_of_interest: newPpmConflicts,
          investor_eligibility: newPpmEligibility,
          transfer_restrictions: newPpmTransferRestrictions,
          placement_agent: {
            has_placement_agent: newPpmHasPlacementAgent,
            finra_member: newPpmFinraMember,
            firm_name: newPpmPlacementFirm,
            sales_compensation_disclosed: true
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsPpmModalOpen(false);
        setPpmFeedback({ type: 'success', message: `Drafted ${data.offering.id} (SHA-256: ${data.offering.document_sha256.slice(0, 12)}...). Pending distinct-individual 4-eyes approval & counsel review.` });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'Failed to create PPM offering' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

  const handleApprovePpm = async (id: string) => {
    setPpmFeedback(null);
    try {
      const res = await fetch(`/api/ppm/offerings/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setPpmFeedback({ type: 'success', message: data.message });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'PPM approval failed' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

  const handleCounselReviewPpm = async (id: string, isTokenized: boolean) => {
    setPpmFeedback(null);
    try {
      const res = await fetch(`/api/ppm/offerings/${id}/counsel-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          reviewer_name: counselName,
          firm_or_bar_ref: counselBarRef,
          scope: counselScope,
          decision: counselDecision,
          evidence_ref: isTokenized ? `MEMO-SEC-33-11412-${id}` : `${counselEvidenceRef}-${id}`,
          counsel_selected_pathway: counselDecision !== 'REJECTED',
          tokenized_asset_classification_verified: isTokenized ? counselDecision !== 'REJECTED' : false,
          tokenized_counsel_memo_ref: isTokenized ? `MEMO-SEC-33-11412-${id}` : undefined,
          rule_152_counsel_clearance: true,
          form_1a_qualified: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setPpmFeedback({ type: 'success', message: data.message });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'Counsel review recording failed' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

  const handleBadActorScreen = async (id: string) => {
    setPpmFeedback(null);
    try {
      const res = await fetch(`/api/ppm/offerings/${id}/bad-actor-screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          covered_persons: [
            {
              name: 'Sovereign REMIC Manager LLC',
              role: 'Issuer / Managing Member',
              inquiry_date: new Date().toISOString().slice(0, 10),
              disqualifying_event_found: false,
              evidence_ref: `506D-INQUIRY-${id}-01`
            }
          ],
          bad_actor_written_disclosure_delivered: false
        })
      });
      const data = await res.json();
      if (data.success) {
        setPpmFeedback({ type: 'success', message: `Rule 506(d) Bad-Actor factual inquiry recorded for ${id}.` });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'Bad-actor screening failed' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

  const handleOnboardInvestor = async (e: React.FormEvent, off: any) => {
    e.preventDefault();
    setPpmFeedback(null);
    try {
      const res = await fetch(`/api/ppm/offerings/${off.id}/investors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          investor_label: invLabel,
          accredited: invAccredited,
          verification_method: invVerificationMethod,
          verification_evidence_ref: invEvidenceRef,
          solicited_by: invSolicitedBy,
          state_of_residence: invState,
          investment_amount: invAmount,
          annual_income_or_revenue_usd: invIncomeUsd,
          net_worth_or_assets_usd: invNetWorthUsd,
          reg_a_tier2_10pct_cap_verified: invTier2CapVerified,
          rule_501e_counting_weight: Number(inv501eWeight || 1),
          rule_501e_exclusion_reason: inv501eReason,
          ppm_version_delivered: off.version,
          ppm_hash_delivered: off.document_sha256,
          q_and_a_acknowledged: invQaAck,
          rule_502b_disclosures_delivered: inv502bDelivered,
          sophisticated_verified: invSophisticated,
          is_us_person: invUsPerson
        })
      });
      const data = await res.json();
      if (data.success) {
        setPpmFeedback({
          type: 'success',
          message: `Onboarded ${data.investor.investor_label}. Deadlines updated — Form D: ${data.deadlines.federal_form_d_due || 'N/A'}${data.deadlines.nevada_nac_90_5145_due ? ` | Nevada NAC 90.5145 ($500): ${data.deadlines.nevada_nac_90_5145_due}` : ''}`
        });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'Investor onboarding blocked by compliance gate' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

  const handleVerifyAuditChain = async () => {
    try {
      const res = await fetch('/api/audit/verify', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setAuditVerifyResult(data);
    } catch (e: any) {
      setAuditVerifyResult({ valid: false, errors: [e.message] });
    }
  };

  const handleMarkFiling = async (off: any, kind: 'FORM_D' | 'NEVADA' | 'FINRA_5123') => {
    setPpmFeedback(null);
    const body: any = {};
    if (kind === 'FORM_D') {
      body.form_d_tracking = { filed: true, accession_number: `0001999-${Date.now().toString().slice(-6)}` };
    } else if (kind === 'NEVADA') {
      body.nevada_nac_90_5145 = { status: 'FILED', filing_ref: `NV-NAC90-${Date.now().toString().slice(-6)}` };
    } else if (kind === 'FINRA_5123') {
      body.finra_5123_filing = { filing_status: 'FILED', filing_ref: `FINRA-5123-${Date.now().toString().slice(-6)}` };
    }
    try {
      const res = await fetch(`/api/ppm/offerings/${off.id}/filings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setPpmFeedback({ type: 'success', message: `${kind} filing status updated for ${off.id}.` });
        await fetchPpmOfferings();
      } else {
        setPpmFeedback({ type: 'error', message: data.error || 'Filing update failed' });
      }
    } catch (e: any) {
      setPpmFeedback({ type: 'error', message: e.message });
    }
  };

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
    setDebtNoteFeedback(null);
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
        setDebtNoteFeedback({ type: 'success', message: `Issued debt note ${data.note.id}. Pending distinct-individual 4-eyes Checker approval.` });
        await fetchDebtNotes();
      } else {
        setDebtNoteFeedback({ type: 'error', message: data.error || 'Failed to issue note' });
      }
    } catch (e: any) {
      setDebtNoteFeedback({ type: 'error', message: e.message });
    }
  };

  const handleApproveNote = async (id: string) => {
    setDebtNoteFeedback(null);
    try {
      const res = await fetch(`/api/debt-notes/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setDebtNoteFeedback({ type: 'success', message: data.message });
        await fetchDebtNotes();
      } else {
        setDebtNoteFeedback({ type: 'error', message: data.error || 'Approval failed (Maker-Checker violation check)' });
      }
    } catch (e: any) {
      setDebtNoteFeedback({ type: 'error', message: e.message });
    }
  };

  const handleDeleteNote = async (id: string) => {
    setDebtNoteFeedback(null);
    try {
      const res = await fetch(`/api/debt-notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setDebtNoteFeedback({ type: 'success', message: data.message });
        await fetchDebtNotes();
      } else {
        setDebtNoteFeedback({ type: 'error', message: data.error || 'Archive failed' });
      }
    } catch (e: any) {
      setDebtNoteFeedback({ type: 'error', message: e.message });
    }
  };

  const handleViewAuditReport = async (id: string) => {
    setDebtNoteFeedback(null);
    try {
      const res = await fetch(`/api/debt-notes/${id}/audit`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      setAuditReportModal(data);
    } catch (e: any) {
      setDebtNoteFeedback({ type: 'error', message: e.message });
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
        setDebtNoteFeedback({ type: 'error', message: 'Failed to parse uploaded JSON package: ' + err.message });
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
              <h1 className="text-lg font-semibold tracking-tight text-white">Sovereign REMIC OS v19</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 font-medium border border-amber-800">
                Candidate — Acceptance Pending
              </span>
            </div>
            <p className="text-xs text-neutral-400">Institutional Secured Debt Instrument, Collateral Perfection & Securities Offering Control Plane</p>
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
              if (val.includes('alias') || val.includes('checker')) setUserRole('CHECKER');
              else if (val.includes('maker')) setUserRole('MAKER');
              else if (val.includes('admin')) setUserRole('ADMIN');
              else setUserRole('AUDITOR');
            }}
            className="bg-neutral-900 border border-neutral-700 text-emerald-400 text-xs rounded-lg px-3 py-1 font-mono font-semibold focus:outline-none">
            <option value="checker_token_456">Bob Checker (Risk Officer - CHECKER)</option>
            <option value="maker_token_123">Alice Maker (Treasury - MAKER)</option>
            <option value="maker_alias_checker_token">Alice Alt Account (Same Individual - CHECKER)</option>
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
            onClick={() => { setActiveTab('pools'); setIsPoolModalOpen(true); }}
            className="inline-flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer">
            <Database className="w-4 h-4" />
            <span>Add Pool</span>
          </button>

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
            onClick={() => setActiveTab('ppm')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'ppm' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Layers className="w-4 h-4" />
            <span>PPM & Offerings</span>
          </button>
          <button
            onClick={() => setActiveTab('pools')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'pools' ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}>
            <Database className="w-4 h-4" />
            <span>Collateral Pools ({poolsData.pools.length})</span>
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

                {debtNoteFeedback && (
                  <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    debtNoteFeedback.type === 'error'
                      ? 'bg-red-950/50 border-red-800 text-red-300'
                      : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                  }`}>
                    <span>{debtNoteFeedback.message}</span>
                    <button onClick={() => setDebtNoteFeedback(null)} className="text-neutral-400 hover:text-white ml-4 cursor-pointer">✕</button>
                  </div>
                )}

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

          {activeTab === 'ppm' && (
            <div className="space-y-6">
              {/* PPM Header Banner */}
              <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Layers className="w-6 h-6 text-emerald-400" />
                      <h2 className="text-xl font-bold tracking-tight text-white">Private Placement Memorandum (PPM) & Securities Offering Compliance</h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Operative Pathways: Rule 506(b), Rule 506(c), Reg A Tier 1/2, Reg S • FINRA 5123, Form D & Nevada NAC 90.5145 Gates
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPpmModalOpen(true)}
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>Draft New Offering</span>
                  </button>
                </div>

                {/* Legal Counsel Review & Regulatory Non-Clearance Notice */}
                <div className="bg-amber-950/40 border border-amber-800/80 text-amber-300 p-4 rounded-xl text-xs flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold uppercase tracking-wider block">Legal Counsel Review & Regulatory Boundaries</span>
                    <p>
                      A generated Private Placement Memorandum (PPM) or passing software compliance gates must NOT be treated as SEC qualification, FINRA clearance, or legal authorization to distribute securities. Proposed Regulation Crypto Assets is non-operative and blocked. Tokenized instruments remain subject to federal securities laws (SEC Release 33-11412).
                    </p>
                  </div>
                </div>

                {ppmFeedback && (
                  <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    ppmFeedback.type === 'error'
                      ? 'bg-red-950/50 border-red-800 text-red-300'
                      : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                  }`}>
                    <span>{ppmFeedback.message}</span>
                    <button onClick={() => setPpmFeedback(null)} className="text-neutral-400 hover:text-white ml-4 cursor-pointer">✕</button>
                  </div>
                )}
              </div>

              {/* Compliance Summary Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                  <div className="text-[10px] font-mono uppercase text-neutral-400">Operative Offerings</div>
                  <div className="text-2xl font-bold text-white mt-1">{ppmOfferings.length}</div>
                  <div className="text-[11px] text-emerald-400 mt-1">
                    {ppmOfferings.filter(o => o.compliance_evaluation?.distribution_ready).length} Gates Clear (Internal)
                  </div>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                  <div className="text-[10px] font-mono uppercase text-neutral-400">Tokenized Security Gate</div>
                  <div className="text-sm font-bold text-white mt-1 font-mono">SEC Rel. 33-11412</div>
                  <div className="text-[11px] text-neutral-400 mt-1">Blockchain ≠ Exemption</div>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                  <div className="text-[10px] font-mono uppercase text-neutral-400">Nevada Notice Rule</div>
                  <div className="text-sm font-bold text-white mt-1 font-mono">NAC 90.5145 ($500)</div>
                  <div className="text-[11px] text-neutral-400 mt-1">15-day trigger • 1-yr term</div>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                  <div className="text-[10px] font-mono uppercase text-neutral-400">FINRA Member Rule</div>
                  <div className="text-sm font-bold text-white mt-1 font-mono">Rule 5123 / SR-2026-002</div>
                  <div className="text-[11px] text-neutral-400 mt-1">15-day filing • 501(a)(9)/(12) gated</div>
                </div>
              </div>

              {/* Offerings Table */}
              <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-white">Offering Memoranda, Release-Blocking Gates & Statutory Clocks</h3>
                  <span className="text-xs font-mono text-neutral-400">{ppmLoading ? 'Refreshing...' : `${ppmOfferings.length} Offerings Registered`}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-400 bg-neutral-950/60 font-mono">
                        <th className="px-6 py-4">Offering & Immutable Hash</th>
                        <th className="px-6 py-4">Pathway & Asset Gate</th>
                        <th className="px-6 py-4">Size / Subscribers</th>
                        <th className="px-6 py-4">Compliance Gates</th>
                        <th className="px-6 py-4">Workflow Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {ppmOfferings.map((off) => {
                        const evalData = off.compliance_evaluation;
                        const blockerCount = evalData?.blockers?.length ?? 0;
                        return (
                          <tr key={off.id} className="hover:bg-neutral-800/40 transition-colors font-mono text-xs">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{off.title}</div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">
                                {off.id} • v{off.version || 1} • SHA-256: {(off.document_sha256 || '').slice(0, 12)}...
                              </div>
                            </td>
                            <td className="px-6 py-4 space-y-1">
                              <span className="inline-block px-2.5 py-0.5 rounded bg-neutral-800 text-emerald-400 border border-neutral-700 font-semibold text-[11px]">
                                {off.exemption_pathway}
                              </span>
                              {off.is_tokenized_security && (
                                <div className={`text-[10px] ${off.tokenized_asset_classification_verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {off.tokenized_asset_classification_verified ? '✓ 33-11412 Tokenized Verified' : '⚠ 33-11412 Classification Required'}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-white">${Number(off.offering_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              <div className="text-[10px] text-neutral-400 mt-0.5">
                                {(off.investor_records || []).length} subscribers • {off.target_interest_rate}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {blockerCount === 0 ? (
                                <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>All Gates Passed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-amber-400 font-semibold">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>{blockerCount} Blocker(s)</span>
                                </span>
                              )}
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                506(d): {off.bad_actor_screened ? 'Screened' : 'Pending'} • Counsel: {off.counsel_reviewed ? 'Yes' : 'No'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                off.status === 'DISTRIBUTION_READY' || off.status === 'COUNSEL_REVIEWED' || off.status === 'APPROVED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}>
                                {off.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedPpmId(off.id)}
                                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold cursor-pointer">
                                Gates & Investors
                              </button>
                              {!off.approved_by && (
                                <button
                                  onClick={() => handleApprovePpm(off.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer">
                                  Approve (4-Eyes)
                                </button>
                              )}
                              {!off.counsel_reviewed && (
                                <button
                                  onClick={() => handleCounselReviewPpm(off.id, Boolean(off.is_tokenized_security))}
                                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-300 text-xs font-semibold border border-neutral-700 cursor-pointer">
                                  Counsel Sign-off
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {ppmOfferings.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-neutral-400">No PPM offerings drafted yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pools' && (
            <div className="space-y-6">
              <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Database className="w-6 h-6 text-emerald-400" />
                      <h2 className="text-xl font-bold tracking-tight text-white">REMIC Collateral Asset Pools</h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Custoded Mortgage & Fixed-Income Collateral Pools Linked to Debt Notes & PPM Offerings
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPoolModalOpen(true)}
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>Add Pool</span>
                  </button>
                </div>

                {poolFeedback && (
                  <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    poolFeedback.type === 'error'
                      ? 'bg-red-950/50 border-red-800 text-red-300'
                      : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                  }`}>
                    <span>{poolFeedback.message}</span>
                    <button onClick={() => setPoolFeedback(null)} className="text-neutral-400 hover:text-white ml-4 cursor-pointer">✕</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                  <div className="text-xs font-mono uppercase text-neutral-400">Total Pooled Principal</div>
                  <div className="text-2xl font-bold text-white mt-1 font-mono">
                    ${Number(poolsData.summary?.total_principal_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                  <div className="text-xs font-mono uppercase text-neutral-400">Registered Asset Pools</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{poolsData.summary?.pool_count || poolsData.pools.length}</div>
                </div>
                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                  <div className="text-xs font-mono uppercase text-neutral-400">Active Custoded Pools</div>
                  <div className="text-2xl font-bold text-white mt-1 font-mono">{poolsData.summary?.active_count || 0}</div>
                </div>
                <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800">
                  <div className="text-xs font-mono uppercase text-neutral-400">Perfected & Link-Ready</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{poolsData.summary?.perfected_and_link_ready_count || 0}</div>
                </div>
              </div>

              <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-white">Authoritative Collateral Pool Registry (UCC-1 Ref ≠ Legal Perfection)</h3>
                  <span className="text-xs font-mono text-neutral-400">{poolsLoading ? 'Refreshing...' : `${poolsData.pools.length} Pools`}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-400 bg-neutral-950/60 font-mono">
                        <th className="px-6 py-4">Pool ID & Debtor</th>
                        <th className="px-6 py-4">Type & UCC Ref</th>
                        <th className="px-6 py-4">Principal & Unpledged Capacity</th>
                        <th className="px-6 py-4">8-Stage Perfection</th>
                        <th className="px-6 py-4">Linked Obligations</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {poolsData.pools.map((pool) => {
                        const readiness = pool.link_readiness;
                        const missingCount = readiness?.missing_stages?.length ?? 8;
                        return (
                          <tr key={pool.id} className="hover:bg-neutral-800/40 transition-colors font-mono text-xs">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{pool.pool_name}</div>
                              <div className="text-[11px] text-neutral-400 mt-0.5">{pool.id} • {pool.jurisdiction} • {pool.debtor_legal_name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-block px-2 py-0.5 rounded bg-neutral-800 text-emerald-400 border border-neutral-700 text-[10px] font-semibold">
                                {pool.pool_type}
                              </span>
                              <div className="text-[10px] text-neutral-400 mt-1">{pool.ucc_filing_ref || 'No UCC Ref'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-white">
                                ${Number(pool.total_principal_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-emerald-400 mt-0.5">
                                Available: ${Number(readiness?.available_principal ?? pool.total_principal_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {readiness?.ready_for_linkage ? (
                                <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>8/8 Verified</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-amber-400 font-semibold">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>{missingCount} Stage(s) Pending</span>
                                </span>
                              )}
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                {pool.weighted_avg_coupon} • {pool.asset_count} assets
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[11px]">
                              <div className="text-neutral-300">Notes: {(pool.linked_debt_note_ids || []).join(', ') || 'None'}</div>
                              <div className="text-emerald-400">PPMs: {(pool.linked_ppm_ids || []).join(', ') || 'None'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                pool.status === 'ACTIVE_CUSTODED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}>
                                {pool.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedPoolId(pool.id)}
                                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold cursor-pointer">
                                Perfection & Link
                              </button>
                              {pool.status === 'PENDING_CHECKER_APPROVAL' && (
                                <button
                                  onClick={() => handleApprovePool(pool.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer">
                                  Approve (4-Eyes)
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {poolsData.pools.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-neutral-400">No collateral pools registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
                  <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50 flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-white">Cryptographic Audit Chain</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">APPEND-ONLY</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleVerifyAuditChain}
                        className="inline-flex items-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Chain & Checkpoint</span>
                      </button>
                      <button
                        onClick={handleDownloadAuditTrail}
                        className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer">
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Audit Trail</span>
                      </button>
                    </div>
                  </div>
                  {auditVerifyResult && (
                    <div className={`px-6 py-3 border-b border-neutral-800 text-xs font-mono ${
                      auditVerifyResult.valid ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'
                    }`}>
                      {auditVerifyResult.valid
                        ? `✓ CHAIN VERIFIED • Seq #${auditVerifyResult.checkpoint?.latest_sequence || 0} • Merkle Root: ${(auditVerifyResult.checkpoint?.merkle_root || '').slice(0, 16)}...`
                        : `✗ AUDIT INTEGRITY FAILURE: ${(auditVerifyResult.errors || []).join('; ')}`}
                    </div>
                  )}
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

      {/* Draft New PPM Offering Modal */}
      {isPpmModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-800 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Draft New Private Placement Memorandum (PPM)</h3>
                <p className="text-[11px] text-neutral-400">Requires 4-eyes Checker approval & qualified securities counsel pathway sign-off.</p>
              </div>
              <button
                onClick={() => setIsPpmModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePpm} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Offering Title</label>
                  <input
                    type="text"
                    value={newPpmTitle}
                    onChange={(e) => setNewPpmTitle(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Operative Exemption Pathway</label>
                  <select
                    value={newPpmExemption}
                    onChange={(e) => setNewPpmExemption(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono">
                    <option value="RULE_506_C">RULE_506_C (Accredited Only + Documentary Verification)</option>
                    <option value="RULE_506_B">RULE_506_B (No Solicitation, ≤35 Non-Accr in Offering)</option>
                    <option value="REG_A_TIER_1">REG_A_TIER_1 (Cap $20M / 12mo + State Blue-Sky)</option>
                    <option value="REG_A_TIER_2">REG_A_TIER_2 (Cap $75M / 12mo + Audited Financials)</option>
                    <option value="REG_S">REG_S (Offshore Non-US Persons Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Offering Size (USD)</label>
                  <input
                    type="text"
                    value={newPpmAmount}
                    onChange={(e) => setNewPpmAmount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Affiliate Sales (USD)</label>
                  <input
                    type="text"
                    value={newPpmAffiliateAmount}
                    onChange={(e) => setNewPpmAffiliateAmount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Min. Investment</label>
                  <input
                    type="text"
                    value={newPpmMinInvestment}
                    onChange={(e) => setNewPpmMinInvestment(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Maturity (Months)</label>
                  <input
                    type="number"
                    value={newPpmMaturity}
                    onChange={(e) => setNewPpmMaturity(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Target Rate</label>
                  <input
                    type="text"
                    value={newPpmInterest}
                    onChange={(e) => setNewPpmInterest(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
              </div>

              {(newPpmExemption === 'REG_A_TIER_1' || newPpmExemption === 'REG_A_TIER_2') && (
                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                  <div className="font-semibold text-emerald-400">
                    {newPpmExemption === 'REG_A_TIER_1'
                      ? 'Regulation A Tier 1 ($20M Max / $6M Affiliate • State Blue-Sky Required)'
                      : 'Regulation A Tier 2 ($75M Max / $22.5M Affiliate • Audited Financials + Form 1-K/1-SA/1-U)'}
                  </div>
                  {newPpmExemption === 'REG_A_TIER_1' ? (
                    <div>
                      <label className="block text-neutral-400 mb-1">State Blue-Sky Registrations (Comma-separated codes)</label>
                      <input
                        type="text"
                        value={newPpmRegAStates}
                        onChange={(e) => setNewPpmRegAStates(e.target.value)}
                        className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                      <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPpmAuditedFinancials}
                          onChange={(e) => setNewPpmAuditedFinancials(e.target.checked)}
                        />
                        <span>Audited Financial Statements Attached</span>
                      </label>
                      <input
                        type="text"
                        value={newPpmAuditorFirm}
                        onChange={(e) => setNewPpmAuditorFirm(e.target.value)}
                        placeholder="Independent Auditor Firm"
                        className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPpmIsTokenized}
                    onChange={(e) => setNewPpmIsTokenized(e.target.checked)}
                    className="rounded border-neutral-700"
                  />
                  <span>Tokenized / On-Chain Note (Triggers SEC 33-11412 Gate)</span>
                </label>
                <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPpmExemption === 'RULE_506_B' ? false : newPpmGeneralSolicitation}
                    disabled={newPpmExemption === 'RULE_506_B'}
                    onChange={(e) => setNewPpmGeneralSolicitation(e.target.checked)}
                    className="rounded border-neutral-700"
                  />
                  <span>General Solicitation Used (Blocked for 506(b))</span>
                </label>
                <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPpmHasPlacementAgent}
                    onChange={(e) => setNewPpmHasPlacementAgent(e.target.checked)}
                    className="rounded border-neutral-700"
                  />
                  <span>Placement Agent / Broker-Dealer Participates</span>
                </label>
                <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPpmFinraMember}
                    disabled={!newPpmHasPlacementAgent}
                    onChange={(e) => setNewPpmFinraMember(e.target.checked)}
                    className="rounded border-neutral-700"
                  />
                  <span>FINRA Member (Triggers Rule 5123 Filing Clock)</span>
                </label>
              </div>

              {newPpmHasPlacementAgent && (
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Placement Agent Firm Name & CRD</label>
                  <input
                    type="text"
                    value={newPpmPlacementFirm}
                    onChange={(e) => setNewPpmPlacementFirm(e.target.value)}
                    placeholder="e.g., Sovereign Placement Partners LLC (CRD #123456)"
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-neutral-300 mb-1">Linked Debt Note ID</label>
                <input
                  type="text"
                  value={newPpmLinkedNoteId}
                  onChange={(e) => setNewPpmLinkedNoteId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-300 mb-1">Risk Factors (One per line)</label>
                <textarea
                  rows={3}
                  value={newPpmRiskFactors}
                  onChange={(e) => setNewPpmRiskFactors(e.target.value)}
                  className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Use of Proceeds</label>
                  <input
                    type="text"
                    value={newPpmUseOfProceeds}
                    onChange={(e) => setNewPpmUseOfProceeds(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Offering Expenses Disclosure</label>
                  <input
                    type="text"
                    value={newPpmExpenses}
                    onChange={(e) => setNewPpmExpenses(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Fees & Sales Compensation</label>
                  <input
                    type="text"
                    value={newPpmFees}
                    onChange={(e) => setNewPpmFees(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Conflicts of Interest</label>
                  <input
                    type="text"
                    value={newPpmConflicts}
                    onChange={(e) => setNewPpmConflicts(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Investor Eligibility Criteria</label>
                  <input
                    type="text"
                    value={newPpmEligibility}
                    onChange={(e) => setNewPpmEligibility(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Transfer Restrictions</label>
                  <input
                    type="text"
                    value={newPpmTransferRestrictions}
                    onChange={(e) => setNewPpmTransferRestrictions(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPpmModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-700 font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm cursor-pointer">
                  Register Immutable PPM Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PPM Compliance Gates, Filings & Investor Verification Modal */}
      {selectedPpmDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-800 space-y-5 my-8 max-h-[90vh] overflow-y-auto text-xs font-mono">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedPpmDetail.title} ({selectedPpmDetail.id})</h3>
                <div className="text-[11px] text-neutral-400">
                  v{selectedPpmDetail.version} • Document SHA-256: {selectedPpmDetail.document_sha256}
                </div>
              </div>
              <button
                onClick={() => setSelectedPpmId(null)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {/* Release-Blocking Gate Evaluation */}
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase">Release-Blocking Compliance Gate Status</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  selectedPpmDetail.compliance_evaluation?.distribution_ready
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}>
                  {selectedPpmDetail.compliance_evaluation?.distribution_ready ? 'INTERNAL GATES CLEAR' : 'BLOCKED'}
                </span>
              </div>

              {(selectedPpmDetail.compliance_evaluation?.blockers || []).length > 0 && (
                <ul className="space-y-1 text-red-300 list-disc pl-4">
                  {selectedPpmDetail.compliance_evaluation.blockers.map((b: string, i: number) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}

              {(selectedPpmDetail.compliance_evaluation?.warnings || []).length > 0 && (
                <ul className="space-y-1 text-amber-300 list-disc pl-4 pt-2 border-t border-neutral-800">
                  {selectedPpmDetail.compliance_evaluation.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
                {!selectedPpmDetail.bad_actor_screened && (
                  <button
                    onClick={() => handleBadActorScreen(selectedPpmDetail.id)}
                    className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer">
                    Record Rule 506(d) Screening
                  </button>
                )}
              </div>

              {/* Structured Qualified Securities Counsel Review Record */}
              <div className="pt-3 border-t border-neutral-800 space-y-2">
                <div className="font-bold text-emerald-400 uppercase">Qualified Securities Counsel Review Record</div>
                {selectedPpmDetail.counsel_review_record ? (
                  <div className="text-[11px] text-neutral-300 space-y-0.5">
                    <div>Reviewer: {selectedPpmDetail.counsel_review_record.reviewer_name} ({selectedPpmDetail.counsel_review_record.firm_or_bar_ref})</div>
                    <div>Decision: {selectedPpmDetail.counsel_review_record.decision} • Scope: {selectedPpmDetail.counsel_review_record.scope}</div>
                    <div>Evidence Ref: {selectedPpmDetail.counsel_review_record.evidence_ref} • Logged: {selectedPpmDetail.counsel_review_record.timestamp}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" value={counselName} onChange={(e) => setCounselName(e.target.value)} placeholder="Named Reviewer" className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                    <input type="text" value={counselBarRef} onChange={(e) => setCounselBarRef(e.target.value)} placeholder="Firm / Bar Reference" className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                    <input type="text" value={counselScope} onChange={(e) => setCounselScope(e.target.value)} placeholder="Review Scope" className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                    <div className="flex gap-2">
                      <select value={counselDecision} onChange={(e: any) => setCounselDecision(e.target.value)} className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white">
                        <option value="APPROVED">APPROVED</option>
                        <option value="CONDITIONAL">CONDITIONAL</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                      <input type="text" value={counselEvidenceRef} onChange={(e) => setCounselEvidenceRef(e.target.value)} placeholder="Evidence Ref" className="flex-1 p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={() => handleCounselReviewPpm(selectedPpmDetail.id, Boolean(selectedPpmDetail.is_tokenized_security))}
                        className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold cursor-pointer">
                        Record Counsel Sign-off & SEC 33-11412 Verification
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Deadlines & Statutory Filings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Federal Form D (15d)</div>
                <div className="text-white">Due: {selectedPpmDetail.form_d_tracking?.due_date || 'Upon 1st commitment'}</div>
                <div className="text-neutral-400">Status: {selectedPpmDetail.form_d_tracking?.filed ? `FILED (${selectedPpmDetail.form_d_tracking.accession_number})` : 'PENDING'}</div>
                {!selectedPpmDetail.form_d_tracking?.filed && selectedPpmDetail.first_irrevocable_commitment_date && (
                  <button onClick={() => handleMarkFiling(selectedPpmDetail, 'FORM_D')} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-400 cursor-pointer">
                    Mark Form D Filed
                  </button>
                )}
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Nevada NAC 90.5145 ($500)</div>
                <div className="text-white">Due: {selectedPpmDetail.nevada_nac_90_5145?.due_date || 'Upon 1st NV sale'}</div>
                <div className="text-neutral-400">Effective Until: {selectedPpmDetail.nevada_nac_90_5145?.effective_until || 'N/A'}</div>
                <div className="text-neutral-400">Status: {selectedPpmDetail.nevada_nac_90_5145?.status}</div>
                {selectedPpmDetail.nevada_nac_90_5145?.status === 'PENDING' && (
                  <button onClick={() => handleMarkFiling(selectedPpmDetail, 'NEVADA')} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-400 cursor-pointer">
                    Mark NV Filed ($500)
                  </button>
                )}
              </div>
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">FINRA Rule 5123 (15d)</div>
                <div className="text-white">Agent: {selectedPpmDetail.placement_agent?.finra_member ? 'FINRA Member' : 'Direct / Non-FINRA'}</div>
                <div className="text-neutral-400">Status: {selectedPpmDetail.finra_5123_filing?.filing_status}</div>
                {selectedPpmDetail.finra_5123_filing?.filing_status === 'PENDING' && (
                  <button onClick={() => handleMarkFiling(selectedPpmDetail, 'FINRA_5123')} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-400 cursor-pointer">
                    Mark 5123 Filed
                  </button>
                )}
              </div>
            </div>

            {/* Investor Subscription & Accreditation Gate */}
            <form onSubmit={(e) => handleOnboardInvestor(e, selectedPpmDetail)} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="font-bold text-white uppercase">Investor Subscription & Verification Gate</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Investor Name / Entity</label>
                  <input type="text" value={invLabel} onChange={(e) => setInvLabel(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Verification Method</label>
                  <select value={invVerificationMethod} onChange={(e) => setInvVerificationMethod(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white">
                    <option value="THIRD_PARTY_CPA_ATTORNEY">Third-Party CPA / Attorney Letter</option>
                    <option value="BROKER_DEALER_RIA">Broker-Dealer / RIA Verification</option>
                    <option value="INCOME_TAX_W2_REVIEW">Tax / W-2 Documentary Review</option>
                    <option value="NET_WORTH_STATEMENTS">Net Worth Bank/Brokerage Statements</option>
                    <option value="SELF_ATTESTATION_CHECKBOX">Self-Attestation Checkbox (Rejected on 506(c))</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Verification Evidence Ref</label>
                  <input type="text" value={invEvidenceRef} onChange={(e) => setInvEvidenceRef(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Solicitor / Introducer</label>
                  <input type="text" value={invSolicitedBy} onChange={(e) => setInvSolicitedBy(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">State of Residence</label>
                  <input type="text" value={invState} onChange={(e) => setInvState(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Subscription Amount ($)</label>
                  <input type="text" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Annual Income / Revenue ($)</label>
                  <input type="text" value={invIncomeUsd} onChange={(e) => setInvIncomeUsd(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Net Worth / Assets ($)</label>
                  <input type="text" value={invNetWorthUsd} onChange={(e) => setInvNetWorthUsd(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Rule 501(e) Weight / Exclusion Reason</label>
                  <div className="flex gap-1.5">
                    <input type="number" min="0" max="1" value={inv501eWeight} onChange={(e) => setInv501eWeight(e.target.value)} className="w-16 p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                    <input type="text" value={inv501eReason} onChange={(e) => setInv501eReason(e.target.value)} placeholder="501(e) exclusion ref" className="flex-1 p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-neutral-300">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={invAccredited} onChange={(e) => setInvAccredited(e.target.checked)} />
                  <span>Accredited Investor</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={invQaAck} onChange={(e) => setInvQaAck(e.target.checked)} />
                  <span>Q&A Opportunity Acknowledged</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={inv502bDelivered} onChange={(e) => setInv502bDelivered(e.target.checked)} />
                  <span>Rule 502(b) Disclosures Delivered</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={invSophisticated} onChange={(e) => setInvSophisticated(e.target.checked)} />
                  <span>Sophisticated (506(b))</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={invTier2CapVerified} onChange={(e) => setInvTier2CapVerified(e.target.checked)} />
                  <span>Reg A Tier 2 10% Cap Verified</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input type="checkbox" checked={invUsPerson} onChange={(e) => setInvUsPerson(e.target.checked)} />
                  <span>US Person</span>
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                  Verify & Record Subscription
                </button>
              </div>
            </form>

            {/* Recorded Investors & Version History */}
            {(selectedPpmDetail.investor_records || []).length > 0 && (
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                <div className="font-bold text-white uppercase">Recorded Subscribers ({selectedPpmDetail.investor_records.length})</div>
                <div className="space-y-1.5">
                  {selectedPpmDetail.investor_records.map((inv: any) => (
                    <div key={inv.id} className="flex justify-between text-[11px] text-neutral-300 border-b border-neutral-900 pb-1">
                      <span>{inv.investor_label} ({inv.state_of_residence}) • {inv.verification_method}</span>
                      <span className="text-emerald-400">${Number(inv.investment_amount).toLocaleString()} • PPM v{inv.ppm_version_delivered}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Collateral Pool Modal */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">Add REMIC Collateral Asset Pool</h3>
                <p className="text-[11px] text-neutral-400">Pool creation requires independent 4-eyes Checker approval before activation.</p>
              </div>
              <button
                onClick={() => setIsPoolModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePool} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-neutral-300 mb-1">Pool Name</label>
                <input
                  type="text"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Pool Asset Class</label>
                  <select
                    value={newPoolType}
                    onChange={(e) => setNewPoolType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono">
                    <option value="MORTGAGE_REMIC">MORTGAGE_REMIC</option>
                    <option value="COMMERCIAL_REAL_ESTATE">COMMERCIAL_REAL_ESTATE</option>
                    <option value="TREASURY_COLLATERAL">TREASURY_COLLATERAL</option>
                    <option value="MIXED_FIXED_INCOME">MIXED_FIXED_INCOME</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Jurisdiction</label>
                  <input
                    type="text"
                    value={newPoolJurisdiction}
                    onChange={(e) => setNewPoolJurisdiction(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium text-neutral-300 mb-1">Total Principal (USD)</label>
                  <input
                    type="text"
                    value={newPoolPrincipal}
                    onChange={(e) => setNewPoolPrincipal(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">WAC Rate</label>
                  <input
                    type="text"
                    value={newPoolCoupon}
                    onChange={(e) => setNewPoolCoupon(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Assets</label>
                  <input
                    type="number"
                    value={newPoolAssetCount}
                    onChange={(e) => setNewPoolAssetCount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">WAM (Months)</label>
                  <input
                    type="number"
                    value={newPoolMaturity}
                    onChange={(e) => setNewPoolMaturity(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">UCC-1 / UCC-9 Ref</label>
                  <input
                    type="text"
                    value={newPoolUccRef}
                    onChange={(e) => setNewPoolUccRef(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Exact Debtor Legal Name</label>
                  <input
                    type="text"
                    value={newPoolDebtorName}
                    onChange={(e) => setNewPoolDebtorName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Fiduciary Custodian</label>
                  <input
                    type="text"
                    value={newPoolCustodian}
                    onChange={(e) => setNewPoolCustodian(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-300 mb-1">Independent Underlying Asset Evidence Ref (Required)</label>
                <input
                  type="text"
                  value={newPoolAssetsEvidenceRef}
                  onChange={(e) => setNewPoolAssetsEvidenceRef(e.target.value)}
                  className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Ownership Evidence Ref</label>
                  <input
                    type="text"
                    value={newPoolOwnershipRef}
                    onChange={(e) => setNewPoolOwnershipRef(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-300 mb-1">Custody Evidence Ref</label>
                  <input
                    type="text"
                    value={newPoolCustodyRef}
                    onChange={(e) => setNewPoolCustodyRef(e.target.value)}
                    className="w-full p-2 rounded-lg border border-neutral-700 bg-neutral-950 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-700 font-medium text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm cursor-pointer">
                  Create Pool (4-Eyes)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collateral Pool 8-Stage Perfection & Anti-Over-Pledge Linkage Modal */}
      {selectedPoolDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-800 space-y-5 my-8 max-h-[90vh] overflow-y-auto text-xs font-mono">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedPoolDetail.pool_name} ({selectedPoolDetail.id})</h3>
                <div className="text-[11px] text-neutral-400">
                  Debtor: {selectedPoolDetail.debtor_legal_name} • Jurisdiction: {selectedPoolDetail.jurisdiction} • Available: ${Number(selectedPoolDetail.link_readiness?.available_principal ?? 0).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setSelectedPoolId(null)} className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase">8-Stage Collateral Verification & Legal Perfection</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  selectedPoolDetail.link_readiness?.ready_for_linkage
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {selectedPoolDetail.link_readiness?.ready_for_linkage ? 'CLEARED FOR LINKAGE' : 'UNPERFECTED / PENDING'}
                </span>
              </div>

              {(selectedPoolDetail.link_readiness?.missing_stages || []).length > 0 && (
                <ul className="space-y-1 text-amber-300 list-disc pl-4">
                  {selectedPoolDetail.link_readiness.missing_stages.map((m: string, idx: number) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                <input type="text" value={stageReviewer} onChange={(e) => setStageReviewer(e.target.value)} placeholder="Independent Perfection Reviewer" className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
                <input type="text" value={stageAssignRef} onChange={(e) => setStageAssignRef(e.target.value)} placeholder="Assignment Authority Ref" className="p-2 rounded border border-neutral-700 bg-neutral-900 text-white" />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleVerifyPoolStages(selectedPoolDetail, {
                    asset_ownership_verified: true,
                    ownership_evidence_ref: selectedPoolDetail.verification?.ownership_evidence_ref || `OWN-${selectedPoolDetail.id}`,
                    custody_independently_verified: true,
                    custody_evidence_ref: selectedPoolDetail.verification?.custody_evidence_ref || `CUSTODY-${selectedPoolDetail.id}`,
                    assignment_transfer_authority_verified: true,
                    assignment_authority_ref: stageAssignRef,
                    ucc_filing_evidence_received: Boolean(selectedPoolDetail.ucc_filing_ref),
                    filing_jurisdiction_debtor_name_verified: true,
                    security_interest_perfection_reviewed: true,
                    perfection_reviewer: stageReviewer,
                    pool_valuation_eligibility_approved: true,
                    approved_for_offering_linkage: true
                  })}
                  className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold cursor-pointer">
                  Record All 8 Verification Stages (Checker/Admin)
                </button>
              </div>
            </div>

            <form onSubmit={(e) => handleLinkPool(e, selectedPoolDetail.id)} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <div className="font-bold text-white uppercase">Link Collateral Allocation (Anti-Duplicate & Anti-Over-Pledge)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Obligation Type</label>
                  <select value={linkTargetType} onChange={(e: any) => setLinkTargetType(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white">
                    <option value="PPM_OFFERING">PPM Offering</option>
                    <option value="DEBT_NOTE">Debt Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Target ID</label>
                  <input type="text" value={linkTargetId} onChange={(e) => setLinkTargetId(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Allocated Principal ($)</label>
                  <input type="text" value={linkAmount} onChange={(e) => setLinkAmount(e.target.value)} className="w-full p-2 rounded border border-neutral-700 bg-neutral-900 text-white" required />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                  Allocate & Link Collateral
                </button>
              </div>
            </form>

            {(selectedPoolDetail.allocated_obligations || []).length > 0 && (
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                <div className="font-bold text-white uppercase">Active Collateral Allocations ({selectedPoolDetail.allocated_obligations.length})</div>
                {selectedPoolDetail.allocated_obligations.map((alloc: any) => (
                  <div key={alloc.id} className="flex justify-between text-[11px] text-neutral-300 border-b border-neutral-900 pb-1">
                    <span>{alloc.target_type}: {alloc.target_id}</span>
                    <span className="text-emerald-400">${Number(alloc.allocated_amount).toLocaleString()} • {alloc.linked_by}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
