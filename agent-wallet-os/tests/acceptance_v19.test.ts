import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  ACTIVE_SIGNING_KEY_ID,
  assertDistinctMakerChecker,
  authenticate,
  authorizeRole,
  authorizeTenant,
  signPayload,
  verifySignature
} from '../../server/auth';
import {
  AuditRecordNode,
  computeAuditCheckpoint,
  computeAuditRecordHash,
  verifyAuditChain
} from '../src/ledger/audit';
import { AssetPool } from '../src/pool/types';
import { assertPoolCanAllocate, evaluatePoolLinkReadiness } from '../src/pool/validation';
import {
  addCalendarDays,
  addCalendarYears,
  computePpmDocumentHash,
  countRule506bNonAccreditedPurchasers,
  evaluateOfferingComplianceGates,
  NEVADA_NAC_90_5145_FEE_USD,
  REG_A_TIER_1_CAP_USD,
  REG_A_TIER_2_CAP_USD,
  validateInvestorOnboarding
} from '../src/ppm/compliance';
import { InvestorComplianceRecord, PPMOffering } from '../src/ppm/types';

function makeOffering(overrides: Partial<PPMOffering> = {}): PPMOffering {
  const base: PPMOffering = {
    id: 'PPM-ACC-001',
    tenant_id: 'tenant-omega',
    title: 'Sovereign Institutional REMIC Notes',
    exemption_pathway: 'RULE_506_C',
    counsel_selected_pathway: true,
    offering_amount: '10000000.00',
    affiliate_offering_amount: '0.00',
    minimum_investment: '100000.00',
    maturity_months: 36,
    target_interest_rate: '9.25%',
    is_tokenized_security: false,
    tokenized_asset_classification_verified: false,
    risk_factors: ['Illiquidity risk', 'Credit & collateral concentration risk'],
    use_of_proceeds: 'Acquisition of institutional mortgage collateral pools.',
    offering_expenses: 'Disclosed legal, audit, and statutory notice filing costs.',
    fees_and_compensation: 'Management fee 1.0%; no undisclosed commissions.',
    conflicts_of_interest: 'Disclosed fiduciary servicing relationship.',
    related_party_transactions: 'Servicing agreement on arms-length terms.',
    investor_eligibility: 'Accredited investors or qualified non-accredited limits per pathway.',
    transfer_restrictions: 'Rule 144 restricted securities.',
    general_solicitation_used: true,
    us_directed_selling_efforts: false,
    form_1a_qualified: false,
    audited_financials_attached: false,
    auditor_firm: '',
    national_exchange_listed: false,
    reg_a_state_registrations: [],
    ongoing_sec_reporting: { form_1u_monitoring_enabled: false },
    offering_start_date: '2026-01-10',
    concurrent_offerings_checked: true,
    rule_152_counsel_clearance: false,
    bad_actor_screened: true,
    bad_actor_disqualifying_event: false,
    bad_actor_written_disclosure_delivered: false,
    covered_persons: [
      {
        name: 'Sovereign REMIC Manager LLC',
        role: 'Managing Member',
        inquiry_date: '2026-01-05',
        disqualifying_event_found: false,
        evidence_ref: '506D-INQUIRY-01'
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
    form_d_tracking: { filed: false },
    nevada_nac_90_5145: {
      applicable: false,
      fee_usd: NEVADA_NAC_90_5145_FEE_USD,
      amendment_fee_usd: 0,
      status: 'NOT_APPLICABLE'
    },
    state_notice_filings: [],
    version: 1,
    document_sha256: '',
    version_history: [],
    investor_records: [],
    status: 'COUNSEL_REVIEWED',
    created_by: 'usr-maker-1',
    created_by_individual_id: 'person-alice-001',
    approved_by: 'usr-checker-1',
    approved_by_individual_id: 'person-bob-002',
    counsel_reviewed: true,
    counsel_reviewer: 'Elena Vance, Esq.',
    counsel_review_date: '2026-01-09T00:00:00.000Z',
    counsel_review_record: {
      reviewer_name: 'Elena Vance, Esq.',
      firm_or_bar_ref: 'Sovereign Compliance & Legal Counsel LLP (Bar #NV-88421)',
      scope: 'Exemption pathway, PPM disclosures & offering caps',
      decision: 'APPROVED',
      timestamp: '2026-01-09T00:00:00.000Z',
      evidence_ref: 'COUNSEL-MEMO-2026-ACC'
    },
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-09T00:00:00.000Z',
    ...overrides
  };
  if (!overrides.document_sha256) {
    base.document_sha256 = computePpmDocumentHash(base);
  }
  return base;
}

function makePool(overrides: Partial<AssetPool> = {}): AssetPool {
  return {
    id: 'POOL-ACC-001',
    tenant_id: 'tenant-omega',
    pool_name: 'Acceptance Collateral Pool I',
    pool_type: 'MORTGAGE_REMIC',
    custodian: 'Malachite Fiduciary Trust',
    jurisdiction: 'Delaware',
    debtor_legal_name: 'Sovereign REMIC Trust I LLC',
    total_principal_value: '25000000.00',
    weighted_avg_coupon: '9.00%',
    weighted_avg_maturity_months: 36,
    asset_count: 50,
    ucc_filing_ref: 'UCC-1 #DE-2026-9901',
    verification: {
      asset_ownership_verified: true,
      ownership_evidence_ref: 'OWN-2026-01',
      custody_independently_verified: true,
      custody_evidence_ref: 'CUST-2026-01',
      assignment_transfer_authority_verified: true,
      assignment_authority_ref: 'ASSIGN-2026-01',
      ucc_filing_evidence_received: true,
      filing_jurisdiction_debtor_name_verified: true,
      security_interest_perfection_reviewed: true,
      perfection_reviewer: 'Elena Vance, Esq.',
      perfection_review_date: '2026-01-10T00:00:00.000Z',
      pool_valuation_eligibility_approved: true,
      underlying_assets_evidence_ref: 'TAPE-AUDIT-2026-01',
      approved_for_offering_linkage: true
    },
    allocated_obligations: [],
    linked_debt_note_ids: [],
    linked_ppm_ids: [],
    status: 'ACTIVE_CUSTODED',
    created_by: 'usr-maker-1',
    created_by_individual_id: 'person-alice-001',
    approved_by: 'usr-checker-1',
    approved_by_individual_id: 'person-bob-002',
    archived: false,
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-10T00:00:00.000Z',
    ...overrides
  };
}

describe('Sovereign REMIC OS v19 — Mandatory Acceptance Verification Suite (14 Required Tests)', () => {
  it('Test 1: Regulation A Tier 1 offering > $20M, affiliate > $6M, and missing state blue-sky registration are rejected', () => {
    expect(REG_A_TIER_1_CAP_USD).toBe(20_000_000);
    const overCap = makeOffering({
      exemption_pathway: 'REG_A_TIER_1',
      offering_amount: '25000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      reg_a_state_registrations: [{ state: 'NV', status: 'REGISTERED', filing_ref: 'NV-REG-1' }]
    });
    const resOver = evaluateOfferingComplianceGates(overCap);
    expect(resOver.distribution_ready).toBe(false);
    expect(resOver.blockers.some(b => b.includes('$20,000,000'))).toBe(true);

    const overAffiliate = makeOffering({
      exemption_pathway: 'REG_A_TIER_1',
      offering_amount: '15000000.00',
      affiliate_offering_amount: '7000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      reg_a_state_registrations: [{ state: 'NV', status: 'REGISTERED' }]
    });
    expect(evaluateOfferingComplianceGates(overAffiliate).blockers.some(b => b.includes('$6,000,000'))).toBe(true);

    const missingStateReg = makeOffering({
      exemption_pathway: 'REG_A_TIER_1',
      offering_amount: '18000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      reg_a_state_registrations: []
    });
    expect(evaluateOfferingComplianceGates(missingStateReg).blockers.some(b => b.includes('state securities registration'))).toBe(true);
  });

  it('Test 2: Regulation A Tier 2 offering > $75M, affiliate > $22.5M, missing audited financials, and >10% non-accredited cap are rejected', () => {
    expect(REG_A_TIER_2_CAP_USD).toBe(75_000_000);
    const overCap = makeOffering({
      exemption_pathway: 'REG_A_TIER_2',
      offering_amount: '80000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      audited_financials_attached: true,
      auditor_firm: 'RSM US LLP',
      ongoing_sec_reporting: { form_1u_monitoring_enabled: true }
    });
    expect(evaluateOfferingComplianceGates(overCap).blockers.some(b => b.includes('$75,000,000'))).toBe(true);

    const noAudit = makeOffering({
      exemption_pathway: 'REG_A_TIER_2',
      offering_amount: '50000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      audited_financials_attached: false,
      ongoing_sec_reporting: { form_1u_monitoring_enabled: false }
    });
    const evalNoAudit = evaluateOfferingComplianceGates(noAudit);
    expect(evalNoAudit.blockers.some(b => b.includes('audited financial statements'))).toBe(true);
    expect(evalNoAudit.blockers.some(b => b.includes('Form 1-K, 1-SA, 1-U'))).toBe(true);

    const validTier2 = makeOffering({
      exemption_pathway: 'REG_A_TIER_2',
      offering_amount: '50000000.00',
      general_solicitation_used: false,
      form_1a_qualified: true,
      audited_financials_attached: true,
      auditor_firm: 'RSM US LLP',
      ongoing_sec_reporting: { form_1u_monitoring_enabled: true }
    });
    const over10PctInvestor: InvestorComplianceRecord = {
      id: 'INV-T2-OVER',
      investor_label: 'Retail Investor',
      accredited: false,
      verification_method: 'INCOME_TAX_W2_REVIEW',
      annual_income_or_revenue_usd: '100000',
      net_worth_or_assets_usd: '150000',
      reg_a_tier2_10pct_cap_verified: true,
      ppm_version_delivered: validTier2.version,
      ppm_hash_delivered: validTier2.document_sha256,
      q_and_a_acknowledged: true,
      solicited_by: 'Direct',
      state_of_residence: 'NV',
      is_us_person: true,
      subscription_date: '2026-06-01',
      investment_amount: '25000.00' // > 10% of $150,000 ($15,000)
    };
    expect(() => validateInvestorOnboarding(validTier2, over10PctInvestor)).toThrow(/10% statutory limit/i);
  });

  it('Test 3: Rule 506(b) general solicitation is blocked', () => {
    const solicited506b = makeOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: true
    });
    const evalRes = evaluateOfferingComplianceGates(solicited506b);
    expect(evalRes.distribution_ready).toBe(false);
    expect(evalRes.blockers.some(b => b.includes('General solicitation'))).toBe(true);
  });

  it('Test 4: Rule 506(b) enforces <=35 non-accredited purchasers across the entire offering per Rule 501(e) (not a 90-day rolling window)', () => {
    const base506b = makeOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: false
    });
    // Spread 35 non-accredited purchasers across 180+ days (older than 90 days) to verify offering-wide count
    const spreadPurchasers: InvestorComplianceRecord[] = Array.from({ length: 35 }, (_, i) => ({
      id: `INV-506B-${i}`,
      investor_label: `Purchaser ${i}`,
      accredited: false,
      verification_method: 'INCOME_TAX_W2_REVIEW',
      sophisticated_verified: true,
      rule_502b_disclosures_delivered: true,
      ppm_version_delivered: base506b.version,
      ppm_hash_delivered: base506b.document_sha256,
      q_and_a_acknowledged: true,
      solicited_by: 'Issuer Direct',
      state_of_residence: 'NV',
      is_us_person: true,
      subscription_date: i < 20 ? '2026-01-15' : '2026-08-20',
      investment_amount: '100000.00'
    }));

    expect(countRule506bNonAccreditedPurchasers(spreadPurchasers)).toBe(35);
    const full506b = { ...base506b, investor_records: spreadPurchasers };

    const purchaser36: InvestorComplianceRecord = {
      ...spreadPurchasers[0],
      id: 'INV-506B-36',
      subscription_date: '2026-09-15'
    };
    expect(() => validateInvestorOnboarding(full506b, purchaser36)).toThrow(/35 non-accredited purchasers/i);

    // Documented Rule 501(e) spouse/relative exclusion (weight = 0) IS permitted
    const excluded501e: InvestorComplianceRecord = {
      ...purchaser36,
      id: 'INV-506B-SPOUSE',
      rule_501e_counting_weight: 0,
      rule_501e_exclusion_reason: 'Rule 501(e)(1)(i) spouse sharing principal residence'
    };
    expect(() => validateInvestorOnboarding(full506b, excluded501e)).not.toThrow();
  });

  it('Test 5: Rule 506(c) rejects unsupported self-attestation checkbox', () => {
    const off506c = makeOffering({ exemption_pathway: 'RULE_506_C' });
    const selfAttest: InvestorComplianceRecord = {
      id: 'INV-SELF',
      investor_label: 'Checkbox Investor',
      accredited: true,
      verification_method: 'SELF_ATTESTATION_CHECKBOX',
      ppm_version_delivered: off506c.version,
      ppm_hash_delivered: off506c.document_sha256,
      q_and_a_acknowledged: true,
      solicited_by: 'Direct',
      state_of_residence: 'DE',
      is_us_person: true,
      subscription_date: '2026-06-01',
      investment_amount: '250000.00'
    };
    expect(() => validateInvestorOnboarding(off506c, selfAttest)).toThrow(/self-attestation checkbox is rejected/i);
  });

  it('Test 6: Rule 506(d) blocks post-Sept 23 2013 events without SEC waiver and enforces pre-Sept 23 2013 written disclosure', () => {
    const postCutoff = makeOffering({
      bad_actor_screened: true,
      bad_actor_disqualifying_event: true,
      covered_persons: [
        {
          name: 'Director X',
          role: 'Director',
          inquiry_date: '2026-06-01',
          disqualifying_event_found: true,
          event_date: '2018-04-01',
          evidence_ref: 'SEC-ORDER-2018'
        }
      ]
    });
    expect(evaluateOfferingComplianceGates(postCutoff).distribution_ready).toBe(false);

    const postCutoffWithWaiver = makeOffering({
      bad_actor_screened: true,
      bad_actor_disqualifying_event: true,
      covered_persons: [
        {
          name: 'Director X',
          role: 'Director',
          inquiry_date: '2026-06-01',
          disqualifying_event_found: true,
          event_date: '2018-04-01',
          sec_waiver_ref: 'SEC-WAIVER-2020-99',
          evidence_ref: 'SEC-ORDER-2018'
        }
      ]
    });
    expect(evaluateOfferingComplianceGates(postCutoffWithWaiver).distribution_ready).toBe(true);

    const preCutoffNoDisclosure = makeOffering({
      bad_actor_screened: true,
      bad_actor_disqualifying_event: true,
      bad_actor_written_disclosure_delivered: false,
      covered_persons: [
        {
          name: 'Legacy Director',
          role: 'Director',
          inquiry_date: '2026-06-01',
          disqualifying_event_found: true,
          event_date: '2012-03-15',
          evidence_ref: 'LEGACY-2012'
        }
      ]
    });
    expect(evaluateOfferingComplianceGates(preCutoffNoDisclosure).blockers.some(b => b.includes('written disclosure'))).toBe(true);
  });

  it('Test 7: FINRA Rule 5123 exemption cannot bypass issuer Rule 506/Reg A eligibility and SR-FINRA-2026-002 requires confirmation', () => {
    const finraConfirmedButBlockedIssuer = makeOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: true, // Issuer fails Rule 506(b)
      placement_agent: {
        has_placement_agent: true,
        finra_member: true,
        firm_name: 'Partner BD',
        sales_compensation_disclosed: true
      },
      finra_5123_filing: {
        required: false,
        exemption_claimed: 'RULE_501_A_9_ENTITY_5M',
        sr_finra_2026_002_operative_confirmed: true,
        filing_status: 'EXEMPT',
        retail_communications_logged: []
      }
    });
    const evalIssuerBlocked = evaluateOfferingComplianceGates(finraConfirmedButBlockedIssuer);
    expect(evalIssuerBlocked.distribution_ready).toBe(false);
    expect(evalIssuerBlocked.blockers.some(b => b.includes('General solicitation'))).toBe(true);

    const finraUnconfirmed = makeOffering({
      placement_agent: {
        has_placement_agent: true,
        finra_member: true,
        firm_name: 'Partner BD',
        sales_compensation_disclosed: true
      },
      finra_5123_filing: {
        required: true,
        exemption_claimed: 'RULE_501_A_12_FAMILY_OFFICE_5M',
        sr_finra_2026_002_operative_confirmed: false,
        filing_status: 'PENDING',
        retail_communications_logged: []
      }
    });
    expect(evaluateOfferingComplianceGates(finraUnconfirmed).blockers.some(b => b.includes('SR-FINRA-2026-002'))).toBe(true);
  });

  it('Test 8: Nevada NAC 90.5145 ($500 fee, 15-day clock, 1-yr term) calculated from immutable first-sale event', () => {
    const withImmutableAnchor = makeOffering({
      first_irrevocable_commitment_event: {
        recorded_at: '2026-05-01T12:00:00.000Z',
        event_date: '2026-05-01',
        investor_id: 'INV-1',
        immutable: true
      },
      first_nevada_sale_event: {
        recorded_at: '2026-05-03T12:00:00.000Z',
        event_date: '2026-05-03',
        investor_id: 'INV-NV-1',
        immutable: true
      },
      nevada_nac_90_5145: {
        applicable: true,
        fee_usd: NEVADA_NAC_90_5145_FEE_USD,
        amendment_fee_usd: 0,
        status: 'PENDING'
      }
    });
    const res = evaluateOfferingComplianceGates(withImmutableAnchor);
    expect(res.deadlines.federal_form_d_due).toBe(addCalendarDays('2026-05-01', 15));
    expect(res.deadlines.nevada_nac_90_5145_due).toBe('2026-05-18');
    expect(res.deadlines.nevada_nac_90_5145_effective_until).toBe(addCalendarYears('2026-05-03', 1));
    expect(res.warnings.some(w => w.includes('$500'))).toBe(true);
  });

  it('Test 9: Unapproved or unperfected collateral pools (including UCC-1 ref alone) cannot be linked', () => {
    const uccRefOnlyPool = makePool({
      status: 'ACTIVE_CUSTODED',
      ucc_filing_ref: 'UCC-1 #DE-2026-UNVERIFIED',
      verification: {
        asset_ownership_verified: false,
        custody_independently_verified: false,
        assignment_transfer_authority_verified: false,
        ucc_filing_evidence_received: true,
        filing_jurisdiction_debtor_name_verified: false,
        security_interest_perfection_reviewed: false,
        pool_valuation_eligibility_approved: false,
        underlying_assets_evidence_ref: 'TAPE-01',
        approved_for_offering_linkage: false
      }
    });

    const readiness = evaluatePoolLinkReadiness(uccRefOnlyPool);
    expect(readiness.ready_for_linkage).toBe(false);
    expect(readiness.missing_stages.length).toBeGreaterThanOrEqual(6);
    expect(() => assertPoolCanAllocate(uccRefOnlyPool, 'PPM_OFFERING', 'PPM-1', 1000000)).toThrow(/NOT cleared/i);

    const unapprovedPool = makePool({ status: 'PENDING_CHECKER_APPROVAL' });
    expect(() => assertPoolCanAllocate(unapprovedPool, 'DEBT_NOTE', 'DN-1', 1000000)).toThrow(/ACTIVE_CUSTODED/i);
  });

  it('Test 10: Duplicate collateral allocation and over-pledging beyond pool principal are rejected', () => {
    const pool = makePool({
      total_principal_value: '10000000.00',
      allocated_obligations: [
        {
          id: 'ALLOC-1',
          target_type: 'PPM_OFFERING',
          target_id: 'PPM-2026-SR1',
          allocated_amount: '7000000.00',
          linked_at: '2026-01-10T00:00:00.000Z',
          linked_by: 'usr-checker-1'
        }
      ]
    });

    // Duplicate allocation to same target rejected
    expect(() => assertPoolCanAllocate(pool, 'PPM_OFFERING', 'PPM-2026-SR1', 1000000)).toThrow(/Duplicate collateral allocation/i);

    // Over-pledge beyond remaining $3,000,000 rejected
    expect(() => assertPoolCanAllocate(pool, 'DEBT_NOTE', 'DN-NEW-1', 4000000)).toThrow(/Over-pledge blocked/i);

    // Valid remaining capacity $3,000,000 allowed
    const ok = assertPoolCanAllocate(pool, 'DEBT_NOTE', 'DN-NEW-1', 3000000);
    expect(ok.available_principal).toBe(3000000);
  });

  it('Test 11: Cross-tenant access attempts fail closed and same-individual maker-checker alias is blocked', () => {
    // Cross-tenant block (even if role were ADMIN)
    let tenantStatus = 0;
    const reqCrossTenant = {
      user: { id: 'usr-admin-1', individualId: 'person-carol-003', tenantId: 'tenant-omega', role: 'ADMIN' },
      headers: { 'x-tenant-id': 'tenant-beta' },
      body: {},
      query: {}
    } as any;
    const resCrossTenant = {
      status: (c: number) => {
        tenantStatus = c;
        return { json: (o: any) => o };
      }
    } as any;
    let passed = false;
    authorizeTenant(reqCrossTenant, resCrossTenant, () => { passed = true; });
    expect(passed).toBe(false);
    expect(tenantStatus).toBe(403);

    // Distinct-individual Maker-Checker blocks secondary account belonging to same individual
    const sameIndividualChecker: any = {
      id: 'usr-maker-1-alt',
      individualId: 'person-alice-001',
      tenantId: 'tenant-omega',
      role: 'CHECKER',
      name: 'Alice Alt',
      scopes: ['ppm:approve']
    };
    expect(() => assertDistinctMakerChecker('usr-maker-1', 'person-alice-001', sameIndividualChecker)).toThrow(/same verified individual identity/i);

    // Distinct individual succeeds
    const bobChecker: any = {
      id: 'usr-checker-1',
      individualId: 'person-bob-002',
      tenantId: 'tenant-omega',
      role: 'CHECKER',
      name: 'Bob Checker',
      scopes: ['ppm:approve']
    };
    expect(() => assertDistinctMakerChecker('usr-maker-1', 'person-alice-001', bobChecker)).not.toThrow();
  });

  it('Test 12: Modified PPM version or altered disclosure invalidates prior hash/approval', () => {
    const approved = makeOffering({
      version: 1,
      offering_amount: '10000000.00'
    });
    const modifiedTermsSameHash = {
      ...approved,
      offering_amount: '12000000.00' // Altered without recomputing hash & re-approving
    };
    const evalModified = evaluateOfferingComplianceGates(modifiedTermsSameHash);
    expect(evalModified.distribution_ready).toBe(false);
    expect(evalModified.blockers.some(b => b.includes('SHA-256'))).toBe(true);

    // Re-versioned amendment resets prior approval & counsel clearance
    const reVersioned = makeOffering({
      version: 2,
      offering_amount: '12000000.00',
      approved_by: null,
      approved_by_individual_id: null,
      counsel_reviewed: false,
      counsel_review_record: null,
      signature: null
    });
    const evalAmended = evaluateOfferingComplianceGates(reVersioned);
    expect(evalAmended.distribution_ready).toBe(false);
    expect(evalAmended.blockers.some(b => b.includes('four-eyes'))).toBe(true);
    expect(evalAmended.blockers.some(b => b.includes('counsel review'))).toBe(true);
  });

  it('Test 13: Registered public-key RSA verification rejects key substitution and unauthorized requests fail closed', () => {
    const payload = { id: 'PPM-2026-SR1', amount: '50000000.00' };
    const validSig = signPayload(payload);
    expect(verifySignature(payload, validSig, ACTIVE_SIGNING_KEY_ID)).toBe(true);

    // Attacker tries substituting their own RSA keypair
    const rogueKeys = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const signer = crypto.createSign('SHA256');
    signer.update(JSON.stringify(payload));
    signer.end();
    const rogueSig = signer.sign(rogueKeys.privateKey, 'hex');

    // Rejected: unknown keyId
    expect(verifySignature(payload, rogueSig, 'rogue-key-id')).toBe(false);
    // Rejected: key substitution attempt with registered keyId + rogue publicKey
    expect(verifySignature(payload, rogueSig, ACTIVE_SIGNING_KEY_ID, rogueKeys.publicKey)).toBe(false);

    // Unauthenticated request returns 401; MAKER calling CHECKER-only route returns 403
    let authCode = 0;
    authenticate({ headers: {} } as any, { status: (c: number) => { authCode = c; return { json: (o: any) => o }; } } as any, () => {});
    expect(authCode).toBe(401);

    let roleCode = 0;
    authorizeRole('CHECKER')(
      { user: { id: 'usr-maker-1', role: 'MAKER' } } as any,
      { status: (c: number) => { roleCode = c; return { json: (o: any) => o }; } } as any,
      () => {}
    );
    expect(roleCode).toBe(403);
  });

  it('Test 14: Audit ledger tamper detection & checkpoint verification detects payload modification, sequence gaps, and broken chains', () => {
    const h1 = computeAuditRecordHash('tenant-omega', 1, 'genesis_hash', 'PPM_OFFERING_DRAFTED', '{"id":"PPM-1"}');
    const h2 = computeAuditRecordHash('tenant-omega', 2, h1, 'PPM_OFFERING_APPROVED', '{"id":"PPM-1"}');
    const validChain: AuditRecordNode[] = [
      {
        id: 'aud-1',
        tenant_id: 'tenant-omega',
        sequence_number: 1,
        action: 'PPM_OFFERING_DRAFTED',
        payload: '{"id":"PPM-1"}',
        previous_hash: 'genesis_hash',
        hash: h1,
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'aud-2',
        tenant_id: 'tenant-omega',
        sequence_number: 2,
        action: 'PPM_OFFERING_APPROVED',
        payload: '{"id":"PPM-1"}',
        previous_hash: h1,
        hash: h2,
        created_at: '2026-01-01T00:05:00.000Z'
      }
    ];

    const checkpoint = computeAuditCheckpoint(validChain);
    const verified = verifyAuditChain(validChain, checkpoint);
    expect(verified.valid).toBe(true);
    expect(verified.tampered_sequences).toHaveLength(0);

    // Tamper payload in seq 1 -> SHA-256 mismatch + checkpoint mismatch
    const tamperedPayloadChain = [
      { ...validChain[0], payload: '{"id":"PPM-TAMPERED"}' },
      validChain[1]
    ];
    const tamperedRes = verifyAuditChain(tamperedPayloadChain, checkpoint);
    expect(tamperedRes.valid).toBe(false);
    expect(tamperedRes.tampered_sequences).toContain(1);
    expect(tamperedRes.errors.some(e => e.includes('SHA-256 digest mismatch'))).toBe(true);

    // Sequence gap & broken previous_hash detection
    const gapChain = [
      validChain[0],
      { ...validChain[1], sequence_number: 3, previous_hash: 'wrong_prev_hash' }
    ];
    const gapRes = verifyAuditChain(gapChain, checkpoint);
    expect(gapRes.valid).toBe(false);
    expect(gapRes.errors.some(e => e.includes('Sequence gap'))).toBe(true);
    expect(gapRes.errors.some(e => e.includes('previous_hash mismatch'))).toBe(true);
    expect(gapRes.errors.some(e => e.includes('checkpoint mismatch'))).toBe(true);
  });
});
