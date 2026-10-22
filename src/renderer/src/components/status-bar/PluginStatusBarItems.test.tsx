// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginHostListEntry } from '../../../../preload/api-types'
import type { PluginStatusBarSnapshot } from '../../../../shared/plugins/plugin-status-bar'
import { usePluginPanelsStore } from '@/store/plugin-panels'
import { usePluginStatusBarStore } from '@/store/plugin-status-bar'
import { TooltipProvider } from '../ui/tooltip'
import { PluginStatusBarItems } from './PluginStatusBarItems'

const plugin: PluginHostListEntry = {
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
    { id: 'start', title: 'Start', context: 'global', handler: { type: 'worker' }, keybindings: [] }
  ],
  statusBar: [{ id: 'build', text: 'Build: idle', icon: 'hammer', priority: 0, command: 'start' }],
  hasWorker: true,
  restarts: 0
}

let pushStatusBar: ((snapshot: PluginStatusBarSnapshot) => void) | null = null
const invokeCommand = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      plugins: {
        list: async () => [plugin],
        onChanged: () => () => undefined,
        invokeCommand,
        listStatusBar: async () => [],
        onStatusBarChanged: (callback: (snapshot: PluginStatusBarSnapshot) => void) => {
          pushStatusBar = callback
          return () => undefined
        }
      }
    }
  })
  usePluginPanelsStore.getState().setPlugins([plugin])
  usePluginStatusBarStore.setState({ states: {}, hiddenKeys: [] })
})

afterEach(() => {
  cleanup()
  invokeCommand.mockClear()
})

async function mount(): Promise<void> {
  await act(async () => {
    render(
      <TooltipProvider>
        <PluginStatusBarItems iconOnly={false} />
      </TooltipProvider>
    )
  })
}

describe('PluginStatusBarItems', () => {
  it('renders the manifest item and runs its command on click', async () => {
    await mount()
    fireEvent.click(screen.getByText('Build: idle'))
    expect(invokeCommand).toHaveBeenCalledWith({ pluginKey: 'acme.build', commandId: 'start' })
  })

  it('renders pushed text, progress, and badge', async () => {
    await mount()
    act(() => {
      pushStatusBar?.({
        pluginKey: 'acme.build',
        items: {
          build: {
            text: 'Build: 40%',
            progress: { value: 40 },
            badge: { text: '2', tone: 'warning' }
          }
        }
      })
    })
    expect(screen.getByText('Build: 40%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('hides items the user or the plugin turned off', async () => {
    usePluginStatusBarStore.setState({ hiddenKeys: ['acme.build/build'] })
    await mount()
    expect(screen.queryByText('Build: idle')).toBeNull()
    act(() => {
      usePluginStatusBarStore.setState({
        hiddenKeys: [],
        states: { 'acme.build': { build: { hidden: true } } }
      })
    })
    expect(screen.queryByText('Build: idle')).toBeNull()
  })
})
