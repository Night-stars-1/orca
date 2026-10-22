import { describe, expect, it } from 'vitest'
import { parsePluginManifest } from './plugin-manifest'
import { mergePluginStatusBarUpdate, pluginStatusBarUpdateParamsSchema } from './plugin-status-bar'
import { gatePluginHostCall } from './plugin-capability-gate'

function manifest(contributes: Record<string, unknown>): Record<string, unknown> {
  return {
    manifestVersion: 1,
    id: 'status',
    publisher: 'orca-samples',
    name: 'Status',
    version: '1.0.0',
    engines: { orca: '>=1.0.0' },
    pluginApi: 1,
    main: 'main.mjs',
    contributes,
    capabilities: [{ kind: 'statusBar:write' }]
  }
}

describe('statusBar manifest contributions', () => {
  it('applies defaults and accepts references to declared commands and panels', () => {
    const parsed = parsePluginManifest(
      manifest({
        commands: [{ id: 'refresh', title: 'Refresh' }],
        panels: [{ id: 'details', title: 'Details', entry: 'panel.html' }],
        statusBar: [{ id: 'build', command: 'refresh', popover: 'details' }]
      })
    )
    expect(parsed.ok && parsed.manifest.contributes.statusBar).toEqual([
      { id: 'build', text: '', priority: 0, command: 'refresh', popover: 'details' }
    ])
  })

  it.each([
    [{ statusBar: [{ id: 'a' }, { id: 'a' }] }, 'duplicate statusBar id: a'],
    [{ statusBar: [{ id: 'a', command: 'missing' }] }, 'unknown contributed command: missing'],
    [{ statusBar: [{ id: 'a', popover: 'missing' }] }, 'unknown contributed panel: missing']
  ])('rejects invalid item %#', (contributes, error) => {
    expect(parsePluginManifest(manifest(contributes))).toMatchObject({
      ok: false,
      error: expect.stringContaining(error)
    })
  })
})

describe('statusBar.update params', () => {
  it('keeps omitted fields and clears null ones', () => {
    const first = mergePluginStatusBarUpdate(
      undefined,
      pluginStatusBarUpdateParamsSchema.parse({
        id: 'build',
        text: 'Building',
        progress: { value: 40 },
        badge: { text: '2' }
      })
    )
    const next = mergePluginStatusBarUpdate(
      first,
      pluginStatusBarUpdateParamsSchema.parse({ id: 'build', progress: null })
    )
    expect(next).toEqual({
      text: 'Building',
      progress: null,
      badge: { text: '2', tone: 'default' }
    })
  })

  it('rejects unknown fields and out-of-range progress', () => {
    expect(pluginStatusBarUpdateParamsSchema.safeParse({ id: 'a', html: '<b>' }).success).toBe(
      false
    )
    expect(
      pluginStatusBarUpdateParamsSchema.safeParse({ id: 'a', progress: { value: 101 } }).success
    ).toBe(false)
  })

  it('is gated on the statusBar:write capability for workers and panels', () => {
    const gate = (granted: 'storage' | 'statusBar:write', viaPanel: boolean) =>
      gatePluginHostCall({ grantedCapabilities: [granted], viaPanel }, 'statusBar.update').granted
    expect(gate('storage', false)).toBe(false)
    expect(gate('statusBar:write', false)).toBe(true)
    expect(gate('statusBar:write', true)).toBe(true)
  })
})
