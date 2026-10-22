import { describe, expect, it, vi } from 'vitest'
import { PluginStatusBarRegistry } from './plugin-status-bar-registry'

function createRegistry(declared: Record<string, string[]>) {
  const registry = new PluginStatusBarRegistry()
  const onChanged = vi.fn()
  registry.configure({
    declaredItemIds: (pluginKey) =>
      Object.hasOwn(declared, pluginKey) ? new Set(declared[pluginKey]) : null,
    onChanged
  })
  return { registry, onChanged, declared }
}

describe('PluginStatusBarRegistry', () => {
  it('rejects every update before it is wired', () => {
    expect(new PluginStatusBarRegistry().update('a.b', { id: 'x' })).toMatchObject({ ok: false })
  })

  it('only accepts declared items of approved plugins', () => {
    const { registry, onChanged } = createRegistry({ 'a.b': ['build'] })
    expect(registry.update('a.b', { id: 'other', text: 'x' })).toMatchObject({ ok: false })
    expect(registry.update('c.d', { id: 'build', text: 'x' })).toMatchObject({ ok: false })
    expect(registry.update('a.b', { id: 'constructor', text: 'x' })).toMatchObject({ ok: false })
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('merges updates and pushes the plugin snapshot', () => {
    const { registry, onChanged } = createRegistry({ 'a.b': ['build'] })
    registry.update('a.b', { id: 'build', text: 'Building', spinner: true })
    registry.update('a.b', { id: 'build', spinner: false })
    expect(onChanged).toHaveBeenLastCalledWith({
      pluginKey: 'a.b',
      items: { build: { text: 'Building', spinner: false } }
    })
    expect(registry.list()).toEqual([
      { pluginKey: 'a.b', items: { build: { text: 'Building', spinner: false } } }
    ])
  })

  it('prunes plugins that can no longer draw and tells clients to clear them', () => {
    const { registry, onChanged, declared } = createRegistry({ 'a.b': ['build'] })
    registry.update('a.b', { id: 'build', text: 'Building' })
    delete declared['a.b']
    registry.prune()
    expect(registry.list()).toEqual([])
    expect(onChanged).toHaveBeenLastCalledWith({ pluginKey: 'a.b', items: {} })
  })
})
