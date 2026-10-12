// Why: fork builds publish to and update from their own GitHub repo (`owner/repo`).
const orcaReleaseRepo = process.env.ORCA_RELEASE_REPO
if (orcaReleaseRepo && !/^[\w.-]+\/[\w.-]+$/.test(orcaReleaseRepo)) {
  throw new Error(`ORCA_RELEASE_REPO must be "owner/repo", got: ${orcaReleaseRepo}`)
}

export function withReleaseRepoDefine(define: Record<string, string>): Record<string, string> {
  return {
    ...define,
    ORCA_RELEASE_REPO: orcaReleaseRepo ? JSON.stringify(orcaReleaseRepo) : 'null'
  }
}
