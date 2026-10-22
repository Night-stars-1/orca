import { z, type RefinementCtx } from 'zod'
import { pluginCommandIdSchema, pluginIdSchema } from './plugin-manifest-fields'

/**
 * Status-bar contributions: declarative items the host renders with its own
 * primitives. Plugins never get DOM in the bar; rich UI goes in a popover that
 * reuses a declared panel (same sandboxed frame as the sidebar).
 */

export const PLUGIN_STATUS_BAR_ITEM_LIMIT = 16
export const PLUGIN_STATUS_BAR_MENU_LIMIT = 16
export const PLUGIN_STATUS_BAR_TEXT_MAX_LENGTH = 128
export const PLUGIN_STATUS_BAR_TOOLTIP_MAX_LENGTH = 512
export const PLUGIN_STATUS_BAR_BADGE_TONES = ['default', 'success', 'warning', 'error'] as const

const textSchema = z.string().max(PLUGIN_STATUS_BAR_TEXT_MAX_LENGTH)
const iconSchema = z.string().min(1).max(64)
const tooltipSchema = z.string().max(PLUGIN_STATUS_BAR_TOOLTIP_MAX_LENGTH)

export const pluginStatusBarItemContributionSchema = z.object({
  id: pluginIdSchema,
  text: textSchema.default(''),
  /** Lucide icon name from the same curated set as panels. */
  icon: iconSchema.optional(),
  tooltip: tooltipSchema.optional(),
  /** Higher sorts further left among plugin items. */
  priority: z.number().int().min(-1000).max(1000).default(0),
  /** Contributed command run on click. */
  command: pluginCommandIdSchema.optional(),
  /** Contributed panel id shown in a popover on click (wins over `command`). */
  popover: pluginIdSchema.optional()
})

export type PluginStatusBarItemContribution = z.infer<typeof pluginStatusBarItemContributionSchema>

const badgeSchema = z
  .object({
    text: z.string().min(1).max(16),
    tone: z.enum(PLUGIN_STATUS_BAR_BADGE_TONES).default('default')
  })
  .strict()

const menuItemSchema = z
  .object({
    title: z.string().min(1).max(PLUGIN_STATUS_BAR_TEXT_MAX_LENGTH),
    command: pluginCommandIdSchema
  })
  .strict()

/** `statusBar.update` params. Omitted fields keep their value; null clears. */
export const pluginStatusBarUpdateParamsSchema = z
  .object({
    id: pluginIdSchema,
    text: textSchema.optional(),
    icon: iconSchema.nullable().optional(),
    tooltip: tooltipSchema.nullable().optional(),
    /** `value` 0–100; omit `value` for an indeterminate bar. */
    progress: z
      .object({ value: z.number().min(0).max(100).optional() })
      .strict()
      .nullable()
      .optional(),
    spinner: z.boolean().optional(),
    badge: badgeSchema.nullable().optional(),
    menu: z.array(menuItemSchema).max(PLUGIN_STATUS_BAR_MENU_LIMIT).nullable().optional(),
    hidden: z.boolean().optional()
  })
  .strict()

export type PluginStatusBarUpdate = z.infer<typeof pluginStatusBarUpdateParamsSchema>

/** Runtime overrides layered over the manifest item; absent key = manifest value. */
export type PluginStatusBarItemState = {
  text?: string
  icon?: string | null
  tooltip?: string | null
  progress?: { value?: number } | null
  spinner?: boolean
  badge?: { text: string; tone: (typeof PLUGIN_STATUS_BAR_BADGE_TONES)[number] } | null
  menu?: { title: string; command: string }[] | null
  hidden?: boolean
}

export type PluginStatusBarSnapshot = {
  pluginKey: string
  items: Record<string, PluginStatusBarItemState>
}

export function mergePluginStatusBarUpdate(
  current: PluginStatusBarItemState | undefined,
  update: PluginStatusBarUpdate
): PluginStatusBarItemState {
  const { id: _id, ...patch } = update
  // Why: readers treat an undefined field as "use the manifest value", so a
  // present-but-undefined key is equivalent to omitting it.
  return { ...current, ...patch }
}

type StatusBarValidationManifest = {
  contributes: {
    panels: { id: string }[]
    commands: { id: string }[]
    statusBar: { id: string; command?: string; popover?: string }[]
  }
}

export function validatePluginStatusBarContributions(
  manifest: StatusBarValidationManifest,
  ctx: RefinementCtx
): void {
  const commandIds = new Set(manifest.contributes.commands.map((command) => command.id))
  const panelIds = new Set(manifest.contributes.panels.map((panel) => panel.id))
  const seen = new Set<string>()
  for (const [index, item] of manifest.contributes.statusBar.entries()) {
    const path = ['contributes', 'statusBar', index]
    if (seen.has(item.id)) {
      ctx.addIssue({ code: 'custom', path, message: `duplicate statusBar id: ${item.id}` })
    }
    seen.add(item.id)
    if (item.command !== undefined && !commandIds.has(item.command)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'command'],
        message: `unknown contributed command: ${item.command}`
      })
    }
    if (item.popover !== undefined && !panelIds.has(item.popover)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'popover'],
        message: `unknown contributed panel: ${item.popover}`
      })
    }
  }
}
