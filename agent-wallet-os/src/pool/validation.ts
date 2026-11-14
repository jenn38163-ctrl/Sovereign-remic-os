import { AssetPool, CollateralVerificationStages, PoolLinkReadiness } from './types';

/**
 * Evaluates whether a collateral pool has completed all 8 required verification stages
 * and computes remaining unallocated collateral capacity.
 * Note: Having a UCC-1 filing reference alone does NOT establish ownership, attachment, or perfection.
 */
export function evaluatePoolLinkReadiness(pool: AssetPool): PoolLinkReadiness {
  const v: CollateralVerificationStages = pool.verification || ({} as CollateralVerificationStages);
  const missing: string[] = [];

  if (pool.status !== 'ACTIVE_CUSTODED') {
    missing.push('Four-eyes pool approval (status must be ACTIVE_CUSTODED)');
  }
  if (!v.asset_ownership_verified || !v.ownership_evidence_ref) {
    missing.push('Asset ownership independently verified with documentary evidence ref');
  }
  if (!v.custody_independently_verified || !v.custody_evidence_ref) {
    missing.push('Custody independently verified with custodian evidence ref');
  }
  if (!v.assignment_transfer_authority_verified) {
    missing.push('Assignment and transfer authority verified');
  }
  if (!v.ucc_filing_evidence_received) {
    missing.push('UCC filing evidence received (filing ref alone is insufficient)');
  }
  if (!v.filing_jurisdiction_debtor_name_verified) {
    missing.push('Filing jurisdiction and exact debtor legal name verified');
  }
  if (!v.security_interest_perfection_reviewed || !v.perfection_reviewer) {
    missing.push('Security interest attachment and perfection independently reviewed');
  }
  if (!v.pool_valuation_eligibility_approved || !v.underlying_assets_evidence_ref) {
    missing.push('Pool valuation, eligibility, and independent evidence of underlying assets approved');
  }
  if (!v.approved_for_offering_linkage) {
    missing.push('Pool explicitly approved for linkage to a particular offering/obligation');
  }

  const totalPrincipal = Number(pool.total_principal_value || 0);
  const allocatedPrincipal = (pool.allocated_obligations || []).reduce(
    (sum, item) => sum + Number(item.allocated_amount || 0),
    0
  );
  const availablePrincipal = Math.max(0, totalPrincipal - allocatedPrincipal);

  return {
    ready_for_linkage: missing.length === 0,
    missing_stages: missing,
    total_principal: totalPrincipal,
    allocated_principal: allocatedPrincipal,
    available_principal: availablePrincipal
  };
}

/**
 * Enforces anti-duplicate allocation and anti-over-pledging before linking a collateral pool
 * to a Debt Note or PPM Offering.
 */
export function assertPoolCanAllocate(
  pool: AssetPool,
  targetType: 'DEBT_NOTE' | 'PPM_OFFERING',
  targetId: string,
  requestedAmount: number
): PoolLinkReadiness {
  const readiness = evaluatePoolLinkReadiness(pool);
  if (!readiness.ready_for_linkage) {
    throw new Error(
      `Collateral pool ${pool.id} is NOT cleared for offering/obligation linkage. Missing stages: ${readiness.missing_stages.join('; ')}`
    );
  }

  if (Number.isNaN(requestedAmount) || requestedAmount <= 0) {
    throw new Error('Requested collateral allocation amount must be strictly positive.');
  }

  const duplicate = (pool.allocated_obligations || []).some(
    (a) => a.target_type === targetType && a.target_id === targetId
  );
  if (duplicate) {
    throw new Error(
      `Duplicate collateral allocation blocked: Pool ${pool.id} is already pledged/linked to ${targetType} ${targetId}.`
    );
  }

  if (requestedAmount > readiness.available_principal + 1e-6) {
    throw new Error(
      `Over-pledge blocked: Requested allocation $${requestedAmount.toLocaleString()} exceeds pool ${pool.id} available unpledged principal $${readiness.available_principal.toLocaleString()} (total $${readiness.total_principal.toLocaleString()}, already allocated $${readiness.allocated_principal.toLocaleString()}).`
    );
  }

  return readiness;
}
