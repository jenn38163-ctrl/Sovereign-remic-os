import { describe, it, expect } from 'vitest';
import {
  addCalendarDays,
  addCalendarYears,
  assertOperativeExemptionPathway,
  computePpmDocumentHash,
  evaluateOfferingComplianceGates,
  NEVADA_NAC_90_5145_FEE_USD,
  validateInvestorOnboarding
} from '../src/ppm/compliance';
import { InvestorComplianceRecord, PPMOffering } from '../src/ppm/types';

function makeBaseOffering(overrides: Partial<PPMOffering> = {}): PPMOffering {
  const base: PPMOffering = {
    id: 'PPM-TEST-001',
    tenant_id: 'tenant-omega',
    title: 'Sovereign REMIC Test Offering',
    exemption_pathway: 'RULE_506_C',
    counsel_selected_pathway: true,
    offering_amount: '10000000.00',
    affiliate_offering_amount: '0.00',
    minimum_investment: '100000.00',
    maturity_months: 36,
    target_interest_rate: '9.5%',
    is_tokenized_security: false,
    tokenized_asset_classification_verified: false,
    risk_factors: ['Liquidity risk', 'Market rate risk'],
    use_of_proceeds: 'Collateral pool acquisition.',
    offering_expenses: 'Legal and regulatory filing costs.',
    fees_and_compensation: 'Sponsor administration fee 1.0%.',
    conflicts_of_interest: 'Disclosed servicing affiliation.',
    related_party_transactions: 'None beyond servicing.',
    investor_eligibility: 'Accredited Investors only.',
    transfer_restrictions: 'Rule 144 restricted securities.',
    general_solicitation_used: true,
    us_directed_selling_efforts: false,
    form_1a_qualified: false,
    audited_financials_attached: false,
    auditor_firm: '',
    national_exchange_listed: false,
    reg_a_state_registrations: [],
    ongoing_sec_reporting: { form_1u_monitoring_enabled: false },
    offering_start_date: '2026-06-01',
    concurrent_offerings_checked: true,
    rule_152_counsel_clearance: false,
    bad_actor_screened: true,
    bad_actor_disqualifying_event: false,
    bad_actor_written_disclosure_delivered: false,
    covered_persons: [
      {
        name: 'Issuer Manager LLC',
        role: 'Manager',
        inquiry_date: '2026-05-25',
        disqualifying_event_found: false,
        evidence_ref: 'INQUIRY-001'
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
    counsel_reviewer: 'Qualified Securities Counsel LLP',
    counsel_review_date: '2026-05-30T00:00:00.000Z',
    counsel_review_record: {
      reviewer_name: 'Elena Vance, Esq.',
      firm_or_bar_ref: 'Qualified Securities Counsel LLP (Bar #NV-88421)',
      scope: 'Exemption pathway, disclosures & compliance gates',
      decision: 'APPROVED',
      timestamp: '2026-05-30T00:00:00.000Z',
      evidence_ref: 'COUNSEL-MEMO-TEST-01'
    },
    created_at: '2026-05-20T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
    ...overrides
  };

  if (!overrides.document_sha256) {
    base.document_sha256 = computePpmDocumentHash(base);
  }
  return base;
}

describe('Sovereign REMIC OS v19 — PPM Regulatory Compliance Gate Suite', () => {
  it('blocks non-operative Proposed Regulation Crypto Assets pathway', () => {
    expect(() => assertOperativeExemptionPathway('PROPOSED_REG_CRYPTO_ASSETS')).toThrow(/non-operative/i);
    expect(() => assertOperativeExemptionPathway('CRYPTO_ASSET_EXEMPTION')).toThrow(/non-operative/i);
    expect(assertOperativeExemptionPathway('RULE_506_C')).toBe('RULE_506_C');
  });

  it('enforces SEC Release 33-11412 tokenized security classification gate', () => {
    const unverifiedTokenized = makeBaseOffering({
      is_tokenized_security: true,
      tokenized_asset_classification_verified: false
    });
    const evalUnverified = evaluateOfferingComplianceGates(unverifiedTokenized);
    expect(evalUnverified.distribution_ready).toBe(false);
    expect(evalUnverified.blockers.some(b => b.includes('33-11412'))).toBe(true);

    const verifiedTokenized = makeBaseOffering({
      is_tokenized_security: true,
      tokenized_asset_classification_verified: true
    });
    const evalVerified = evaluateOfferingComplianceGates(verifiedTokenized);
    expect(evalVerified.distribution_ready).toBe(true);
  });

  it('rejects bare self-attestation checkbox in Rule 506(c) and accepts third-party verification', () => {
    const offering506c = makeBaseOffering({ exemption_pathway: 'RULE_506_C' });

    const selfAttestInvestor: InvestorComplianceRecord = {
      id: 'INV-1',
      investor_label: 'Self Attest LP',
      accredited: true,
      verification_method: 'SELF_ATTESTATION_CHECKBOX',
      ppm_version_delivered: offering506c.version,
      ppm_hash_delivered: offering506c.document_sha256,
      q_and_a_acknowledged: true,
      solicited_by: 'Issuer Direct',
      state_of_residence: 'DE',
      is_us_person: true,
      subscription_date: '2026-06-15',
      investment_amount: '250000.00'
    };
    expect(() => validateInvestorOnboarding(offering506c, selfAttestInvestor)).toThrow(/self-attestation checkbox is rejected/i);

    const verifiedInvestor: InvestorComplianceRecord = {
      ...selfAttestInvestor,
      id: 'INV-2',
      verification_method: 'THIRD_PARTY_CPA_ATTORNEY',
      verification_evidence_ref: 'CPA-LETTER-2026-99'
    };
    expect(() => validateInvestorOnboarding(offering506c, verifiedInvestor)).not.toThrow();
  });

  it('enforces Rule 506(b) no general solicitation, Rule 502(b) disclosures, and 35 non-accredited offering limit under Rule 501(e)', () => {
    const invalid506b = makeBaseOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: true
    });
    expect(evaluateOfferingComplianceGates(invalid506b).distribution_ready).toBe(false);

    const existing35: InvestorComplianceRecord[] = Array.from({ length: 35 }, (_, idx) => ({
      id: `INV-NA-${idx}`,
      investor_label: `Non-Accredited ${idx}`,
      accredited: false,
      verification_method: 'INCOME_TAX_W2_REVIEW',
      sophisticated_verified: true,
      rule_502b_disclosures_delivered: true,
      ppm_version_delivered: 1,
      ppm_hash_delivered: invalid506b.document_sha256,
      q_and_a_acknowledged: true,
      solicited_by: 'Issuer Direct',
      state_of_residence: 'NV',
      is_us_person: true,
      subscription_date: '2026-06-10',
      investment_amount: '100000.00'
    }));

    const valid506b = makeBaseOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: false,
      investor_records: existing35
    });
    // Ensure hash matches on investor records check
    existing35.forEach(r => { r.ppm_hash_delivered = valid506b.document_sha256; });

    const subscriber36: InvestorComplianceRecord = {
      ...existing35[0],
      id: 'INV-NA-36',
      subscription_date: '2026-07-01'
    };
    expect(() => validateInvestorOnboarding(valid506b, subscriber36)).toThrow(/35 non-accredited/i);

    const missing502b: InvestorComplianceRecord = {
      ...existing35[0],
      id: 'INV-NA-MISSING-502B',
      rule_502b_disclosures_delivered: false
    };
    const empty506b = makeBaseOffering({
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: false
    });
    missing502b.ppm_hash_delivered = empty506b.document_sha256;
    expect(() => validateInvestorOnboarding(empty506b, missing502b)).toThrow(/502\(b\)/i);
  });

  it('enforces Rule 506(d) disqualifying event gate and pre-cutoff disclosure rule', () => {
    const postCutoffBadActor = makeBaseOffering({
      bad_actor_screened: true,
      bad_actor_disqualifying_event: true,
      covered_persons: [
        {
          name: 'Covered Officer',
          role: 'Director',
          inquiry_date: '2026-06-01',
          disqualifying_event_found: true,
          event_date: '2020-01-15',
          evidence_ref: 'DISQ-2020'
        }
      ]
    });
    const evalPost = evaluateOfferingComplianceGates(postCutoffBadActor);
    expect(evalPost.distribution_ready).toBe(false);
    expect(evalPost.blockers.some(b => b.includes('Rule 506(d) disqualification'))).toBe(true);

    const preCutoffWithoutDisclosure = makeBaseOffering({
      bad_actor_screened: true,
      bad_actor_disqualifying_event: true,
      bad_actor_written_disclosure_delivered: false,
      covered_persons: [
        {
          name: 'Legacy Officer',
          role: 'Director',
          inquiry_date: '2026-06-01',
          disqualifying_event_found: true,
          event_date: '2011-05-10',
          evidence_ref: 'DISQ-2011'
        }
      ]
    });
    expect(evaluateOfferingComplianceGates(preCutoffWithoutDisclosure).distribution_ready).toBe(false);
  });

  it('detects Rule 152 integration conflicts and requires SR-FINRA-2026-002 operative date confirmation', () => {
    const off506b = makeBaseOffering({
      id: 'PPM-506B',
      exemption_pathway: 'RULE_506_B',
      general_solicitation_used: false,
      offering_start_date: '2026-06-01',
      offering_end_date: '2026-08-01'
    });
    const off506c = makeBaseOffering({
      id: 'PPM-506C',
      exemption_pathway: 'RULE_506_C',
      general_solicitation_used: true,
      offering_start_date: '2026-08-15',
      offering_end_date: '2026-10-01'
    });
    const evalIntegration = evaluateOfferingComplianceGates(off506b, [off506c]);
    expect(evalIntegration.distribution_ready).toBe(false);
    expect(evalIntegration.blockers.some(b => b.includes('Rule 152'))).toBe(true);

    const offFinraUnconfirmed = makeBaseOffering({
      placement_agent: {
        has_placement_agent: true,
        finra_member: true,
        firm_name: 'Partner BD LLC',
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
    const evalFinra = evaluateOfferingComplianceGates(offFinraUnconfirmed);
    expect(evalFinra.distribution_ready).toBe(false);
    expect(evalFinra.blockers.some(b => b.includes('SR-FINRA-2026-002'))).toBe(true);
  });

  it('computes 15-day Form D, Nevada NAC 90.5145 ($500 fee, 1-yr effective), and detects hash tampering & self-approval', () => {
    expect(addCalendarDays('2026-07-01', 15)).toBe('2026-07-16');
    expect(addCalendarYears('2026-07-01', 1)).toBe('2027-07-01');

    const withDeadlines = makeBaseOffering({
      first_irrevocable_commitment_date: '2026-07-01',
      first_nevada_sale_date: '2026-07-05',
      placement_agent: {
        has_placement_agent: true,
        finra_member: true,
        sales_compensation_disclosed: true
      }
    });
    const evalDeadlines = evaluateOfferingComplianceGates(withDeadlines);
    expect(evalDeadlines.deadlines.federal_form_d_due).toBe('2026-07-16');
    expect(evalDeadlines.deadlines.nevada_nac_90_5145_due).toBe('2026-07-20');
    expect(evalDeadlines.deadlines.nevada_nac_90_5145_effective_until).toBe('2027-07-05');
    expect(evalDeadlines.deadlines.finra_5123_due).toBe('2026-07-16');
    expect(evalDeadlines.compliance_disclaimer).toContain('do NOT establish legal compliance');

    // Tampered hash and self-approval check
    const tampered = makeBaseOffering({
      offering_amount: '99999999.00',
      document_sha256: 'deadbeef',
      approved_by: 'usr-maker-1'
    });
    const evalTampered = evaluateOfferingComplianceGates(tampered);
    expect(evalTampered.distribution_ready).toBe(false);
    expect(evalTampered.blockers.some(b => b.includes('four-eyes'))).toBe(true);
    expect(evalTampered.blockers.some(b => b.includes('SHA-256'))).toBe(true);
  });
});
