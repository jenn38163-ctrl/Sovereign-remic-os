import crypto from 'crypto';
import {
  ComplianceGateEvaluation,
  ExemptionPathway,
  Finra5123Exemption,
  InvestorComplianceRecord,
  PPMOffering
} from './types';

export const OPERATIVE_PATHWAYS: readonly ExemptionPathway[] = [
  'RULE_506_B',
  'RULE_506_C',
  'REG_A_TIER_1',
  'REG_A_TIER_2',
  'REG_S'
] as const;

export const NON_OPERATIVE_PROPOSED_PATHWAYS: readonly string[] = [
  'PROPOSED_REG_CRYPTO_ASSETS',
  'REG_CRYPTO_ASSETS',
  'CRYPTO_ASSET_EXEMPTION',
  'TOKEN_SAFE_HARBOR'
];

// Regulation A Statutory Caps (17 CFR § 230.251(a))
export const REG_A_TIER_1_CAP_USD = 20_000_000;
export const REG_A_TIER_1_AFFILIATE_CAP_USD = 6_000_000;
export const REG_A_TIER_2_CAP_USD = 75_000_000;
export const REG_A_TIER_2_AFFILIATE_CAP_USD = 22_500_000;

// Rule 506(b) Offering Purchaser Limit (17 CFR § 230.506(b)(2)(i) + § 230.501(e))
export const RULE_506B_MAX_NON_ACCREDITED_IN_OFFERING = 35;

export const NEVADA_NAC_90_5145_FEE_USD = 500;
export const RULE_506D_TRIGGER_DATE = '2013-09-23';

export const COMPLIANCE_DISCLAIMER =
  'Software controls enforce internal workflow, documentation, and statutory deadline tracking only. They do NOT establish legal compliance, SEC qualification, FINRA clearance, or authorization to offer or sell securities. Qualified securities counsel review is required prior to distribution.';

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date for deadline calculation: ${isoDate}`);
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addCalendarYears(isoDate: string, years: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date for renewal calculation: ${isoDate}`);
  }
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * Validates that the requested exemption pathway is currently operative under US federal securities law.
 * Explicitly rejects non-operative proposed exemptions such as Proposed Regulation Crypto Assets.
 */
export function assertOperativeExemptionPathway(pathway: string): ExemptionPathway {
  if (!pathway || typeof pathway !== 'string') {
    throw new Error('Exemption pathway is required and must be selected with securities counsel.');
  }
  const normalized = pathway.toUpperCase().trim();
  if (NON_OPERATIVE_PROPOSED_PATHWAYS.includes(normalized)) {
    throw new Error(
      `Blocked non-operative pathway "${pathway}": Proposed Regulation Crypto Assets is a non-operative proposal and must not be activated for live offerings.`
    );
  }
  if (!(OPERATIVE_PATHWAYS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Unsupported or unapproved exemption pathway "${pathway}". Permitted operative pathways: ${OPERATIVE_PATHWAYS.join(', ')}.`
    );
  }
  return normalized as ExemptionPathway;
}

/**
 * Computes a deterministic SHA-256 hash over immutable PPM offering terms & disclosures.
 */
export function computePpmDocumentHash(offering: Pick<
  PPMOffering,
  | 'id'
  | 'tenant_id'
  | 'title'
  | 'exemption_pathway'
  | 'offering_amount'
  | 'affiliate_offering_amount'
  | 'minimum_investment'
  | 'maturity_months'
  | 'target_interest_rate'
  | 'is_tokenized_security'
  | 'risk_factors'
  | 'use_of_proceeds'
  | 'offering_expenses'
  | 'fees_and_compensation'
  | 'conflicts_of_interest'
  | 'related_party_transactions'
  | 'investor_eligibility'
  | 'transfer_restrictions'
  | 'version'
>): string {
  const canonical = JSON.stringify({
    id: offering.id,
    tenant_id: offering.tenant_id,
    title: offering.title,
    exemption_pathway: offering.exemption_pathway,
    offering_amount: offering.offering_amount,
    affiliate_offering_amount: offering.affiliate_offering_amount || '0',
    minimum_investment: offering.minimum_investment,
    maturity_months: offering.maturity_months,
    target_interest_rate: offering.target_interest_rate,
    is_tokenized_security: Boolean(offering.is_tokenized_security),
    risk_factors: offering.risk_factors,
    use_of_proceeds: offering.use_of_proceeds,
    offering_expenses: offering.offering_expenses,
    fees_and_compensation: offering.fees_and_compensation,
    conflicts_of_interest: offering.conflicts_of_interest,
    related_party_transactions: offering.related_party_transactions,
    investor_eligibility: offering.investor_eligibility,
    transfer_restrictions: offering.transfer_restrictions,
    version: offering.version
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Counts non-accredited purchasers in a Rule 506(b) offering pursuant to 17 CFR § 230.506(b)(2)(i)
 * and Rule 501(e) purchaser-counting exclusions (NOT an arbitrary rolling time window).
 */
export function countRule506bNonAccreditedPurchasers(records: InvestorComplianceRecord[]): number {
  return (records || []).reduce((count, rec) => {
    if (rec.accredited) return count; // Rule 501(e)(1)(iv): accredited investors excluded
    if (rec.rule_501e_counting_weight === 0 && rec.rule_501e_exclusion_reason?.trim()) {
      return count; // Documented Rule 501(e) relative/spouse/entity aggregation
    }
    return count + (typeof rec.rule_501e_counting_weight === 'number' ? rec.rule_501e_counting_weight : 1);
  }, 0);
}

/**
 * Validates Rule 506(b), Rule 506(c), Reg A Tier 1, Reg A Tier 2, and Reg S investor onboarding.
 */
export function validateInvestorOnboarding(
  offering: PPMOffering,
  investor: InvestorComplianceRecord
): void {
  if (!investor.q_and_a_acknowledged) {
    throw new Error('Investor onboarding blocked: Investor Q&A opportunity acknowledgment is mandatory.');
  }
  if (investor.ppm_version_delivered !== offering.version || investor.ppm_hash_delivered !== offering.document_sha256) {
    throw new Error(
      `Investor onboarding blocked: PPM version/hash mismatch. Expected v${offering.version} (${offering.document_sha256.slice(0, 12)}...).`
    );
  }
  if (!investor.solicited_by || investor.solicited_by.trim().length < 2) {
    throw new Error('Investor onboarding blocked: Solicitor / introducer identity must be recorded for FINRA 5123 & Rule 506(b) tracking.');
  }

  if (offering.exemption_pathway === 'RULE_506_C') {
    if (!investor.accredited) {
      throw new Error('Rule 506(c) gate: Non-accredited investors are strictly prohibited in Rule 506(c) offerings.');
    }
    if (investor.verification_method === 'SELF_ATTESTATION_CHECKBOX') {
      throw new Error(
        'Rule 506(c) gate: Bare self-attestation checkbox is rejected. Reasonable steps to verify accredited investor status with documentary or third-party evidence are required.'
      );
    }
    if (!investor.verification_evidence_ref || investor.verification_evidence_ref.trim().length < 4) {
      throw new Error('Rule 506(c) gate: Verification evidence reference (CPA/attorney letter, broker-dealer/RIA confirmation, or financial review ref) is required.');
    }
  }

  if (offering.exemption_pathway === 'RULE_506_B') {
    if (!investor.accredited) {
      if (!investor.sophisticated_verified) {
        throw new Error('Rule 506(b) gate: Non-accredited investor must meet sophistication verification requirements.');
      }
      if (!investor.rule_502b_disclosures_delivered) {
        throw new Error('Rule 506(b) gate: Mandatory Rule 502(b) financial & non-financial pre-sale disclosures must be delivered to non-accredited purchasers.');
      }

      const currentCount = countRule506bNonAccreditedPurchasers(offering.investor_records || []);
      const addedWeight =
        investor.rule_501e_counting_weight === 0 && investor.rule_501e_exclusion_reason?.trim()
          ? 0
          : typeof investor.rule_501e_counting_weight === 'number'
            ? investor.rule_501e_counting_weight
            : 1;

      if (currentCount + addedWeight > RULE_506B_MAX_NON_ACCREDITED_IN_OFFERING) {
        throw new Error(
          `Rule 506(b) gate (17 CFR § 230.506(b)(2)(i)): Exceeds statutory limit of ${RULE_506B_MAX_NON_ACCREDITED_IN_OFFERING} non-accredited purchasers in the offering.`
        );
      }
    }
  }

  if (offering.exemption_pathway === 'REG_A_TIER_1') {
    const stateReg = (offering.reg_a_state_registrations || []).find(
      s => s.state.toUpperCase() === investor.state_of_residence.toUpperCase()
    );
    if (!stateReg || (stateReg.status !== 'REGISTERED' && stateReg.status !== 'EXEMPT')) {
      throw new Error(
        `Regulation A Tier 1 gate: State registration or state-level exemption must be recorded for investor state "${investor.state_of_residence}" (Tier 1 is not federally preempted).`
      );
    }
  }

  if (offering.exemption_pathway === 'REG_A_TIER_2') {
    if (!investor.accredited && !offering.national_exchange_listed) {
      const investAmt = Number(investor.investment_amount || 0);
      const income = Number(investor.annual_income_or_revenue_usd || 0);
      const netWorth = Number(investor.net_worth_or_assets_usd || 0);
      const maxBase = Math.max(income, netWorth);
      if (maxBase <= 0 || !investor.reg_a_tier2_10pct_cap_verified) {
        throw new Error(
          'Regulation A Tier 2 gate (17 CFR § 230.251(d)(2)(i)(C)): Non-accredited investor income/net-worth basis and 10% investment cap verification are required.'
        );
      }
      if (investAmt > maxBase * 0.1) {
        throw new Error(
          `Regulation A Tier 2 gate: Investment ($${investAmt.toLocaleString()}) exceeds 10% statutory limit ($${(maxBase * 0.1).toLocaleString()}) for non-accredited investor.`
        );
      }
    }
  }

  if (offering.exemption_pathway === 'REG_S') {
    if (investor.is_us_person) {
      throw new Error('Regulation S gate: US Persons cannot purchase in an offshore Regulation S tranche.');
    }
  }
}

/**
 * Evaluates FINRA Rule 5123 exemption claims, including SR-FINRA-2026-002 expanded categories.
 * Note: FINRA 5123 exemption NEVER bypasses issuer federal/state securities exemption eligibility.
 */
export function validateFinra5123Tracking(offering: PPMOffering): string[] {
  const issues: string[] = [];
  const pa = offering.placement_agent;
  const f5123 = offering.finra_5123_filing;

  if (pa?.has_placement_agent && !pa.sales_compensation_disclosed) {
    issues.push('Placement agent compensation and finder fees must be explicitly disclosed.');
  }

  if (pa?.has_placement_agent && pa.finra_member) {
    const claimed: Finra5123Exemption = f5123?.exemption_claimed || 'NONE';
    if (
      (claimed === 'RULE_501_A_9_ENTITY_5M' || claimed === 'RULE_501_A_12_FAMILY_OFFICE_5M') &&
      !f5123.sr_finra_2026_002_operative_confirmed
    ) {
      issues.push(
        `FINRA Rule 5123 exemption "${claimed}" (File SR-FINRA-2026-002) requires explicit confirmation of the FINRA Regulatory Notice effective date before relying on the expanded Rule 501(a)(9)/(12) categories.`
      );
    }
    if (claimed === 'NONE' && f5123.filing_status !== 'FILED' && offering.first_irrevocable_commitment_date) {
      const deadline = addCalendarDays(offering.first_irrevocable_commitment_date, 15);
      issues.push(
        `FINRA Rule 5123 filing required by ${deadline} (15 calendar days from first sale when a FINRA member placement agent participates).`
      );
    }
  }

  return issues;
}

/**
 * Checks Rule 152 integration risks across offerings of the same tenant (separate from Rule 506(b) counting).
 */
export function checkRule152IntegrationHazards(
  offering: PPMOffering,
  peerOfferings: PPMOffering[]
): string[] {
  const issues: string[] = [];
  if (!offering.concurrent_offerings_checked) {
    issues.push('Rule 152 integration review has not been marked complete.');
  }

  const targetStart = new Date(offering.offering_start_date).getTime();
  const targetEnd = offering.offering_end_date ? new Date(offering.offering_end_date).getTime() : targetStart + 365 * 86400000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const peer of peerOfferings) {
    if (peer.id === offering.id || peer.status === 'ARCHIVED') continue;
    const peerStart = new Date(peer.offering_start_date).getTime();
    const peerEnd = peer.offering_end_date ? new Date(peer.offering_end_date).getTime() : peerStart + 365 * 86400000;

    const overlapsOrWithin30Days =
      targetStart <= peerEnd + thirtyDaysMs && peerStart <= targetEnd + thirtyDaysMs;

    if (
      overlapsOrWithin30Days &&
      ((offering.exemption_pathway === 'RULE_506_B' && peer.exemption_pathway === 'RULE_506_C') ||
        (offering.exemption_pathway === 'RULE_506_C' && peer.exemption_pathway === 'RULE_506_B'))
    ) {
      if (!offering.rule_152_counsel_clearance) {
        issues.push(
          `Rule 152 integration hazard: Offering ${offering.id} (${offering.exemption_pathway}) overlaps or sits within 30 days of ${peer.id} (${peer.exemption_pathway}) without counsel clearance confirming non-general-solicitation investor sourcing.`
        );
      }
    }
  }
  return issues;
}

/**
 * Master Release-Blocking Compliance Gate Evaluator for a PPM Offering.
 */
export function evaluateOfferingComplianceGates(
  offering: PPMOffering,
  peerOfferings: PPMOffering[] = []
): ComplianceGateEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Operative Pathway Check
  try {
    assertOperativeExemptionPathway(offering.exemption_pathway);
  } catch (e: any) {
    blockers.push(e.message);
  }

  // 2. Distinct-Individual Four-Eyes Approval Check
  if (
    !offering.approved_by ||
    offering.approved_by === offering.created_by ||
    (offering.approved_by_individual_id &&
      offering.created_by_individual_id &&
      offering.approved_by_individual_id === offering.created_by_individual_id)
  ) {
    blockers.push('Independent four-eyes Checker approval by a distinct authenticated individual is required.');
  }

  // 3. Qualified Securities Counsel Review (Named reviewer, scope, decision, timestamp, evidence)
  const cr = offering.counsel_review_record;
  if (
    !offering.counsel_reviewed ||
    !offering.counsel_selected_pathway ||
    !cr ||
    !cr.reviewer_name?.trim() ||
    !cr.scope?.trim() ||
    !cr.timestamp?.trim() ||
    !cr.evidence_ref?.trim() ||
    cr.decision === 'REJECTED'
  ) {
    blockers.push(
      'Qualified securities counsel review record (named reviewer, scope, non-rejected decision, timestamp, and evidence reference) and pathway sign-off are required.'
    );
  }

  // 4. Tokenized Security Gate (SEC Release 33-11412, eff. Mar 23, 2026)
  if (offering.is_tokenized_security && !offering.tokenized_asset_classification_verified) {
    blockers.push(
      'Tokenized Security Gate (SEC Release 33-11412): On-chain or tokenized notes are not exempt from federal securities laws; explicit tokenized-security legal classification verification is required.'
    );
  }

  // 5. Mandatory Disclosure Completeness
  if (!offering.risk_factors || offering.risk_factors.length === 0) {
    blockers.push('Mandatory disclosure missing: At least one risk factor must be documented.');
  }
  if (!offering.use_of_proceeds?.trim()) blockers.push('Mandatory disclosure missing: Use of proceeds.');
  if (!offering.offering_expenses?.trim()) blockers.push('Mandatory disclosure missing: Offering expenses.');
  if (!offering.fees_and_compensation?.trim()) blockers.push('Mandatory disclosure missing: Fees and compensation.');
  if (!offering.conflicts_of_interest?.trim()) blockers.push('Mandatory disclosure missing: Conflicts of interest.');
  if (!offering.transfer_restrictions?.trim()) blockers.push('Mandatory disclosure missing: Transfer restrictions.');

  // 6. Pathway-Specific Statutory Rules
  const amountNum = Number(offering.offering_amount);
  const affiliateNum = Number(offering.affiliate_offering_amount || 0);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    blockers.push('Offering amount must be a positive numeric amount.');
  }
  if (Number.isNaN(affiliateNum) || affiliateNum < 0) {
    blockers.push('Affiliate selling-securityholder amount cannot be negative.');
  }

  const rule506bCount = countRule506bNonAccreditedPurchasers(offering.investor_records || []);
  if (offering.exemption_pathway === 'RULE_506_B') {
    if (offering.general_solicitation_used) {
      blockers.push('Rule 506(b) violation: General solicitation or general advertising is strictly prohibited under Rule 506(b).');
    }
    if (rule506bCount > RULE_506B_MAX_NON_ACCREDITED_IN_OFFERING) {
      blockers.push(
        `Rule 506(b) violation: ${rule506bCount} non-accredited purchasers exceeds maximum 35 allowed under 17 CFR § 230.506(b)(2)(i).`
      );
    }
  }

  if (offering.exemption_pathway === 'REG_A_TIER_1') {
    if (amountNum > REG_A_TIER_1_CAP_USD) {
      blockers.push(`Regulation A Tier 1 statutory cap exceeded ($${REG_A_TIER_1_CAP_USD.toLocaleString()} max per 12 months).`);
    }
    if (affiliateNum > REG_A_TIER_1_AFFILIATE_CAP_USD) {
      blockers.push(
        `Regulation A Tier 1 affiliate selling-securityholder cap exceeded ($${REG_A_TIER_1_AFFILIATE_CAP_USD.toLocaleString()} max per 12 months).`
      );
    }
    if (!offering.form_1a_qualified) {
      blockers.push('Regulation A Tier 1 requires SEC Form 1-A qualification before sales.');
    }
    const hasRegisteredState = (offering.reg_a_state_registrations || []).some(
      s => s.status === 'REGISTERED' || s.status === 'EXEMPT'
    );
    if (!hasRegisteredState) {
      blockers.push('Regulation A Tier 1 requires applicable state securities registration or exemption records (not federally preempted).');
    }
  }

  if (offering.exemption_pathway === 'REG_A_TIER_2') {
    if (amountNum > REG_A_TIER_2_CAP_USD) {
      blockers.push(`Regulation A Tier 2 statutory cap exceeded ($${REG_A_TIER_2_CAP_USD.toLocaleString()} max per 12 months).`);
    }
    if (affiliateNum > REG_A_TIER_2_AFFILIATE_CAP_USD) {
      blockers.push(
        `Regulation A Tier 2 affiliate selling-securityholder cap exceeded ($${REG_A_TIER_2_AFFILIATE_CAP_USD.toLocaleString()} max per 12 months).`
      );
    }
    if (!offering.form_1a_qualified) {
      blockers.push('Regulation A Tier 2 requires SEC Form 1-A qualification before sales.');
    }
    if (!offering.audited_financials_attached || !offering.auditor_firm?.trim()) {
      blockers.push('Regulation A Tier 2 requires audited financial statements and named independent auditor.');
    }
    if (!offering.ongoing_sec_reporting?.form_1u_monitoring_enabled) {
      blockers.push('Regulation A Tier 2 requires ongoing SEC reporting controls (Form 1-K, 1-SA, 1-U tracking).');
    }
  }

  if (offering.exemption_pathway === 'REG_S' && offering.us_directed_selling_efforts) {
    blockers.push('Regulation S violation: Directed selling efforts in the United States are strictly prohibited.');
  }

  // 7. Rule 506(d) Bad-Actor Screening
  if (!offering.bad_actor_screened) {
    blockers.push('Rule 506(d) Bad-Actor screening of covered persons is incomplete.');
  } else if (offering.bad_actor_disqualifying_event) {
    const disqualifyingPersons = (offering.covered_persons || []).filter(cp => cp.disqualifying_event_found);
    const postCutoffUnwaived = disqualifyingPersons.some(
      (cp) => (!cp.event_date || cp.event_date >= RULE_506D_TRIGGER_DATE) && !cp.sec_waiver_ref
    );
    const preCutoffUnwaived = disqualifyingPersons.some(
      (cp) => Boolean(cp.event_date && cp.event_date < RULE_506D_TRIGGER_DATE) && !cp.sec_waiver_ref
    );
    if (disqualifyingPersons.length === 0 || postCutoffUnwaived) {
      blockers.push(
        'Rule 506(d) disqualification: Disqualifying event on/after Sept 23, 2013 detected without an SEC waiver reference.'
      );
    } else if (preCutoffUnwaived && !offering.bad_actor_written_disclosure_delivered) {
      blockers.push(
        'Rule 506(d) disclosure gate: Pre-Sept 23, 2013 disqualifying event requires mandatory written disclosure delivery to investors.'
      );
    }
  }

  // 8. Rule 152 Integration Hazards
  const integrationIssues = checkRule152IntegrationHazards(offering, peerOfferings);
  blockers.push(...integrationIssues);

  // 9. FINRA Rule 5123 Tracking (separate from issuer Rule 506 eligibility)
  const finraIssues = validateFinra5123Tracking(offering);
  for (const issue of finraIssues) {
    if (issue.includes('SR-FINRA-2026-002') || issue.includes('compensation')) {
      blockers.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  // 10. Immutable Document Hash Verification
  const expectedHash = computePpmDocumentHash(offering);
  if (!offering.document_sha256 || offering.document_sha256 !== expectedHash) {
    blockers.push('Immutable PPM document hash mismatch or missing SHA-256 digest.');
  }

  // 11. Independently Calculated Statutory Deadlines from Immutable First-Sale Events
  const deadlines: ComplianceGateEvaluation['deadlines'] = {};
  const firstCommitmentAnchor =
    offering.first_irrevocable_commitment_event?.event_date || offering.first_irrevocable_commitment_date;
  const firstNvAnchor =
    offering.first_nevada_sale_event?.event_date || offering.first_nevada_sale_date;

  if (firstCommitmentAnchor) {
    deadlines.federal_form_d_due = addCalendarDays(firstCommitmentAnchor, 15);
    deadlines.federal_form_d_annual_renewal = addCalendarYears(firstCommitmentAnchor, 1);
    if (!offering.form_d_tracking?.filed && (offering.exemption_pathway === 'RULE_506_B' || offering.exemption_pathway === 'RULE_506_C')) {
      warnings.push(`Federal Form D must be filed by ${deadlines.federal_form_d_due} (15 calendar days from first irrevocable commitment).`);
    }
    if (offering.placement_agent?.has_placement_agent && offering.placement_agent?.finra_member) {
      deadlines.finra_5123_due = addCalendarDays(firstCommitmentAnchor, 15);
    }
  }
  if (firstNvAnchor) {
    deadlines.nevada_nac_90_5145_due = addCalendarDays(firstNvAnchor, 15);
    deadlines.nevada_nac_90_5145_effective_until = addCalendarYears(firstNvAnchor, 1);
    if (offering.nevada_nac_90_5145?.status !== 'FILED') {
      warnings.push(
        `Nevada NAC 90.5145 notice filing (Form D + $${NEVADA_NAC_90_5145_FEE_USD} fee) due by ${deadlines.nevada_nac_90_5145_due}; expires ${deadlines.nevada_nac_90_5145_effective_until}.`
      );
    }
  }
  if (offering.exemption_pathway === 'REG_A_TIER_2' && offering.ongoing_sec_reporting) {
    deadlines.reg_a_form_1k_due = offering.ongoing_sec_reporting.form_1k_due;
    deadlines.reg_a_form_1sa_due = offering.ongoing_sec_reporting.form_1sa_due;
  }

  return {
    distribution_ready: blockers.length === 0,
    blockers,
    warnings,
    deadlines,
    rule_506b_non_accredited_count: rule506bCount,
    compliance_disclaimer: COMPLIANCE_DISCLAIMER
  };
}
