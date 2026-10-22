import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { PluginStatusBarItemState } from '../../../shared/plugins/plugin-status-bar'
import type { PluginHostListEntry } from '../../../preload/api-types'
import {
  ensurePluginPanelsLoaded,
  usePluginPanelsStore,
  type ActivePluginCommand
} from './plugin-panels'

export type ResolvedPluginStatusBarItem = {
  /** `<pluginKey>/<itemId>`; also the visibility-menu identity. */
  key: string
  pluginKey: string
  pluginName: string
  text: string
  icon?: string
  tooltip?: string
  priority: number
  progress: { value?: number } | null
  spinner: boolean
  badge: NonNullable<PluginStatusBarItemState['badge']> | null
  menu: { title: string; command: ActivePluginCommand }[]
  command: ActivePluginCommand | null
  popoverTabKey?: `plugin:${string}`
  /** Plugin asked to hide it (`hidden: true`), independent of the user toggle. */
  hiddenByPlugin: boolean
}

const HIDDEN_STORAGE_KEY = 'orca.pluginStatusBar.hidden'

function readHiddenKeys(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HIDDEN_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []
  } catch {
    return []
  }
}

type PluginStatusBarState = {
  states: Record<string, Record<string, PluginStatusBarItemState>>
  hiddenKeys: string[]
  toggleHidden: (key: string) => void
}

export const usePluginStatusBarStore = create<PluginStatusBarState>()((set, get) => ({
  states: {},
  hiddenKeys: readHiddenKeys(),
  toggleHidden: (key) => {
    const current = get().hiddenKeys
    const hiddenKeys = current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key]
    set({ hiddenKeys })
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenKeys))
    } catch {
      // Preference stays in memory for this session.
    }
  }
}))

let statusBarSubscriptionStarted = false

function ensurePluginStatusBarLoaded(): void {
  const pluginsApi = window.api?.plugins
  if (statusBarSubscriptionStarted || !pluginsApi?.listStatusBar) {
    return
  }
  statusBarSubscriptionStarted = true
  // Why: subscribe before listing so a push racing the initial fetch isn't lost.
  pluginsApi.onStatusBarChanged?.((snapshot) => {
    usePluginStatusBarStore.setState((state) => ({
      states: { ...state.states, [snapshot.pluginKey]: snapshot.items }
    }))
  })
  void pluginsApi
    .listStatusBar()
    .then((snapshots) => {
      usePluginStatusBarStore.setState((state) => {
        const states = { ...state.states }
        for (const snapshot of snapshots) {
          states[snapshot.pluginKey] ??= snapshot.items
        }
        return { states }
      })
    })
    .catch(() => {
      statusBarSubscriptionStarted = false
    })
}

function pick<T>(items: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(items, key) ? items[key] : undefined
}

export function resolvePluginStatusBarItems(
  plugins: readonly PluginHostListEntry[],
  states: PluginStatusBarState['states']
): ResolvedPluginStatusBarItem[] {
  const items: ResolvedPluginStatusBarItem[] = []
  for (const plugin of plugins) {
    if (!['running', 'restarting', 'idle'].includes(plugin.status)) {
      continue
    }
    const commands = new Map(
      plugin.commands.map((command) => [
        command.id,
        { ...command, pluginKey: plugin.pluginKey, pluginName: plugin.name }
      ])
    )
    const pluginState = pick(states, plugin.pluginKey) ?? {}
    for (const declared of plugin.statusBar ?? []) {
      const state = pick(pluginState, declared.id) ?? {}
      const icon = state.icon === undefined ? declared.icon : (state.icon ?? undefined)
      const tooltip = state.tooltip === undefined ? declared.tooltip : (state.tooltip ?? undefined)
      items.push({
        key: `${plugin.pluginKey}/${declared.id}`,
        pluginKey: plugin.pluginKey,
        pluginName: plugin.name,
        text: state.text ?? declared.text,
        ...(icon ? { icon } : {}),
        ...(tooltip ? { tooltip } : {}),
        priority: declared.priority,
        progress: state.progress ?? null,
        spinner: state.spinner ?? false,
        badge: state.badge ?? null,
        // Why: menus may only run commands the manifest declared (and consent covered).
        menu: (state.menu ?? []).flatMap((entry) => {
          const command = commands.get(entry.command)
          return command ? [{ title: entry.title, command }] : []
        }),
        command: declared.command ? (commands.get(declared.command) ?? null) : null,
        ...(declared.popoverTabKey ? { popoverTabKey: declared.popoverTabKey } : {}),
        hiddenByPlugin: state.hidden ?? false
      })
    }
  }
  return items.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))
}

/** Every status-bar item of enabled plugins, including user-hidden ones. */
export function usePluginStatusBarItems(): ResolvedPluginStatusBarItem[] {
  const plugins = usePluginPanelsStore((state) => state.plugins)
  const states = usePluginStatusBarStore((state) => state.states)
  useEffect(() => {
    ensurePluginPanelsLoaded()
    ensurePluginStatusBarLoaded()
  }, [])
  return useMemo(() => resolvePluginStatusBarItems(plugins, states), [plugins, states])
}
