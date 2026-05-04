/**
 * StrengthTracker (ST) deploy context — product identity separate from any one gym brand.
 * Deploy **one stack per (stage × tenantSlug)**; add tenants by deploying again with a new slug.
 */

export interface DeployContext {
  readonly tenantSlug: string
  readonly stage: string
  readonly productPrefix: string
}

export function stackBaseName(ctx: DeployContext): string {
  return `${ctx.productPrefix}-${ctx.stage}-${ctx.tenantSlug}`.toLowerCase()
}

/**
 * Future per-client dashboards + subdomains: map e.g. `acme` + apex `strengthtracker.com`
 * to a dedicated distribution or origin. Not wired in v1 — use `baseDomain` context only for
 * outputs/docs until Route53 + ACM are added.
 */
export function suggestedTenantHostname(tenantSlug: string, apexDomain: string): string {
  return `${tenantSlug}.${apexDomain}`
}
