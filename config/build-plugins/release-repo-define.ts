import type { UserConfig } from 'electron-vite'

// Why: fork builds publish to and update from their own GitHub repo (`owner/repo`).
const orcaReleaseRepo = process.env.ORCA_RELEASE_REPO
if (orcaReleaseRepo && !/^[\w.-]+\/[\w.-]+$/.test(orcaReleaseRepo)) {
  throw new Error(`ORCA_RELEASE_REPO must be "owner/repo", got: ${orcaReleaseRepo}`)
}
const releaseRepoLiteral = orcaReleaseRepo ? JSON.stringify(orcaReleaseRepo) : 'null'

/** Mutates in place so the per-target parallel build config sees it too. */
export function applyReleaseRepoDefine(config: UserConfig): void {
  for (const target of [config.main, config.renderer]) {
    if (target) {
      target.define = { ...target.define, ORCA_RELEASE_REPO: releaseRepoLiteral }
    }
  }
}
