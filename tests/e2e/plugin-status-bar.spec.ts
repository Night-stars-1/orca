/**
 * Invariant: a consented plugin's status-bar items render from the manifest,
 * update from the worker and from a popover panel, and can be hidden by the user.
 */

import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from './helpers/orca-app'

test('renders and updates status-bar-demo items', async ({ orcaPage }) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'orca-status-bar-plugin-e2e-'))
  const pluginRoot = join(tempRoot, 'status-bar-demo')
  await cp(join(process.cwd(), 'examples', 'plugins', 'status-bar-demo'), pluginRoot, {
    recursive: true
  })

  try {
    const pluginKey = await orcaPage.evaluate(async (sourcePath) => {
      const settings = await window.api.settings.set({ pluginSystemEnabled: true })
      window.__store?.setState({ settings })
      const result = await window.api.plugins.install({ kind: 'local-path', path: sourcePath })
      if (!result.ok) {
        throw new Error(result.error)
      }
      await window.api.plugins.consent({
        pluginKey: result.pluginKey,
        reviewedFingerprint: result.consentFingerprint,
        decision: 'approve'
      })
      return result.pluginKey
    }, pluginRoot)

    const build = orcaPage.locator(`[data-plugin-status-bar-item="${pluginKey}/build"]`)
    await expect(build).toContainText('Build: idle', { timeout: 15_000 })
    // Before the worker runs, only manifest values show.
    await expect(build.getByRole('progressbar')).toHaveCount(0)

    await build.click()
    await expect(build.getByRole('progressbar')).toBeVisible({ timeout: 15_000 })
    await expect(build).toContainText(/Build: \d+%/)
    await expect(build).toContainText('Build: done', { timeout: 15_000 })
    await expect(build).toContainText('ok')
    await expect(build.getByRole('progressbar')).toHaveCount(0)

    const details = orcaPage.locator(`[data-plugin-status-bar-item="${pluginKey}/details"]`)
    await details.click()
    const frame = orcaPage.frameLocator('iframe[title="Build Details"]').first()
    await frame.getByRole('button', { name: 'Flag the details item' }).click()
    await expect(frame.getByText('Badge set from the panel.')).toBeVisible()
    await expect(details).toContainText('!')
    await orcaPage.keyboard.press('Escape')

    // Items opt out of the bar's context menu like other interactive segments.
    await orcaPage.locator('.status-bar-usage-cluster').click({ button: 'right' })
    await orcaPage.getByRole('menuitemcheckbox', { name: 'Status Bar Demo: Build: done' }).click()
    await expect(build).toHaveCount(0)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
