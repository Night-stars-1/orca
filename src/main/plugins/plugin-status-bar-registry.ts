import {
  mergePluginStatusBarUpdate,
  type PluginStatusBarItemState,
  type PluginStatusBarSnapshot,
  type PluginStatusBarUpdate
} from '../../shared/plugins/plugin-status-bar'

type StatusBarRegistryHooks = {
  /** Declared item ids of an approved plugin; null when it may not draw. */
  declaredItemIds: (pluginKey: string) => ReadonlySet<string> | null
  onChanged: (snapshot: PluginStatusBarSnapshot) => void
}

/** In-memory runtime overrides for plugin status-bar items. Electron-free; the
 *  desktop startup wires hooks, so an unwired registry rejects every update. */
export class PluginStatusBarRegistry {
  private readonly states = new Map<string, Record<string, PluginStatusBarItemState>>()
  private hooks: StatusBarRegistryHooks | null = null

  configure(hooks: StatusBarRegistryHooks | null): void {
    this.hooks = hooks
  }

  update(
    pluginKey: string,
    update: PluginStatusBarUpdate
  ): { ok: true } | { ok: false; error: string } {
    const declared = this.hooks?.declaredItemIds(pluginKey)
    if (!this.hooks || !declared) {
      return { ok: false, error: 'status bar is not available' }
    }
    if (!declared.has(update.id)) {
      return { ok: false, error: `unknown status bar item: ${update.id}` }
    }
    const items = { ...this.states.get(pluginKey) }
    // Why: own-key check so an id like `constructor` can't merge a prototype member.
    items[update.id] = mergePluginStatusBarUpdate(
      Object.hasOwn(items, update.id) ? items[update.id] : undefined,
      update
    )
    this.states.set(pluginKey, items)
    this.hooks.onChanged({ pluginKey, items })
    return { ok: true }
  }

  list(): PluginStatusBarSnapshot[] {
    return [...this.states].map(([pluginKey, items]) => ({ pluginKey, items }))
  }

  /** Drops state of plugins that can no longer draw (disabled, removed, unconsented). */
  prune(): void {
    for (const pluginKey of this.states.keys()) {
      if (!this.hooks?.declaredItemIds(pluginKey)) {
        this.states.delete(pluginKey)
        this.hooks?.onChanged({ pluginKey, items: {} })
      }
    }
  }
}

export const pluginStatusBarRegistry = new PluginStatusBarRegistry()
