export type PoolType =
  | 'MORTGAGE_REMIC'
  | 'TREASURY_COLLATERAL'
  | 'COMMERCIAL_REAL_ESTATE'
  | 'MIXED_FIXED_INCOME';

export type PoolStatus =
  | 'PENDING_VERIFICATION'
  | 'PENDING_CHECKER_APPROVAL'
  | 'ACTIVE_CUSTODED'
  | 'ARCHIVED';

export interface CollateralAllocationRecord {
  id: string;
  target_type: 'DEBT_NOTE' | 'PPM_OFFERING';
  target_id: string;
  allocated_amount: string;
  linked_at: string;
  linked_by: string;
}

export interface CollateralVerificationStages {
  asset_ownership_verified: boolean;
  ownership_evidence_ref?: string;
  custody_independently_verified: boolean;
  custody_evidence_ref?: string;
  assignment_transfer_authority_verified: boolean;
  assignment_authority_ref?: string;
  ucc_filing_evidence_received: boolean;
  filing_jurisdiction_debtor_name_verified: boolean;
  security_interest_perfection_reviewed: boolean;
  perfection_reviewer?: string;
  perfection_review_date?: string;
  pool_valuation_eligibility_approved: boolean;
  underlying_assets_evidence_ref?: string;
  approved_for_offering_linkage: boolean;
}

export interface AssetPool {
  id: string;
  tenant_id: string;
  pool_name: string;
  pool_type: PoolType;
  custodian: string;
  jurisdiction: string;
  debtor_legal_name: string;
  total_principal_value: string;
  weighted_avg_coupon: string;
  weighted_avg_maturity_months: number;
  asset_count: number;
  ucc_filing_ref: string;

  // Granular Legal & Collateral Perfection Controls (UCC-1 ref alone !== perfection)
  verification: CollateralVerificationStages;

  // Allocation & Anti-Double-Pledge Tracking
  allocated_obligations: CollateralAllocationRecord[];
  linked_debt_note_ids: string[];
  linked_ppm_ids: string[];

  // Workflow, Distinct-Individual 4-Eyes & Registered Key Signature
  status: PoolStatus;
  created_by: string;
  created_by_individual_id: string;
  approved_by?: string | null;
  approved_by_individual_id?: string | null;
  signature?: string | null;
  signature_key_id?: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PoolLinkReadiness {
  ready_for_linkage: boolean;
  missing_stages: string[];
  total_principal: number;
  allocated_principal: number;
  available_principal: number;
}
