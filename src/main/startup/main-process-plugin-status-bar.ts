import { BrowserWindow } from 'electron'
import type { PluginService } from '../plugins/plugin-service'
import { pluginStatusBarRegistry } from '../plugins/plugin-status-bar-registry'

/** Binds the status-bar registry to plugin approval and pushes changes to every window. */
export function wirePluginStatusBar(pluginService: PluginService): void {
  pluginStatusBarRegistry.configure({
    declaredItemIds: (pluginKey) => {
      const plugin = pluginService.findValidPlugin(pluginKey)
      if (!plugin || pluginService.getGrantedCapabilities(pluginKey) === null) {
        return null
      }
      return new Set(plugin.manifest.contributes.statusBar.map((item) => item.id))
    },
    onChanged: (snapshot) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('plugins:statusBarChanged', snapshot)
        }
      }
    }
  })
  pluginService.onChanged(() => pluginStatusBarRegistry.prune())
}
