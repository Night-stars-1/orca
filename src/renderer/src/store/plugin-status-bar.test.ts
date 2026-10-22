import { describe, expect, it } from 'vitest'
import type { PluginHostListEntry } from '../../../preload/api-types'
import { resolvePluginStatusBarItems } from './plugin-status-bar'

function plugin(overrides: Partial<PluginHostListEntry> = {}): PluginHostListEntry {
  return {
    pluginKey: 'acme.build',
    consentFingerprint: 'fp',
    name: 'Build',
    version: '1.0.0',
    publisher: 'acme',
    status: 'idle',
    needsReconsent: false,
    isDev: false,
    official: false,
    bundled: false,
    capabilities: [],
    panels: [],
    commands: [
      {
        id: 'refresh',
        title: 'Refresh',
        context: 'global',
        handler: { type: 'worker' },
        keybindings: []
      }
    ],
    statusBar: [
      { id: 'low', text: 'Low', priority: -1 },
      { id: 'build', text: 'Idle', icon: 'hammer', priority: 5, command: 'refresh' }
    ],
    hasWorker: true,
    restarts: 0,
    ...overrides
  }
}

describe('resolvePluginStatusBarItems', () => {
  it('layers runtime state over manifest items and sorts by priority', () => {
    const items = resolvePluginStatusBarItems([plugin()], {
      'acme.build': {
        build: {
          text: 'Building',
          icon: null,
          progress: { value: 30 },
          menu: [
            { title: 'Refresh', command: 'refresh' },
            { title: 'Undeclared', command: 'rm-rf' }
          ]
        }
      }
    })
    expect(items.map((item) => item.key)).toEqual(['acme.build/build', 'acme.build/low'])
    const [build] = items
    expect(build).toMatchObject({ text: 'Building', progress: { value: 30 }, spinner: false })
    expect(build?.icon).toBeUndefined()
    expect(build?.command?.id).toBe('refresh')
    expect(build?.menu.map((entry) => entry.title)).toEqual(['Refresh'])
  })

  it('omits items of plugins that are not enabled', () => {
    expect(resolvePluginStatusBarItems([plugin({ status: 'disabled' })], {})).toEqual([])
    expect(resolvePluginStatusBarItems([plugin({ status: 'pending' })], {})).toEqual([])
  })
})
