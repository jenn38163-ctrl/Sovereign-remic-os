import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { SettlementOrchestrator } from "./agent-wallet-os/src/settlement/orchestrator";
import { SettlementIntent } from "./agent-wallet-os/src/types";
import { firestoreAdmin } from "./src/lib/firebase-admin";
import {
  ACTIVE_SIGNING_KEY_ID,
  assertDistinctMakerChecker,
  authenticate,
  authorizeRole,
  authorizeTenant,
  signPayload,
  verifySignature
} from "./server/auth";
import { validateCusip, validateIsin } from "./agent-wallet-os/src/utils/validation";
import { db } from "./agent-wallet-os/src/db/client";
import { AuditRecordNode, createAuditRecord, verifyAuditChain } from "./agent-wallet-os/src/ledger/audit";
import {
  addCalendarDays,
  addCalendarYears,
  assertOperativeExemptionPathway,
  COMPLIANCE_DISCLAIMER,
  computePpmDocumentHash,
  evaluateOfferingComplianceGates,
  NEVADA_NAC_90_5145_FEE_USD,
  REG_A_TIER_1_AFFILIATE_CAP_USD,
  REG_A_TIER_1_CAP_USD,
  REG_A_TIER_2_AFFILIATE_CAP_USD,
  REG_A_TIER_2_CAP_USD,
  validateInvestorOnboarding
} from "./agent-wallet-os/src/ppm/compliance";
import { CounselReviewRecord, InvestorComplianceRecord, PPMOffering } from "./agent-wallet-os/src/ppm/types";
import { AssetPool } from "./agent-wallet-os/src/pool/types";
import { assertPoolCanAllocate, evaluatePoolLinkReadiness } from "./agent-wallet-os/src/pool/validation";

try {
  dotenv.config();
} catch (e) {
  // Ignored in production environments where env vars are natively injected
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  const orchestrator = new SettlementOrchestrator();

  // Initialize Gemini AI SDK securely on the server
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Seed default Debt Notes in Firestore if empty (matching official acceptance screenshot)
  async function seedDebtNotesIfNeeded() {
    try {
      const col = firestoreAdmin.collection('debt_notes');
      const snapshot = await col.get();
      if (snapshot.empty) {
        const seedNotes = [
          {
            id: 'DN-SUPER-SENIOR-2025',
            tenant_id: 'tenant-omega',
            cusip: 'JM6M-UCC1',
            isin: 'US4812235000',
            tranche_name: 'SUPER-SENIOR TRANCHE',
            network: 'Mainnet',
            status: '31 CFR SEC PERFECTLY CUSTODED',
            ganp_code: 'GANP-2025-001',
            principal_value: '50000000.00',
            interest_rate: '10%',
            issuance_date: 'Feb 25, 2025',
            jurisdiction: 'Delaware',
            filing_date: '2025-02-25',
            ucc_type: 'UCC-1 SECURED',
            ucc_description: 'Fiduciary collateral perfect filing',
            created_by: 'usr-maker-1',
            created_by_individual_id: 'person-alice-001',
            approved_by: 'usr-checker-1',
            approved_by_individual_id: 'person-bob-002',
            signature: signPayload({ id: 'DN-SUPER-SENIOR-2025', principal: '50000000.00' }),
            signature_key_id: ACTIVE_SIGNING_KEY_ID,
            archived: false,
            created_at: new Date().toISOString()
          },
          {
            id: 'DN-1037',
            tenant_id: 'tenant-omega',
            cusip: 'JM601037',
            isin: 'US4812221037',
            tranche_name: 'JUNIOR TRANCHE',
            network: 'Ethereum',
            status: '31 CFR SEC PERFECTLY CUSTODED',
            ganp_code: 'GANP-2025-002',
            principal_value: '48295.00',
            interest_rate: '8.25%',
            issuance_date: 'Jan 20, 2025',
            jurisdiction: 'Nevada',
            filing_date: '2026-06-07',
            ucc_type: 'UCC-9 DISCLOSURE',
            ucc_description: 'Asset pool inventory certificate',
            created_by: 'usr-maker-1',
            created_by_individual_id: 'person-alice-001',
            approved_by: 'usr-checker-1',
            approved_by_individual_id: 'person-bob-002',
            signature: signPayload({ id: 'DN-1037', principal: '48295.00' }),
            signature_key_id: ACTIVE_SIGNING_KEY_ID,
            archived: false,
            created_at: new Date().toISOString()
          },
          {
            id: 'DN-1011',
            tenant_id: 'tenant-omega',
            cusip: 'JM601011',
            isin: 'US4812221011',
            tranche_name: 'JUNIOR TRANCHE',
            network: 'Polygon',
            status: '31 CFR SEC PERFECTLY CUSTODED',
            ganp_code: 'GANP-2025-003',
            principal_value: '23295.00',
            interest_rate: '6.75%',
            issuance_date: 'Jan 20, 2025',
            jurisdiction: 'Delaware',
            filing_date: '2025-01-20',
            ucc_type: 'UCC-1 SECURED',
            ucc_description: 'Fiduciary collateral perfect filing',
            created_by: 'usr-maker-1',
            created_by_individual_id: 'person-alice-001',
            approved_by: 'usr-checker-1',
            approved_by_individual_id: 'person-bob-002',
            signature: signPayload({ id: 'DN-1011', principal: '23295.00' }),
            signature_key_id: ACTIVE_SIGNING_KEY_ID,
            archived: false,
            created_at: new Date().toISOString()
          }
        ];

        for (const note of seedNotes) {
          await col.doc(note.id).set(note);
        }
        console.log("Seeded authoritative debt notes matching acceptance screenshot.");
      }
    } catch (e) {
      console.error("Error seeding debt notes:", e);
    }
  }
  seedDebtNotesIfNeeded();

  function normalizePpmOffering(raw: any): PPMOffering {
    const now = new Date().toISOString();
    const base: PPMOffering = {
      id: raw.id,
      tenant_id: raw.tenant_id || 'tenant-omega',
      title: raw.title || 'Untitled Offering',
      exemption_pathway: raw.exemption_pathway === 'REG_A' ? 'REG_A_TIER_2' : (raw.exemption_pathway || 'RULE_506_C'),
      counsel_selected_pathway: Boolean(raw.counsel_selected_pathway ?? raw.counsel_reviewed),
      offering_amount: String(raw.offering_amount || '0.00'),
      affiliate_offering_amount: String(raw.affiliate_offering_amount || '0.00'),
      minimum_investment: String(raw.minimum_investment || '100000.00'),
      maturity_months: Number(raw.maturity_months || 12),
      target_interest_rate: raw.target_interest_rate || '8.0%',
      linked_debt_note_id: raw.linked_debt_note_id || '',
      linked_pool_id: raw.linked_pool_id || '',
      is_tokenized_security: Boolean(raw.is_tokenized_security),
      tokenized_asset_classification_verified: Boolean(raw.tokenized_asset_classification_verified),
      tokenized_counsel_memo_ref: raw.tokenized_counsel_memo_ref || '',
      risk_factors: Array.isArray(raw.risk_factors) && raw.risk_factors.length > 0 ? raw.risk_factors : ['Illiquidity and regulatory risks apply'],
      use_of_proceeds: raw.use_of_proceeds || 'Asset acquisition and fiduciary collateral custody.',
      offering_expenses: raw.offering_expenses || 'Estimated legal, administrative, and filing expenses capped at 1.5% of gross proceeds.',
      fees_and_compensation: raw.fees_and_compensation || 'Management fee 1.0% per annum; no undisclosed placement commissions.',
      conflicts_of_interest: raw.conflicts_of_interest || 'Sponsor affiliates may act as servicer or collateral administrator under arms-length agreements.',
      related_party_transactions: raw.related_party_transactions || 'None beyond disclosed servicing agreements.',
      investor_eligibility: raw.investor_eligibility || 'Verified Accredited Investors under Rule 506(c) standards.',
      transfer_restrictions: raw.transfer_restrictions || 'Restricted securities pursuant to Securities Act Rule 144.',
      general_solicitation_used: Boolean(raw.general_solicitation_used ?? (raw.exemption_pathway === 'RULE_506_C')),
      us_directed_selling_efforts: Boolean(raw.us_directed_selling_efforts),
      form_1a_qualified: Boolean(raw.form_1a_qualified),
      audited_financials_attached: Boolean(raw.audited_financials_attached),
      auditor_firm: raw.auditor_firm || '',
      national_exchange_listed: Boolean(raw.national_exchange_listed),
      reg_a_state_registrations: Array.isArray(raw.reg_a_state_registrations) ? raw.reg_a_state_registrations : [],
      ongoing_sec_reporting: raw.ongoing_sec_reporting || {
        form_1u_monitoring_enabled: false
      },
      offering_start_date: raw.offering_start_date || now.slice(0, 10),
      offering_end_date: raw.offering_end_date || undefined,
      concurrent_offerings_checked: Boolean(raw.concurrent_offerings_checked ?? true),
      rule_152_counsel_clearance: Boolean(raw.rule_152_counsel_clearance),
      bad_actor_screened: Boolean(raw.bad_actor_screened ?? false),
      bad_actor_disqualifying_event: Boolean(raw.bad_actor_disqualifying_event),
      bad_actor_written_disclosure_delivered: Boolean(raw.bad_actor_written_disclosure_delivered),
      covered_persons: Array.isArray(raw.covered_persons) ? raw.covered_persons : [],
      placement_agent: raw.placement_agent || {
        has_placement_agent: false,
        finra_member: false,
        sales_compensation_disclosed: true
      },
      finra_5123_filing: raw.finra_5123_filing || {
        required: false,
        exemption_claimed: 'NONE',
        sr_finra_2026_002_operative_confirmed: false,
        filing_status: 'NOT_REQUIRED',
        retail_communications_logged: []
      },
      first_irrevocable_commitment_date: raw.first_irrevocable_commitment_date || undefined,
      first_irrevocable_commitment_event: raw.first_irrevocable_commitment_event || null,
      first_nevada_sale_date: raw.first_nevada_sale_date || undefined,
      first_nevada_sale_event: raw.first_nevada_sale_event || null,
      form_d_tracking: raw.form_d_tracking || { filed: false },
      nevada_nac_90_5145: raw.nevada_nac_90_5145 || {
        applicable: false,
        fee_usd: NEVADA_NAC_90_5145_FEE_USD,
        amendment_fee_usd: 0,
        status: 'NOT_APPLICABLE'
      },
      state_notice_filings: Array.isArray(raw.state_notice_filings) ? raw.state_notice_filings : [],
      version: Number(raw.version || 1),
      document_sha256: raw.document_sha256 || '',
      version_history: Array.isArray(raw.version_history) ? raw.version_history : [],
      investor_records: Array.isArray(raw.investor_records) ? raw.investor_records : [],
      status: raw.status || 'PENDING_CHECKER_APPROVAL',
      created_by: raw.created_by || 'usr-maker-1',
      created_by_individual_id: raw.created_by_individual_id || (raw.created_by === 'usr-maker-1' ? 'person-alice-001' : undefined),
      approved_by: raw.approved_by || null,
      approved_by_individual_id: raw.approved_by_individual_id || (raw.approved_by === 'usr-checker-1' ? 'person-bob-002' : null),
      counsel_reviewed: Boolean(raw.counsel_reviewed),
      counsel_reviewer: raw.counsel_reviewer || null,
      counsel_review_date: raw.counsel_review_date || null,
      counsel_review_record: raw.counsel_review_record || (raw.counsel_reviewed ? {
        reviewer_name: raw.counsel_reviewer || 'Sovereign Compliance & Legal Counsel LLP',
        firm_or_bar_ref: 'NV-BAR-COUNSEL-2026',
        scope: 'Exemption pathway, disclosures, and SEC Release 33-11412 classification',
        decision: 'APPROVED',
        timestamp: raw.counsel_review_date || now,
        evidence_ref: 'COUNSEL-MEMO-2026-SR1'
      } : null),
      signature: raw.signature || null,
      signature_key_id: raw.signature_key_id || (raw.signature ? ACTIVE_SIGNING_KEY_ID : null),
      created_at: raw.created_at || now,
      updated_at: raw.updated_at || now
    };
    if (!base.document_sha256) {
      base.document_sha256 = computePpmDocumentHash(base);
    }
    if (base.version_history.length === 0) {
      base.version_history = [{
        version: base.version,
        sha256: base.document_sha256,
        created_at: base.created_at,
        created_by: base.created_by,
        change_summary: 'Initial PPM draft registration'
      }];
    }
    return base;
  }

  function normalizeAssetPool(raw: any): AssetPool {
    const now = new Date().toISOString();
    const verification = raw.verification || {
      asset_ownership_verified: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      ownership_evidence_ref: raw.status === 'ACTIVE_CUSTODED' ? `OWN-TITLE-${raw.id}` : undefined,
      custody_independently_verified: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      custody_evidence_ref: raw.status === 'ACTIVE_CUSTODED' ? `CUSTODY-ACK-${raw.id}` : undefined,
      assignment_transfer_authority_verified: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      assignment_authority_ref: raw.status === 'ACTIVE_CUSTODED' ? `ASSIGN-${raw.id}` : undefined,
      ucc_filing_evidence_received: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      filing_jurisdiction_debtor_name_verified: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      security_interest_perfection_reviewed: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      perfection_reviewer: raw.status === 'ACTIVE_CUSTODED' ? 'Sovereign Collateral Counsel LLP' : undefined,
      perfection_review_date: raw.status === 'ACTIVE_CUSTODED' ? now : undefined,
      pool_valuation_eligibility_approved: Boolean(raw.status === 'ACTIVE_CUSTODED'),
      underlying_assets_evidence_ref: raw.underlying_assets_evidence_ref || `TAPE-AUDIT-${raw.id}`,
      approved_for_offering_linkage: Boolean(raw.status === 'ACTIVE_CUSTODED')
    };

    const allocated = Array.isArray(raw.allocated_obligations) ? raw.allocated_obligations : [];
    return {
      id: raw.id,
      tenant_id: raw.tenant_id || 'tenant-omega',
      pool_name: raw.pool_name || 'Unnamed Pool',
      pool_type: raw.pool_type || 'MORTGAGE_REMIC',
      custodian: raw.custodian || 'Malachite Fiduciary Trust (31 CFR Custody)',
      jurisdiction: raw.jurisdiction || 'Delaware',
      debtor_legal_name: raw.debtor_legal_name || 'Sovereign REMIC Trust I LLC',
      total_principal_value: String(raw.total_principal_value || '0.00'),
      weighted_avg_coupon: raw.weighted_avg_coupon || '8.50%',
      weighted_avg_maturity_months: Number(raw.weighted_avg_maturity_months || 36),
      asset_count: Number(raw.asset_count || 1),
      ucc_filing_ref: raw.ucc_filing_ref || '',
      verification,
      allocated_obligations: allocated,
      linked_debt_note_ids: Array.isArray(raw.linked_debt_note_ids) ? raw.linked_debt_note_ids : [],
      linked_ppm_ids: Array.isArray(raw.linked_ppm_ids) ? raw.linked_ppm_ids : [],
      status: raw.status || 'PENDING_CHECKER_APPROVAL',
      created_by: raw.created_by || 'usr-maker-1',
      created_by_individual_id: raw.created_by_individual_id || (raw.created_by === 'usr-maker-1' ? 'person-alice-001' : 'person-unknown'),
      approved_by: raw.approved_by || null,
      approved_by_individual_id: raw.approved_by_individual_id || (raw.approved_by === 'usr-checker-1' ? 'person-bob-002' : null),
      signature: raw.signature || null,
      signature_key_id: raw.signature_key_id || (raw.signature ? ACTIVE_SIGNING_KEY_ID : null),
      archived: Boolean(raw.archived),
      created_at: raw.created_at || now,
      updated_at: raw.updated_at || now
    };
  }

  async function seedPpmOfferingsIfNeeded() {
    try {
      const col = firestoreAdmin.collection('ppm_offerings');
      const snap = await col.get();
      if (snap.empty) {
        const now = new Date().toISOString();
        const sr1 = normalizePpmOffering({
          id: 'PPM-2026-SR1',
          tenant_id: 'tenant-omega',
          title: 'Sovereign Senior Secured Notes Tranche A',
          exemption_pathway: 'RULE_506_C',
          counsel_selected_pathway: true,
          offering_amount: '50000000.00',
          affiliate_offering_amount: '0.00',
          minimum_investment: '250000.00',
          maturity_months: 36,
          target_interest_rate: '10.0%',
          linked_debt_note_id: 'DN-SUPER-SENIOR-2025',
          linked_pool_id: 'POOL-2026-REMIC-1',
          is_tokenized_security: true,
          tokenized_asset_classification_verified: true,
          tokenized_counsel_memo_ref: 'MEMO-SEC-33-11412-2026-01',
          risk_factors: [
            'Illiquidity of digital secured debt instruments',
            'Smart contract and blockchain network protocol risk',
            'Regulatory classification and statutory compliance changes under SEC Release 33-11412'
          ],
          use_of_proceeds: 'Acquisition and custody of institutional real estate and sovereign mortgage-backed asset pools.',
          offering_expenses: 'Legal, audit, and NASAA EFD filing expenses capped at $250,000.',
          fees_and_compensation: 'Servicing fee 0.75% per annum; no unregistered finder fees permitted.',
          conflicts_of_interest: 'Sponsor affiliate acts as trustee/custodian under independent fiduciary oversight.',
          related_party_transactions: 'None outside disclosed fiduciary servicing agreement.',
          investor_eligibility: 'Accredited Investors under Rule 506(c) third-party verification standards only.',
          transfer_restrictions: 'Restricted securities pursuant to Securities Act Rule 144 and statutory transfer lockups.',
          general_solicitation_used: true,
          offering_start_date: '2026-04-01',
          concurrent_offerings_checked: true,
          bad_actor_screened: true,
          bad_actor_disqualifying_event: false,
          bad_actor_written_disclosure_delivered: false,
          covered_persons: [
            {
              name: 'Sovereign REMIC Manager LLC',
              role: 'Issuer / Managing Member',
              inquiry_date: '2026-03-28',
              disqualifying_event_found: false,
              evidence_ref: 'FINRA-BD-CHECK-2026-01'
            }
          ],
          placement_agent: {
            has_placement_agent: false,
            finra_member: false,
            sales_compensation_disclosed: true
          },
          finra_5123_filing: {
            required: false,
            exemption_claimed: 'NONE',
            sr_finra_2026_002_operative_confirmed: false,
            filing_status: 'NOT_REQUIRED',
            retail_communications_logged: []
          },
          status: 'COUNSEL_REVIEWED',
          created_by: 'usr-maker-1',
          created_by_individual_id: 'person-alice-001',
          approved_by: 'usr-checker-1',
          approved_by_individual_id: 'person-bob-002',
          counsel_reviewed: true,
          counsel_reviewer: 'Sovereign Compliance & Legal Counsel LLP',
          counsel_review_date: now,
          counsel_review_record: {
            reviewer_name: 'Elena Vance, Esq.',
            firm_or_bar_ref: 'Sovereign Compliance & Legal Counsel LLP (Bar #NV-88421)',
            scope: 'Rule 506(c) offering terms, disclosures, and SEC Release 33-11412 classification',
            decision: 'APPROVED',
            timestamp: now,
            evidence_ref: 'COUNSEL-MEMO-2026-SR1'
          },
          signature: signPayload({ id: 'PPM-2026-SR1', amount: '50000000.00' }),
          signature_key_id: ACTIVE_SIGNING_KEY_ID,
          created_at: now,
          updated_at: now
        });

        await col.doc(sr1.id).set(sr1);
        console.log("Seeded initial PPM offerings for v19 RC1.");
      }
    } catch (e) {
      console.error("Error seeding PPM offerings:", e);
    }
  }
  seedPpmOfferingsIfNeeded();

  async function seedAssetPoolsIfNeeded() {
    try {
      const col = firestoreAdmin.collection('asset_pools');
      const snap = await col.get();
      if (snap.empty) {
        const now = new Date().toISOString();
        const pool1 = normalizeAssetPool({
          id: 'POOL-2026-REMIC-1',
          tenant_id: 'tenant-omega',
          pool_name: 'Sovereign Prime Real Estate Mortgage Pool I',
          pool_type: 'MORTGAGE_REMIC',
          custodian: 'Malachite Fiduciary Trust (31 CFR Custody)',
          jurisdiction: 'Delaware',
          debtor_legal_name: 'Sovereign REMIC Trust I LLC',
          total_principal_value: '50000000.00',
          weighted_avg_coupon: '10.00%',
          weighted_avg_maturity_months: 36,
          asset_count: 142,
          ucc_filing_ref: 'UCC-1 PERFECTED #DE-2026-99410',
          allocated_obligations: [
            {
              id: 'ALLOC-SR1-2026',
              target_type: 'PPM_OFFERING',
              target_id: 'PPM-2026-SR1',
              allocated_amount: '50000000.00',
              linked_at: now,
              linked_by: 'usr-checker-1'
            }
          ],
          linked_debt_note_ids: ['DN-SUPER-SENIOR-2025'],
          linked_ppm_ids: ['PPM-2026-SR1'],
          status: 'ACTIVE_CUSTODED',
          created_by: 'usr-maker-1',
          created_by_individual_id: 'person-alice-001',
          approved_by: 'usr-checker-1',
          approved_by_individual_id: 'person-bob-002',
          signature: signPayload({ id: 'POOL-2026-REMIC-1', principal: '50000000.00' }),
          signature_key_id: ACTIVE_SIGNING_KEY_ID,
          archived: false,
          created_at: now,
          updated_at: now
        });

        const pool2 = normalizeAssetPool({
          id: 'POOL-2026-NV-2',
          tenant_id: 'tenant-omega',
          pool_name: 'Nevada Secured Commercial Collateral Pool II',
          pool_type: 'COMMERCIAL_REAL_ESTATE',
          custodian: 'Malachite Fiduciary Trust (31 CFR Custody)',
          jurisdiction: 'Nevada',
          debtor_legal_name: 'Sovereign Nevada Collateral LLC',
          total_principal_value: '71590.00',
          weighted_avg_coupon: '7.85%',
          weighted_avg_maturity_months: 24,
          asset_count: 14,
          ucc_filing_ref: 'UCC-9 INVENTORY #NV-2026-1037',
          allocated_obligations: [
            {
              id: 'ALLOC-DN1037',
              target_type: 'DEBT_NOTE',
              target_id: 'DN-1037',
              allocated_amount: '48295.00',
              linked_at: now,
              linked_by: 'usr-checker-1'
            },
            {
              id: 'ALLOC-DN1011',
              target_type: 'DEBT_NOTE',
              target_id: 'DN-1011',
              allocated_amount: '23295.00',
              linked_at: now,
              linked_by: 'usr-checker-1'
            }
          ],
          linked_debt_note_ids: ['DN-1037', 'DN-1011'],
          linked_ppm_ids: [],
          status: 'ACTIVE_CUSTODED',
          created_by: 'usr-maker-1',
          created_by_individual_id: 'person-alice-001',
          approved_by: 'usr-checker-1',
          approved_by_individual_id: 'person-bob-002',
          signature: signPayload({ id: 'POOL-2026-NV-2', principal: '71590.00' }),
          signature_key_id: ACTIVE_SIGNING_KEY_ID,
          archived: false,
          created_at: now,
          updated_at: now
        });

        await col.doc(pool1.id).set(pool1);
        await col.doc(pool2.id).set(pool2);
        console.log("Seeded initial REMIC asset pools.");
      }
    } catch (e) {
      console.error("Error seeding asset pools:", e);
    }
  }
  seedAssetPoolsIfNeeded();

  // In-memory logs store for integrations
  interface IntegrationLog {
    id: string;
    integrationName: string;
    type: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    latencyMs: number;
    timestamp: string;
    payload: any;
    response: any;
  }

  const integrationLogs: IntegrationLog[] = [
    {
      id: "log-1",
      integrationName: "Gemini AI Core",
      type: "LLM",
      status: "SUCCESS",
      latencyMs: 342,
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      payload: { prompt: "Analyze customer sentiment for Q3 feedback." },
      response: { text: "Customer sentiment is 84% positive, with high satisfaction in performance and API reliability." }
    },
    {
      id: "log-2",
      integrationName: "GitHub Webhook Receiver",
      type: "Webhook",
      status: "SUCCESS",
      latencyMs: 120,
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      payload: { event: "push", repo: "integration-hub-core", ref: "refs/heads/main" },
      response: { status: 200, message: "Webhook accepted and verified." }
    }
  ];

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), security: "hardened_v17" });
  });

  // --- Debt Note Registry API (with authentication, tenant isolation, and cryptographic signing) ---
  app.get("/api/debt-notes", authenticate, authorizeTenant, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const snap = await firestoreAdmin.collection('debt_notes')
        .where('tenant_id', '==', tenantId)
        .get();

      const notes = snap.docs.map(doc => doc.data());
      const totalPrincipal = notes
        .filter(n => !n.archived)
        .reduce((sum, n) => sum + Number(n.principal_value || 0), 0);

      res.json({
        notes,
        summary: {
          total_principal_issued: totalPrincipal.toFixed(2),
          registry_count: notes.filter(n => !n.archived).length,
          archived_count: notes.filter(n => n.archived).length
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Issue new debt note (Requires MAKER role)
  app.post("/api/debt-notes", authenticate, authorizeTenant, authorizeRole('MAKER', 'ADMIN'), async (req, res) => {
    try {
      const { id, cusip, isin, tranche_name, network, principal_value, interest_rate, issuance_date, jurisdiction, ucc_type, ucc_description } = req.body;
      if (!id || !principal_value) {
        return res.status(400).json({ error: "Missing required note ID or principal value" });
      }
      if (cusip && !validateCusip(String(cusip))) {
        return res.status(400).json({ error: "Invalid CUSIP checksum or format (expected 9-character CUSIP with valid check digit)." });
      }
      if (isin && !validateIsin(String(isin))) {
        return res.status(400).json({ error: "Invalid ISIN checksum or format (expected 12-character ISIN with valid Luhn check digit)." });
      }

      const noteId = id.startsWith('DN-') ? id : `DN-${id}`;
      const tenantId = req.user?.tenantId || 'tenant-omega';

      const newNote = {
        id: noteId,
        tenant_id: tenantId,
        cusip: cusip || `JM60${Math.floor(1000 + Math.random() * 9000)}`,
        isin: isin || `US481222${Math.floor(1000 + Math.random() * 9000)}`,
        tranche_name: tranche_name || 'JUNIOR TRANCHE',
        network: network || 'Ethereum',
        status: 'PENDING_CHECKER_APPROVAL',
        ganp_code: `GANP-2025-${Math.floor(100 + Math.random() * 900)}`,
        principal_value: String(principal_value),
        interest_rate: interest_rate || '7.5%',
        issuance_date: issuance_date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        jurisdiction: jurisdiction || 'Delaware',
        filing_date: new Date().toISOString().slice(0, 10),
        ucc_type: ucc_type || 'UCC-1 SECURED',
        ucc_description: ucc_description || 'Fiduciary collateral perfect filing',
        created_by: req.user?.id,
        created_by_individual_id: req.user?.individualId,
        approved_by: null,
        approved_by_individual_id: null,
        signature: null,
        signature_key_id: null,
        archived: false,
        created_at: new Date().toISOString()
      };

      await firestoreAdmin.collection('debt_notes').doc(noteId).set(newNote);
      res.json({ success: true, note: newNote });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve debt note (Distinct-individual 4-eyes Maker-Checker control: no ADMIN self-approval bypass)
  app.post("/api/debt-notes/:id/approve", authenticate, authorizeTenant, authorizeRole('CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('debt_notes').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Debt note not found" });
      }

      const note = doc.data();
      if (note?.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Debt note belongs to another tenant." });
      }
      try {
        assertDistinctMakerChecker(note?.created_by, note?.created_by_individual_id, req.user!);
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }

      const signature = signPayload({ id: note?.id, principal: note?.principal_value, approved_by: req.user?.id });

      await docRef.update({
        status: '31 CFR SEC PERFECTLY CUSTODED',
        approved_by: req.user?.id,
        approved_by_individual_id: req.user?.individualId,
        signature,
        signature_key_id: ACTIVE_SIGNING_KEY_ID,
        updated_at: new Date().toISOString()
      });

      res.json({ success: true, message: "Debt note cryptographically signed and approved under distinct-individual four-eyes control.", signature, signature_key_id: ACTIVE_SIGNING_KEY_ID });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Soft delete / archive debt note (Strict No-Delete Compliance Policy)
  app.delete("/api/debt-notes/:id", authenticate, authorizeTenant, authorizeRole('ADMIN', 'CHECKER'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('debt_notes').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Note not found" });
      if (doc.data()?.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Debt note belongs to another tenant." });
      }

      await docRef.update({
        archived: true,
        archived_at: new Date().toISOString(),
        archived_by: req.user?.id
      });

      res.json({ success: true, message: "Note soft-deleted and archived in compliance with strict retention policy." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Cryptographic Audit Report for a Debt Note
  app.get("/api/debt-notes/:id/audit", authenticate, authorizeTenant, async (req, res) => {
    try {
      const { id } = req.params;
      const doc = await firestoreAdmin.collection('debt_notes').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: "Note not found" });

      const data = doc.data();
      if (data?.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Debt note belongs to another tenant." });
      }
      const keyId = data?.signature_key_id || ACTIVE_SIGNING_KEY_ID;
      const isValid = data?.signature
        ? verifySignature({ id: data.id, principal: data.principal_value, approved_by: data.approved_by }, data.signature, keyId)
        : false;

      res.json({
        note_id: data?.id,
        cusip: data?.cusip,
        isin: data?.isin,
        principal: data?.principal_value,
        signature_valid: isValid,
        signature_key_id: keyId,
        signature: data?.signature,
        created_by: data?.created_by,
        approved_by: data?.approved_by,
        compliance: "Verified against registered RSA public key."
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PPM & Securities Offering Management API ---
  async function recordPpmAuditEvent(tenantId: string, action: string, payload: any) {
    try {
      await db.transaction(async (tx) => {
        await createAuditRecord(tx, action, payload, tenantId);
      });
    } catch (err) {
      console.error("Failed to persist PPM audit log:", err);
    }
  }

  app.get("/api/ppm/offerings", authenticate, authorizeTenant, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const snap = await firestoreAdmin.collection('ppm_offerings')
        .where('tenant_id', '==', tenantId)
        .get();
      const offerings = snap.docs.map(doc => normalizePpmOffering(doc.data()));
      const enriched = offerings.map(off => ({
        ...off,
        compliance_evaluation: evaluateOfferingComplianceGates(off, offerings)
      }));
      res.json({ offerings: enriched, compliance_disclaimer: COMPLIANCE_DISCLAIMER });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ppm/offerings", authenticate, authorizeTenant, authorizeRole('MAKER', 'ADMIN'), async (req, res) => {
    try {
      const {
        id,
        title,
        exemption_pathway,
        offering_amount,
        affiliate_offering_amount,
        minimum_investment,
        maturity_months,
        target_interest_rate,
        linked_debt_note_id,
        linked_pool_id,
        is_tokenized_security,
        risk_factors,
        use_of_proceeds,
        offering_expenses,
        fees_and_compensation,
        conflicts_of_interest,
        related_party_transactions,
        investor_eligibility,
        transfer_restrictions,
        general_solicitation_used,
        us_directed_selling_efforts,
        audited_financials_attached,
        auditor_firm,
        national_exchange_listed,
        reg_a_state_registrations,
        ongoing_sec_reporting,
        offering_start_date,
        offering_end_date,
        placement_agent
      } = req.body;

      if (!title || !offering_amount) {
        return res.status(400).json({ error: "Missing required title or offering amount" });
      }

      let validatedPathway;
      try {
        validatedPathway = assertOperativeExemptionPathway(exemption_pathway || 'RULE_506_C');
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }

      const amountNum = Number(offering_amount);
      const affiliateNum = Number(affiliate_offering_amount || 0);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "Offering amount must be a positive number." });
      }
      if (Number.isNaN(affiliateNum) || affiliateNum < 0) {
        return res.status(400).json({ error: "Affiliate selling-securityholder amount cannot be negative." });
      }
      if (validatedPathway === 'RULE_506_B' && Boolean(general_solicitation_used)) {
        return res.status(400).json({ error: "Rule 506(b) prohibits general solicitation or general advertising." });
      }
      if (validatedPathway === 'REG_A_TIER_1') {
        if (amountNum > REG_A_TIER_1_CAP_USD) {
          return res.status(400).json({ error: `Regulation A Tier 1 offering cannot exceed $${REG_A_TIER_1_CAP_USD.toLocaleString()} in a 12-month period.` });
        }
        if (affiliateNum > REG_A_TIER_1_AFFILIATE_CAP_USD) {
          return res.status(400).json({ error: `Regulation A Tier 1 affiliate selling-securityholder limit is $${REG_A_TIER_1_AFFILIATE_CAP_USD.toLocaleString()}.` });
        }
      }
      if (validatedPathway === 'REG_A_TIER_2') {
        if (amountNum > REG_A_TIER_2_CAP_USD) {
          return res.status(400).json({ error: `Regulation A Tier 2 offering cannot exceed $${REG_A_TIER_2_CAP_USD.toLocaleString()} in a 12-month period.` });
        }
        if (affiliateNum > REG_A_TIER_2_AFFILIATE_CAP_USD) {
          return res.status(400).json({ error: `Regulation A Tier 2 affiliate selling-securityholder limit is $${REG_A_TIER_2_AFFILIATE_CAP_USD.toLocaleString()}.` });
        }
      }
      if (validatedPathway === 'REG_S' && Boolean(us_directed_selling_efforts)) {
        return res.status(400).json({ error: "Regulation S prohibits US directed selling efforts." });
      }

      const offeringId = id ? (String(id).startsWith('PPM-') ? String(id) : `PPM-${id}`) : `PPM-${Math.floor(1000 + Math.random() * 9000)}`;
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const now = new Date().toISOString();

      // Enforce cumulative 12-month Reg A cap across tenant offerings
      if (validatedPathway === 'REG_A_TIER_1' || validatedPathway === 'REG_A_TIER_2') {
        const peerSnap = await firestoreAdmin.collection('ppm_offerings').where('tenant_id', '==', tenantId).get();
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const recentRegATotal = peerSnap.docs
          .map(d => normalizePpmOffering(d.data()))
          .filter(o => (o.exemption_pathway === 'REG_A_TIER_1' || o.exemption_pathway === 'REG_A_TIER_2') && o.status !== 'ARCHIVED' && new Date(o.created_at).getTime() >= oneYearAgo)
          .reduce((sum, o) => sum + Number(o.offering_amount || 0), 0);
        const cap = validatedPathway === 'REG_A_TIER_1' ? REG_A_TIER_1_CAP_USD : REG_A_TIER_2_CAP_USD;
        if (recentRegATotal + amountNum > cap) {
          return res.status(400).json({
            error: `${validatedPathway} 12-month cumulative cap exceeded: existing $${recentRegATotal.toLocaleString()} + requested $${amountNum.toLocaleString()} > $${cap.toLocaleString()}.`
          });
        }
      }

      const hasPa = Boolean(placement_agent?.has_placement_agent);
      const isFinraMember = Boolean(placement_agent?.finra_member);

      const draft = normalizePpmOffering({
        id: offeringId,
        tenant_id: tenantId,
        title,
        exemption_pathway: validatedPathway,
        counsel_selected_pathway: false,
        offering_amount: String(offering_amount),
        affiliate_offering_amount: String(affiliateNum.toFixed(2)),
        minimum_investment: String(minimum_investment || '100000.00'),
        maturity_months: Number(maturity_months || 12),
        target_interest_rate: target_interest_rate || '8.0%',
        linked_debt_note_id: linked_debt_note_id || '',
        linked_pool_id: linked_pool_id || '',
        is_tokenized_security: Boolean(is_tokenized_security),
        tokenized_asset_classification_verified: false,
        risk_factors: Array.isArray(risk_factors) && risk_factors.length > 0 ? risk_factors : ['General market, credit, and illiquidity risks'],
        use_of_proceeds: use_of_proceeds || 'Working capital and secured asset collateralization.',
        offering_expenses: offering_expenses || 'Legal, audit, and regulatory notice filing expenses disclosed to investors.',
        fees_and_compensation: fees_and_compensation || 'Sponsor administration fee; no undisclosed placement agent compensation.',
        conflicts_of_interest: conflicts_of_interest || 'Sponsor affiliate relationships disclosed in memorandum.',
        related_party_transactions: related_party_transactions || 'Disclosed servicing agreements only.',
        investor_eligibility: investor_eligibility || 'Accredited Investors / Qualified Purchasers',
        transfer_restrictions: transfer_restrictions || 'Statutory Rule 144 transfer restrictions apply.',
        general_solicitation_used: validatedPathway === 'RULE_506_C' ? Boolean(general_solicitation_used ?? true) : false,
        us_directed_selling_efforts: Boolean(us_directed_selling_efforts),
        form_1a_qualified: false,
        audited_financials_attached: Boolean(audited_financials_attached),
        auditor_firm: auditor_firm || '',
        national_exchange_listed: Boolean(national_exchange_listed),
        reg_a_state_registrations: Array.isArray(reg_a_state_registrations) ? reg_a_state_registrations : [],
        ongoing_sec_reporting: ongoing_sec_reporting || { form_1u_monitoring_enabled: validatedPathway === 'REG_A_TIER_2' },
        offering_start_date: offering_start_date || now.slice(0, 10),
        offering_end_date: offering_end_date || undefined,
        concurrent_offerings_checked: true,
        bad_actor_screened: false,
        bad_actor_disqualifying_event: false,
        bad_actor_written_disclosure_delivered: false,
        covered_persons: [],
        placement_agent: {
          has_placement_agent: hasPa,
          firm_name: placement_agent?.firm_name || '',
          crd_number: placement_agent?.crd_number || '',
          finra_member: isFinraMember,
          commission_bps: Number(placement_agent?.commission_bps || 0),
          finder_fee_usd: String(placement_agent?.finder_fee_usd || '0.00'),
          sales_compensation_disclosed: Boolean(placement_agent?.sales_compensation_disclosed ?? !hasPa)
        },
        finra_5123_filing: {
          required: hasPa && isFinraMember,
          exemption_claimed: 'NONE',
          sr_finra_2026_002_operative_confirmed: false,
          filing_status: hasPa && isFinraMember ? 'PENDING' : 'NOT_REQUIRED',
          retail_communications_logged: []
        },
        version: 1,
        document_sha256: '',
        version_history: [],
        status: 'PENDING_CHECKER_APPROVAL',
        created_by: req.user?.id,
        created_by_individual_id: req.user?.individualId,
        approved_by: null,
        approved_by_individual_id: null,
        counsel_reviewed: false,
        counsel_reviewer: null,
        counsel_review_date: null,
        counsel_review_record: null,
        signature: null,
        signature_key_id: null,
        created_at: now,
        updated_at: now
      });

      await firestoreAdmin.collection('ppm_offerings').doc(offeringId).set(draft);
      await recordPpmAuditEvent(tenantId, 'PPM_OFFERING_DRAFTED', {
        offering_id: offeringId,
        pathway: validatedPathway,
        document_sha256: draft.document_sha256,
        created_by: req.user?.id
      });

      const evaluation = evaluateOfferingComplianceGates(draft, []);
      res.json({ success: true, offering: { ...draft, compliance_evaluation: evaluation } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ppm/offerings/:id/approve", authenticate, authorizeTenant, authorizeRole('CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const offering = normalizePpmOffering(doc.data());
      if (offering.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }
      try {
        assertDistinctMakerChecker(offering.created_by, offering.created_by_individual_id, req.user!);
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }

      const signature = signPayload({ id: offering.id, amount: offering.offering_amount, document_sha256: offering.document_sha256, approved_by: req.user?.id });
      const now = new Date().toISOString();

      await docRef.update({
        status: 'APPROVED',
        approved_by: req.user?.id,
        approved_by_individual_id: req.user?.individualId,
        signature,
        signature_key_id: ACTIVE_SIGNING_KEY_ID,
        updated_at: now
      });

      await recordPpmAuditEvent(offering.tenant_id, 'PPM_OFFERING_APPROVED', {
        offering_id: offering.id,
        approved_by: req.user?.id,
        document_sha256: offering.document_sha256
      });

      res.json({ success: true, message: "PPM offering approved under distinct-individual four-eyes control.", signature, signature_key_id: ACTIVE_SIGNING_KEY_ID });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ppm/offerings/:id/counsel-review", authenticate, authorizeTenant, authorizeRole('ADMIN', 'CHECKER'), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        reviewer,
        reviewer_name,
        firm_or_bar_ref,
        scope,
        decision,
        evidence_ref,
        counsel_selected_pathway,
        tokenized_asset_classification_verified,
        tokenized_counsel_memo_ref,
        rule_152_counsel_clearance,
        form_1a_qualified
      } = req.body;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      const resolvedReviewer = String(reviewer_name || reviewer || '').trim();
      const resolvedScope = String(scope || '').trim();
      const resolvedDecision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED' = decision || 'APPROVED';
      const resolvedEvidenceRef = String(evidence_ref || tokenized_counsel_memo_ref || '').trim();

      if (!resolvedReviewer || !resolvedScope || !resolvedEvidenceRef) {
        return res.status(400).json({
          error: "Counsel review gate: Named reviewer, explicit review scope, decision, and documentary evidence reference are required."
        });
      }

      if (current.is_tokenized_security && tokenized_asset_classification_verified === false) {
        return res.status(400).json({
          error: "SEC Release 33-11412 gate: Tokenized securities require explicit securities classification sign-off."
        });
      }

      const now = new Date().toISOString();
      const counselRecord: CounselReviewRecord = {
        reviewer_name: resolvedReviewer,
        firm_or_bar_ref: String(firm_or_bar_ref || 'Registered Securities Counsel').trim(),
        scope: resolvedScope,
        decision: resolvedDecision,
        timestamp: now,
        evidence_ref: resolvedEvidenceRef
      };

      const updatedOffering: PPMOffering = {
        ...current,
        counsel_reviewed: resolvedDecision !== 'REJECTED',
        counsel_selected_pathway: counsel_selected_pathway !== false && resolvedDecision !== 'REJECTED',
        counsel_reviewer: resolvedReviewer,
        counsel_review_date: now,
        counsel_review_record: counselRecord,
        tokenized_asset_classification_verified: current.is_tokenized_security
          ? Boolean(tokenized_asset_classification_verified ?? (resolvedDecision !== 'REJECTED'))
          : current.tokenized_asset_classification_verified,
        tokenized_counsel_memo_ref: tokenized_counsel_memo_ref || current.tokenized_counsel_memo_ref,
        rule_152_counsel_clearance: Boolean(rule_152_counsel_clearance ?? current.rule_152_counsel_clearance),
        form_1a_qualified: Boolean(form_1a_qualified ?? current.form_1a_qualified),
        updated_at: now
      };

      const peerSnap = await firestoreAdmin.collection('ppm_offerings').where('tenant_id', '==', current.tenant_id).get();
      const peers = peerSnap.docs.map(d => normalizePpmOffering(d.data()));
      const evalResult = evaluateOfferingComplianceGates(updatedOffering, peers);

      const nextStatus =
        resolvedDecision === 'REJECTED'
          ? 'BLOCKED_COMPLIANCE'
          : evalResult.distribution_ready
            ? 'DISTRIBUTION_READY'
            : 'COUNSEL_REVIEWED';

      await docRef.update({
        counsel_reviewed: updatedOffering.counsel_reviewed,
        counsel_selected_pathway: updatedOffering.counsel_selected_pathway,
        counsel_reviewer: updatedOffering.counsel_reviewer,
        counsel_review_date: now,
        counsel_review_record: counselRecord,
        tokenized_asset_classification_verified: updatedOffering.tokenized_asset_classification_verified,
        tokenized_counsel_memo_ref: updatedOffering.tokenized_counsel_memo_ref,
        rule_152_counsel_clearance: updatedOffering.rule_152_counsel_clearance,
        form_1a_qualified: updatedOffering.form_1a_qualified,
        status: nextStatus,
        updated_at: now
      });

      await recordPpmAuditEvent(current.tenant_id, 'PPM_COUNSEL_REVIEW_RECORDED', {
        offering_id: current.id,
        counsel_reviewer: resolvedReviewer,
        scope: resolvedScope,
        decision: resolvedDecision,
        evidence_ref: resolvedEvidenceRef,
        distribution_ready: evalResult.distribution_ready
      });

      res.json({
        success: true,
        status: nextStatus,
        counsel_review_record: counselRecord,
        compliance_evaluation: evalResult,
        message: "Qualified securities counsel review recorded. Legal review does not constitute SEC/FINRA regulatory authorization."
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Amend PPM disclosures -> creates new immutable version & requires fresh 4-eyes and counsel review
  app.post("/api/ppm/offerings/:id/amend", authenticate, authorizeTenant, authorizeRole('MAKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const { change_summary, ...updates } = req.body;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      if (updates.exemption_pathway) {
        try {
          updates.exemption_pathway = assertOperativeExemptionPathway(updates.exemption_pathway);
        } catch (e: any) {
          return res.status(400).json({ error: e.message });
        }
      }

      const now = new Date().toISOString();
      const nextVersion = current.version + 1;
      const amended: PPMOffering = {
        ...current,
        title: updates.title || current.title,
        exemption_pathway: updates.exemption_pathway || current.exemption_pathway,
        offering_amount: updates.offering_amount ? String(updates.offering_amount) : current.offering_amount,
        risk_factors: Array.isArray(updates.risk_factors) ? updates.risk_factors : current.risk_factors,
        use_of_proceeds: updates.use_of_proceeds || current.use_of_proceeds,
        offering_expenses: updates.offering_expenses || current.offering_expenses,
        fees_and_compensation: updates.fees_and_compensation || current.fees_and_compensation,
        conflicts_of_interest: updates.conflicts_of_interest || current.conflicts_of_interest,
        transfer_restrictions: updates.transfer_restrictions || current.transfer_restrictions,
        version: nextVersion,
        document_sha256: '',
        status: 'PENDING_CHECKER_APPROVAL',
        approved_by: null,
        approved_by_individual_id: null,
        counsel_reviewed: false,
        counsel_reviewer: null,
        counsel_review_date: null,
        counsel_review_record: null,
        signature: null,
        signature_key_id: null,
        updated_at: now
      };
      amended.document_sha256 = computePpmDocumentHash(amended);
      amended.version_history = [
        ...current.version_history,
        {
          version: nextVersion,
          sha256: amended.document_sha256,
          created_at: now,
          created_by: req.user?.id || 'unknown',
          change_summary: change_summary || 'Material PPM amendment'
        }
      ];

      await docRef.set(amended);
      await recordPpmAuditEvent(current.tenant_id, 'PPM_OFFERING_AMENDED', {
        offering_id: current.id,
        version: nextVersion,
        document_sha256: amended.document_sha256
      });

      res.json({ success: true, offering: amended });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Record Rule 506(d) Bad-Actor Screening
  app.post("/api/ppm/offerings/:id/bad-actor-screen", authenticate, authorizeTenant, authorizeRole('MAKER', 'CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const { covered_persons, bad_actor_written_disclosure_delivered } = req.body;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      if (!Array.isArray(covered_persons) || covered_persons.length === 0) {
        return res.status(400).json({ error: "Rule 506(d) screening requires at least one covered person factual inquiry record." });
      }

      const disqualifyingFound = covered_persons.some((cp: any) => Boolean(cp.disqualifying_event_found));
      const now = new Date().toISOString();

      await docRef.update({
        bad_actor_screened: true,
        bad_actor_disqualifying_event: disqualifyingFound,
        bad_actor_written_disclosure_delivered: Boolean(bad_actor_written_disclosure_delivered),
        covered_persons,
        updated_at: now
      });

      await recordPpmAuditEvent(current.tenant_id, 'PPM_506D_SCREENING_RECORDED', {
        offering_id: current.id,
        covered_persons_count: covered_persons.length,
        disqualifying_event_found: disqualifyingFound
      });

      res.json({ success: true, bad_actor_screened: true, disqualifying_event_found: disqualifyingFound });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Onboard / verify investor subscription with Rule 506(b)/(c), Reg S, FINRA 5123, Form D & Nevada NAC 90.5145 triggers
  app.post("/api/ppm/offerings/:id/investors", authenticate, authorizeTenant, authorizeRole('MAKER', 'CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      const peerSnap = await firestoreAdmin.collection('ppm_offerings').where('tenant_id', '==', current.tenant_id).get();
      const peers = peerSnap.docs.map(d => normalizePpmOffering(d.data()));
      const gateEval = evaluateOfferingComplianceGates(current, peers);
      if (!gateEval.distribution_ready) {
        return res.status(422).json({
          error: "Offering failed release-blocking compliance gates and cannot accept investor subscriptions.",
          blockers: gateEval.blockers
        });
      }

      const subDate = (req.body.subscription_date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const investorRecord: InvestorComplianceRecord = {
        id: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        investor_label: req.body.investor_label || 'Institutional Subscriber',
        accredited: Boolean(req.body.accredited),
        verification_method: req.body.verification_method || 'SELF_ATTESTATION_CHECKBOX',
        verification_evidence_ref: req.body.verification_evidence_ref || '',
        sophisticated_verified: Boolean(req.body.sophisticated_verified),
        rule_502b_disclosures_delivered: Boolean(req.body.rule_502b_disclosures_delivered),
        rule_501e_counting_weight: req.body.rule_501e_counting_weight,
        rule_501e_exclusion_reason: req.body.rule_501e_exclusion_reason || '',
        annual_income_or_revenue_usd: req.body.annual_income_or_revenue_usd,
        net_worth_or_assets_usd: req.body.net_worth_or_assets_usd,
        reg_a_tier2_10pct_cap_verified: Boolean(req.body.reg_a_tier2_10pct_cap_verified),
        ppm_version_delivered: Number(req.body.ppm_version_delivered ?? current.version),
        ppm_hash_delivered: req.body.ppm_hash_delivered || current.document_sha256,
        q_and_a_acknowledged: Boolean(req.body.q_and_a_acknowledged),
        solicited_by: req.body.solicited_by || '',
        state_of_residence: req.body.state_of_residence || 'Delaware',
        is_us_person: Boolean(req.body.is_us_person ?? true),
        subscription_date: subDate,
        investment_amount: String(req.body.investment_amount || current.minimum_investment)
      };

      try {
        validateInvestorOnboarding(current, investorRecord);
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }

      // Write-once immutable first-sale event anchors
      const nowIso = new Date().toISOString();
      const firstCommitmentEvent = current.first_irrevocable_commitment_event || {
        recorded_at: nowIso,
        event_date: current.first_irrevocable_commitment_date || subDate,
        investor_id: investorRecord.id,
        immutable: true as const
      };
      const firstCommitment = firstCommitmentEvent.event_date;

      const isNevada = investorRecord.state_of_residence.toUpperCase() === 'NV' || investorRecord.state_of_residence.toUpperCase() === 'NEVADA';
      const firstNvEvent = current.first_nevada_sale_event || (isNevada ? {
        recorded_at: nowIso,
        event_date: current.first_nevada_sale_date || subDate,
        investor_id: investorRecord.id,
        immutable: true as const
      } : null);
      const firstNvSale = firstNvEvent?.event_date;

      const updatedFormD = {
        ...current.form_d_tracking,
        due_date: addCalendarDays(firstCommitment, 15),
        annual_renewal_due: addCalendarYears(firstCommitment, 1)
      };

      const updatedNevada = firstNvSale ? {
        ...current.nevada_nac_90_5145,
        applicable: true,
        fee_usd: NEVADA_NAC_90_5145_FEE_USD,
        amendment_fee_usd: 0,
        due_date: addCalendarDays(firstNvSale, 15),
        effective_until: addCalendarYears(firstNvSale, 1),
        status: current.nevada_nac_90_5145.status === 'FILED' ? 'FILED' : 'PENDING'
      } : current.nevada_nac_90_5145;

      const updatedFinra5123 = current.placement_agent.has_placement_agent && current.placement_agent.finra_member
        ? {
            ...current.finra_5123_filing,
            required: true,
            deadline_date: addCalendarDays(firstCommitment, 15)
          }
        : current.finra_5123_filing;

      const updatedRecords = [...current.investor_records, investorRecord];
      await docRef.update({
        investor_records: updatedRecords,
        first_irrevocable_commitment_date: firstCommitment,
        first_irrevocable_commitment_event: firstCommitmentEvent,
        first_nevada_sale_date: firstNvSale || null,
        first_nevada_sale_event: firstNvEvent,
        form_d_tracking: updatedFormD,
        nevada_nac_90_5145: updatedNevada,
        finra_5123_filing: updatedFinra5123,
        updated_at: nowIso
      });

      await recordPpmAuditEvent(current.tenant_id, 'PPM_INVESTOR_ONBOARDED', {
        offering_id: current.id,
        investor_id: investorRecord.id,
        verification_method: investorRecord.verification_method,
        state: investorRecord.state_of_residence
      });

      res.json({
        success: true,
        investor: investorRecord,
        first_irrevocable_commitment_event: firstCommitmentEvent,
        first_nevada_sale_event: firstNvEvent,
        deadlines: {
          federal_form_d_due: updatedFormD.due_date,
          nevada_nac_90_5145_due: updatedNevada.due_date,
          finra_5123_due: updatedFinra5123.deadline_date
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Form D, Nevada NAC 90.5145, and FINRA Rule 5123 filing statuses
  app.post("/api/ppm/offerings/:id/filings", authenticate, authorizeTenant, authorizeRole('MAKER', 'CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const { form_d_tracking, nevada_nac_90_5145, finra_5123_filing, state_notice_filings } = req.body;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      if (
        finra_5123_filing &&
        (finra_5123_filing.exemption_claimed === 'RULE_501_A_9_ENTITY_5M' ||
          finra_5123_filing.exemption_claimed === 'RULE_501_A_12_FAMILY_OFFICE_5M') &&
        !finra_5123_filing.sr_finra_2026_002_operative_confirmed
      ) {
        return res.status(400).json({
          error: "SR-FINRA-2026-002 compliance gate: Confirming the FINRA Regulatory Notice effective date is required before claiming the expanded Rule 501(a)(9) or 501(a)(12) Rule 5123 exemption."
        });
      }

      const now = new Date().toISOString();
      const patch: any = { updated_at: now };
      if (form_d_tracking) patch.form_d_tracking = { ...current.form_d_tracking, ...form_d_tracking };
      if (nevada_nac_90_5145) patch.nevada_nac_90_5145 = { ...current.nevada_nac_90_5145, ...nevada_nac_90_5145 };
      if (finra_5123_filing) patch.finra_5123_filing = { ...current.finra_5123_filing, ...finra_5123_filing };
      if (Array.isArray(state_notice_filings)) patch.state_notice_filings = state_notice_filings;

      await docRef.update(patch);
      await recordPpmAuditEvent(current.tenant_id, 'PPM_REGULATORY_FILING_UPDATED', {
        offering_id: current.id,
        updated_sections: Object.keys(patch)
      });

      res.json({ success: true, ...patch });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Evaluate release-blocking compliance gates
  app.post("/api/ppm/offerings/:id/release-check", authenticate, authorizeTenant, async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('ppm_offerings').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Offering not found" });

      const current = normalizePpmOffering(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Offering belongs to another tenant." });
      }

      const peerSnap = await firestoreAdmin.collection('ppm_offerings').where('tenant_id', '==', current.tenant_id).get();
      const peers = peerSnap.docs.map(d => normalizePpmOffering(d.data()));
      const evalResult = evaluateOfferingComplianceGates(current, peers);

      if (evalResult.distribution_ready) {
        await docRef.update({ status: 'DISTRIBUTION_READY', updated_at: new Date().toISOString() });
        return res.json({ success: true, status: 'DISTRIBUTION_READY', compliance_evaluation: evalResult });
      }

      return res.status(422).json({
        success: false,
        status: current.status,
        compliance_evaluation: evalResult
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- REMIC Collateral Asset Pool Management API ---
  app.get("/api/pools", authenticate, authorizeTenant, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const snap = await firestoreAdmin.collection('asset_pools')
        .where('tenant_id', '==', tenantId)
        .get();
      const pools = snap.docs
        .map(doc => normalizeAssetPool(doc.data()))
        .filter(p => !p.archived)
        .map(p => ({ ...p, link_readiness: evaluatePoolLinkReadiness(p) }));
      const totalPrincipal = pools.reduce((sum, p) => sum + Number(p.total_principal_value || 0), 0);
      res.json({
        pools,
        summary: {
          pool_count: pools.length,
          active_count: pools.filter(p => p.status === 'ACTIVE_CUSTODED').length,
          perfected_and_link_ready_count: pools.filter(p => p.link_readiness.ready_for_linkage).length,
          total_principal_value: totalPrincipal.toFixed(2)
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pools", authenticate, authorizeTenant, authorizeRole('MAKER', 'ADMIN'), async (req, res) => {
    try {
      const {
        id,
        pool_name,
        pool_type,
        custodian,
        jurisdiction,
        debtor_legal_name,
        total_principal_value,
        weighted_avg_coupon,
        weighted_avg_maturity_months,
        asset_count,
        ucc_filing_ref,
        underlying_assets_evidence_ref,
        ownership_evidence_ref,
        custody_evidence_ref
      } = req.body;

      if (!pool_name || !total_principal_value) {
        return res.status(400).json({ error: "Missing required pool name or total principal value." });
      }
      if (!underlying_assets_evidence_ref || String(underlying_assets_evidence_ref).trim().length < 4) {
        return res.status(400).json({ error: "Independent evidence reference of underlying pool assets (underlying_assets_evidence_ref) is required." });
      }
      const principalNum = Number(total_principal_value);
      if (Number.isNaN(principalNum) || principalNum <= 0) {
        return res.status(400).json({ error: "Total principal value must be a positive number." });
      }

      const allowedTypes = ['MORTGAGE_REMIC', 'TREASURY_COLLATERAL', 'COMMERCIAL_REAL_ESTATE', 'MIXED_FIXED_INCOME'];
      const resolvedType = allowedTypes.includes(pool_type) ? pool_type : 'MORTGAGE_REMIC';
      const poolId = id ? (String(id).startsWith('POOL-') ? String(id) : `POOL-${id}`) : `POOL-${Math.floor(1000 + Math.random() * 9000)}`;
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const now = new Date().toISOString();

      const newPool = normalizeAssetPool({
        id: poolId,
        tenant_id: tenantId,
        pool_name: String(pool_name).trim(),
        pool_type: resolvedType,
        custodian: custodian || 'Malachite Fiduciary Trust (31 CFR Custody)',
        jurisdiction: jurisdiction || 'Delaware',
        debtor_legal_name: debtor_legal_name || 'Sovereign REMIC Trust LLC',
        total_principal_value: principalNum.toFixed(2),
        weighted_avg_coupon: weighted_avg_coupon || '8.50%',
        weighted_avg_maturity_months: Number(weighted_avg_maturity_months || 36),
        asset_count: Number(asset_count || 1),
        ucc_filing_ref: ucc_filing_ref || '',
        verification: {
          asset_ownership_verified: false,
          ownership_evidence_ref: ownership_evidence_ref || '',
          custody_independently_verified: false,
          custody_evidence_ref: custody_evidence_ref || '',
          assignment_transfer_authority_verified: false,
          ucc_filing_evidence_received: Boolean(ucc_filing_ref),
          filing_jurisdiction_debtor_name_verified: false,
          security_interest_perfection_reviewed: false,
          pool_valuation_eligibility_approved: false,
          underlying_assets_evidence_ref: String(underlying_assets_evidence_ref).trim(),
          approved_for_offering_linkage: false
        },
        allocated_obligations: [],
        linked_debt_note_ids: [],
        linked_ppm_ids: [],
        status: 'PENDING_CHECKER_APPROVAL',
        created_by: req.user?.id,
        created_by_individual_id: req.user?.individualId,
        approved_by: null,
        approved_by_individual_id: null,
        signature: null,
        signature_key_id: null,
        archived: false,
        created_at: now,
        updated_at: now
      });

      await firestoreAdmin.collection('asset_pools').doc(poolId).set(newPool);
      await recordPpmAuditEvent(tenantId, 'ASSET_POOL_CREATED', {
        pool_id: poolId,
        pool_name: newPool.pool_name,
        total_principal_value: newPool.total_principal_value,
        underlying_assets_evidence_ref: newPool.verification.underlying_assets_evidence_ref,
        created_by: req.user?.id
      });

      res.json({ success: true, pool: { ...newPool, link_readiness: evaluatePoolLinkReadiness(newPool) } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Record independent verification & legal perfection stages (UCC-1 ref alone !== perfection)
  app.post("/api/pools/:id/verify-stages", authenticate, authorizeTenant, authorizeRole('CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('asset_pools').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Asset pool not found" });

      const current = normalizeAssetPool(doc.data());
      if (current.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Asset pool belongs to another tenant." });
      }
      try {
        assertDistinctMakerChecker(current.created_by, current.created_by_individual_id, req.user!);
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }

      const now = new Date().toISOString();
      const updatedVerification = {
        ...current.verification,
        ...req.body,
        perfection_reviewer: req.body.perfection_reviewer || current.verification.perfection_reviewer || req.user?.name,
        perfection_review_date: req.body.security_interest_perfection_reviewed ? now : current.verification.perfection_review_date
      };

      await docRef.update({
        verification: updatedVerification,
        updated_at: now
      });

      const updatedPool = { ...current, verification: updatedVerification };
      const readiness = evaluatePoolLinkReadiness(updatedPool);

      await recordPpmAuditEvent(current.tenant_id, 'ASSET_POOL_STAGES_VERIFIED', {
        pool_id: current.id,
        verified_by: req.user?.id,
        ready_for_linkage: readiness.ready_for_linkage
      });

      res.json({ success: true, verification: updatedVerification, link_readiness: readiness });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pools/:id/approve", authenticate, authorizeTenant, authorizeRole('CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection('asset_pools').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Asset pool not found" });

      const pool = normalizeAssetPool(doc.data());
      if (pool.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Asset pool belongs to another tenant." });
      }
      try {
        assertDistinctMakerChecker(pool.created_by, pool.created_by_individual_id, req.user!);
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }

      const signature = signPayload({ id: pool.id, principal: pool.total_principal_value, approved_by: req.user?.id });
      const now = new Date().toISOString();

      await docRef.update({
        status: 'ACTIVE_CUSTODED',
        approved_by: req.user?.id,
        approved_by_individual_id: req.user?.individualId,
        signature,
        signature_key_id: ACTIVE_SIGNING_KEY_ID,
        updated_at: now
      });

      await recordPpmAuditEvent(pool.tenant_id, 'ASSET_POOL_APPROVED', {
        pool_id: pool.id,
        approved_by: req.user?.id
      });

      res.json({
        success: true,
        message: "Asset pool approved under distinct-individual four-eyes control. Note: Operational approval does not establish UCC perfection without legal perfection review.",
        signature,
        signature_key_id: ACTIVE_SIGNING_KEY_ID
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Strict collateral linkage with perfection verification + duplicate/over-pledge prevention
  app.post("/api/pools/:id/link", authenticate, authorizeTenant, authorizeRole('MAKER', 'CHECKER', 'ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const { debt_note_id, ppm_id, allocated_amount } = req.body;
      const docRef = firestoreAdmin.collection('asset_pools').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Asset pool not found" });

      const pool = normalizeAssetPool(doc.data());
      if (pool.tenant_id !== req.user?.tenantId) {
        return res.status(403).json({ error: "Tenant isolation violation: Asset pool belongs to another tenant." });
      }
      if (!debt_note_id && !ppm_id) {
        return res.status(400).json({ error: "Provide either debt_note_id or ppm_id to link." });
      }

      const now = new Date().toISOString();
      const updatedAllocations = [...pool.allocated_obligations];
      const linkedNotes = [...pool.linked_debt_note_ids];
      const linkedPpms = [...pool.linked_ppm_ids];

      if (debt_note_id) {
        const noteDoc = await firestoreAdmin.collection('debt_notes').doc(debt_note_id).get();
        if (!noteDoc.exists || noteDoc.data()?.tenant_id !== req.user?.tenantId) {
          return res.status(404).json({ error: "Referenced debt note not found in this tenant." });
        }
        const allocAmt = Number(allocated_amount || noteDoc.data()?.principal_value || 0);
        try {
          assertPoolCanAllocate({ ...pool, allocated_obligations: updatedAllocations }, 'DEBT_NOTE', debt_note_id, allocAmt);
        } catch (e: any) {
          return res.status(409).json({ error: e.message });
        }
        updatedAllocations.push({
          id: `ALLOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          target_type: 'DEBT_NOTE',
          target_id: debt_note_id,
          allocated_amount: allocAmt.toFixed(2),
          linked_at: now,
          linked_by: req.user?.id || 'unknown'
        });
        if (!linkedNotes.includes(debt_note_id)) linkedNotes.push(debt_note_id);
      }

      if (ppm_id) {
        const ppmDoc = await firestoreAdmin.collection('ppm_offerings').doc(ppm_id).get();
        if (!ppmDoc.exists || ppmDoc.data()?.tenant_id !== req.user?.tenantId) {
          return res.status(404).json({ error: "Referenced PPM offering not found in this tenant." });
        }
        const offering = normalizePpmOffering(ppmDoc.data());
        const allocAmt = Number(allocated_amount || offering.offering_amount || 0);
        try {
          assertPoolCanAllocate({ ...pool, allocated_obligations: updatedAllocations }, 'PPM_OFFERING', ppm_id, allocAmt);
        } catch (e: any) {
          return res.status(409).json({ error: e.message });
        }
        updatedAllocations.push({
          id: `ALLOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          target_type: 'PPM_OFFERING',
          target_id: ppm_id,
          allocated_amount: allocAmt.toFixed(2),
          linked_at: now,
          linked_by: req.user?.id || 'unknown'
        });
        if (!linkedPpms.includes(ppm_id)) linkedPpms.push(ppm_id);
        await firestoreAdmin.collection('ppm_offerings').doc(ppm_id).update({ linked_pool_id: pool.id, updated_at: now });
      }

      await docRef.update({
        allocated_obligations: updatedAllocations,
        linked_debt_note_ids: linkedNotes,
        linked_ppm_ids: linkedPpms,
        updated_at: now
      });

      await recordPpmAuditEvent(pool.tenant_id, 'ASSET_POOL_LINKED', {
        pool_id: id,
        debt_note_id: debt_note_id || null,
        ppm_id: ppm_id || null,
        allocated_amount: allocated_amount || null
      });

      res.json({
        success: true,
        linked_debt_note_ids: linkedNotes,
        linked_ppm_ids: linkedPpms,
        allocated_obligations: updatedAllocations,
        link_readiness: evaluatePoolLinkReadiness({ ...pool, allocated_obligations: updatedAllocations })
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit Chain Integrity & Tamper-Detection Endpoint
  app.get("/api/audit/verify", authenticate, authorizeTenant, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const snap = await firestoreAdmin.collection('audit_logs')
        .where('tenant_id', '==', tenantId)
        .get();
      const records = snap.docs.map(d => d.data() as AuditRecordNode);
      const verification = verifyAuditChain(records);
      res.json({ tenant_id: tenantId, ...verification });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gemini AI generation endpoint
  app.post("/api/gemini/generate", authenticate, authorizeTenant, async (req, res) => {
    try {
      const { prompt, systemInstruction } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const ai = getGeminiClient();
      const startTime = Date.now();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text || "No response generated.";

      const newLog: IntegrationLog = {
        id: `log-${Date.now()}`,
        integrationName: "Gemini AI Core",
        type: "LLM",
        status: "SUCCESS",
        latencyMs,
        timestamp: new Date().toISOString(),
        payload: { prompt, systemInstruction },
        response: { text }
      };
      integrationLogs.unshift(newLog);
      if (integrationLogs.length > 50) integrationLogs.pop();

      res.json({ text, latencyMs, log: newLog });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // Test custom integration
  app.post("/api/integrations/test", authenticate, authorizeTenant, async (req, res) => {
    try {
      const { integrationName, type, endpointUrl, payload } = req.body;
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 200));

      const responseData = {
        status: "OK",
        httpCode: 200,
        endpoint: endpointUrl || "https://api.external-service.io/v1/sync",
        responseBody: { success: true, processedRecords: 1, transactionId: `txn_${Math.random().toString(36).substring(7)}` }
      };
      const latencyMs = Date.now() - startTime;

      const log: IntegrationLog = {
        id: `log-${Date.now()}`,
        integrationName: integrationName || "Custom Integration",
        type: type || "REST API",
        status: "SUCCESS",
        latencyMs,
        timestamp: new Date().toISOString(),
        payload: payload || {},
        response: responseData
      };

      integrationLogs.unshift(log);
      res.json({ success: true, latencyMs, response: responseData, log });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/integrations/logs", authenticate, authorizeTenant, (req, res) => {
    res.json({ logs: integrationLogs });
  });

  // --- Financial Ledger API (Tenant-Scoped) ---
  app.get("/api/ledger/state", authenticate, authorizeTenant, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || 'tenant-omega';
      const [journalSnap, auditSnap, intentSnap] = await Promise.all([
        firestoreAdmin.collection('journal_entries').where('tenant_id', '==', tenantId).get(),
        firestoreAdmin.collection('audit_logs').where('tenant_id', '==', tenantId).get(),
        firestoreAdmin.collection('settlement_intents').where('tenant_id', '==', tenantId).get()
      ]);

      const sortDesc = (arr: any[], key: string) =>
        arr.sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || ''))).slice(0, 25);

      res.json({
        journal_entries: sortDesc(journalSnap.docs.map(d => ({ id: d.id, ...d.data() })), 'created_at'),
        audit_logs: auditSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => Number(b.sequence_number || 0) - Number(a.sequence_number || 0))
          .slice(0, 25),
        settlement_intents: sortDesc(intentSnap.docs.map(d => ({ id: d.id, ...d.data() })), 'created_at')
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ledger/settle", authenticate, authorizeTenant, authorizeRole('MAKER', 'ADMIN'), async (req, res) => {
    try {
      const { amount, currency, provider } = req.body;
      const intent: SettlementIntent = {
        id: `intent-${Math.random().toString(36).substring(7)}`,
        tenant_id: req.user?.tenantId || 'tenant-omega',
        wallet_id: 'wallet-demo',
        amount: amount || "0",
        currency: currency || "USDC",
        provider: provider || "PAYU",
        state: 'AUTHORIZED',
        created_at: new Date(),
        updated_at: new Date()
      };

      await firestoreAdmin.collection('settlement_intents').doc(intent.id).set({
        ...intent,
        created_at: intent.created_at.toISOString(),
        updated_at: intent.updated_at.toISOString()
      });

      await orchestrator.executeSettlement(intent);

      res.json({ success: true, intentId: intent.id, state: intent.state });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          res.status(404).send("App is building or static files not found. Please run build.");
        }
      });
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sovereign Remic OS v17 running on http://localhost:${PORT}`);
  });
}

startServer();
