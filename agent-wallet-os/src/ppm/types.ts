export type ExemptionPathway =
  | 'RULE_506_B'
  | 'RULE_506_C'
  | 'REG_A_TIER_1'
  | 'REG_A_TIER_2'
  | 'REG_S';

export type OfferingStatus =
  | 'DRAFT'
  | 'PENDING_CHECKER_APPROVAL'
  | 'APPROVED'
  | 'COUNSEL_REVIEWED'
  | 'DISTRIBUTION_READY'
  | 'BLOCKED_COMPLIANCE'
  | 'ARCHIVED';

export type AccreditationVerificationMethod =
  | 'SELF_ATTESTATION_CHECKBOX'
  | 'THIRD_PARTY_CPA_ATTORNEY'
  | 'BROKER_DEALER_RIA'
  | 'INCOME_TAX_W2_REVIEW'
  | 'NET_WORTH_STATEMENTS'
  | 'HIGH_MIN_INVESTMENT_WRITTEN_CONFIRMATION'
  | 'RULE_501_A_9_ENTITY_5M'
  | 'RULE_501_A_12_FAMILY_OFFICE_5M';

export type Finra5123Exemption =
  | 'NONE'
  | 'RULE_501_A_9_ENTITY_5M'
  | 'RULE_501_A_12_FAMILY_OFFICE_5M'
  | 'INSTITUTIONAL_QUALIFIED_PURCHASER';

export interface CoveredPersonScreening {
  name: string;
  role: string;
  inquiry_date: string;
  disqualifying_event_found: boolean;
  event_date?: string;
  sec_waiver_ref?: string;
  evidence_ref: string;
}

export interface PlacementAgentRecord {
  has_placement_agent: boolean;
  firm_name?: string;
  crd_number?: string;
  finra_member: boolean;
  commission_bps?: number;
  finder_fee_usd?: string;
  sales_compensation_disclosed: boolean;
}

export interface Finra5123Tracking {
  required: boolean;
  exemption_claimed: Finra5123Exemption;
  sr_finra_2026_002_operative_confirmed: boolean;
  deadline_date?: string;
  filing_status: 'NOT_REQUIRED' | 'PENDING' | 'FILED' | 'EXEMPT';
  filing_ref?: string;
  retail_communications_logged: string[];
}

export interface FormDTracking {
  due_date?: string;
  filed: boolean;
  accession_number?: string;
  annual_renewal_due?: string;
  last_amendment_date?: string;
}

export interface NevadaNac905145Tracking {
  applicable: boolean;
  fee_usd: number;
  amendment_fee_usd: number;
  due_date?: string;
  effective_until?: string;
  status: 'NOT_APPLICABLE' | 'PENDING' | 'FILED' | 'RENEWAL_DUE';
  filing_ref?: string;
}

export interface ImmutableFirstSaleEvent {
  recorded_at: string;
  event_date: string;
  investor_id: string;
  immutable: true;
}

export interface StateNoticeFiling {
  state: string;
  portal: 'NASAA_EFD' | 'STATE_DIRECT';
  fee_usd: number;
  due_date: string;
  status: 'PENDING' | 'FILED';
  filing_ref?: string;
}

export interface RegAStateRegistration {
  state: string;
  status: 'PENDING' | 'REGISTERED' | 'EXEMPT';
  filing_ref?: string;
}

export interface RegAOngoingReporting {
  form_1k_due?: string;
  form_1sa_due?: string;
  form_1u_monitoring_enabled: boolean;
}

export interface CounselReviewRecord {
  reviewer_name: string;
  firm_or_bar_ref: string;
  scope: string;
  decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  timestamp: string;
  evidence_ref: string;
}

export interface PPMVersionEntry {
  version: number;
  sha256: string;
  created_at: string;
  created_by: string;
  change_summary: string;
}

export interface InvestorComplianceRecord {
  id: string;
  investor_label: string;
  accredited: boolean;
  verification_method: AccreditationVerificationMethod;
  verification_evidence_ref?: string;
  sophisticated_verified?: boolean;
  rule_502b_disclosures_delivered?: boolean;
  // Rule 501(e) purchaser counting under Rule 506(b)
  rule_501e_counting_weight?: number;
  rule_501e_exclusion_reason?: string;
  // Regulation A Tier 2 10% non-accredited investment limit (17 CFR 230.251(d)(2)(i)(C))
  annual_income_or_revenue_usd?: string;
  net_worth_or_assets_usd?: string;
  reg_a_tier2_10pct_cap_verified?: boolean;
  ppm_version_delivered: number;
  ppm_hash_delivered: string;
  q_and_a_acknowledged: boolean;
  solicited_by: string;
  state_of_residence: string;
  is_us_person: boolean;
  subscription_date: string;
  investment_amount: string;
}

export interface PPMOffering {
  id: string;
  tenant_id: string;
  title: string;
  exemption_pathway: ExemptionPathway;
  counsel_selected_pathway: boolean;
  offering_amount: string;
  affiliate_offering_amount: string;
  minimum_investment: string;
  maturity_months: number;
  target_interest_rate: string;
  linked_debt_note_id?: string;
  linked_pool_id?: string;

  // SEC Release 33-11412 Tokenized Security Gate
  is_tokenized_security: boolean;
  tokenized_asset_classification_verified: boolean;
  tokenized_counsel_memo_ref?: string;

  // Mandatory Disclosures
  risk_factors: string[];
  use_of_proceeds: string;
  offering_expenses: string;
  fees_and_compensation: string;
  conflicts_of_interest: string;
  related_party_transactions: string;
  investor_eligibility: string;
  transfer_restrictions: string;

  // Pathway, Solicitation, Reg A Tier 1/2 & Integration Controls
  general_solicitation_used: boolean;
  us_directed_selling_efforts?: boolean;
  form_1a_qualified?: boolean;
  audited_financials_attached?: boolean;
  auditor_firm?: string;
  national_exchange_listed?: boolean;
  reg_a_state_registrations?: RegAStateRegistration[];
  ongoing_sec_reporting?: RegAOngoingReporting;
  offering_start_date: string;
  offering_end_date?: string;
  concurrent_offerings_checked: boolean;
  rule_152_counsel_clearance?: boolean;

  // Rule 506(d) Bad-Actor Screening
  bad_actor_screened: boolean;
  bad_actor_disqualifying_event: boolean;
  bad_actor_written_disclosure_delivered: boolean;
  covered_persons: CoveredPersonScreening[];

  // FINRA Rule 5123 & Placement Agent Controls
  placement_agent: PlacementAgentRecord;
  finra_5123_filing: Finra5123Tracking;

  // Immutable First-Sale Anchors, Form D, Nevada NAC 90.5145 & Multi-State Filings
  first_irrevocable_commitment_date?: string;
  first_irrevocable_commitment_event?: ImmutableFirstSaleEvent | null;
  first_nevada_sale_date?: string;
  first_nevada_sale_event?: ImmutableFirstSaleEvent | null;
  form_d_tracking: FormDTracking;
  nevada_nac_90_5145: NevadaNac905145Tracking;
  state_notice_filings: StateNoticeFiling[];

  // Immutable Versioning & Investor Delivery Log
  version: number;
  document_sha256: string;
  version_history: PPMVersionEntry[];
  investor_records: InvestorComplianceRecord[];

  // Workflow, Distinct-Individual Four-Eyes & Complete Counsel Sign-off
  status: OfferingStatus;
  created_by: string;
  created_by_individual_id?: string;
  approved_by?: string | null;
  approved_by_individual_id?: string | null;
  counsel_reviewed: boolean;
  counsel_reviewer?: string | null;
  counsel_review_date?: string | null;
  counsel_review_record?: CounselReviewRecord | null;
  signature?: string | null;
  signature_key_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceGateEvaluation {
  distribution_ready: boolean;
  blockers: string[];
  warnings: string[];
  deadlines: {
    federal_form_d_due?: string;
    federal_form_d_annual_renewal?: string;
    nevada_nac_90_5145_due?: string;
    nevada_nac_90_5145_effective_until?: string;
    finra_5123_due?: string;
    reg_a_form_1k_due?: string;
    reg_a_form_1sa_due?: string;
  };
  rule_506b_non_accredited_count?: number;
  compliance_disclaimer: string;
}
