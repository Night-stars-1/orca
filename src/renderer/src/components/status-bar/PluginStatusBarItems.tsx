import React from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { executePluginCommand } from '@/lib/plugin-command-execution'
import { translate } from '@/i18n/i18n'
import type { ActivePluginCommand } from '@/store/plugin-panels'
import {
  usePluginStatusBarItems,
  usePluginStatusBarStore,
  type ResolvedPluginStatusBarItem
} from '@/store/plugin-status-bar'
import { resolvePluginPanelIcon } from '../right-sidebar/plugin-panel-activity-items'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from './status-bar-context-menu-policy'

const PluginPanel = lazyWithRetry(() => import('../right-sidebar/PluginPanel'))

function badgeToneClass(tone: NonNullable<ResolvedPluginStatusBarItem['badge']>['tone']): string {
  switch (tone) {
    case 'success':
      return 'bg-status-success-background text-status-success'
    case 'warning':
      return 'bg-status-warning-background text-status-warning'
    case 'error':
      return 'bg-destructive/10 text-destructive'
    case 'default':
      return 'bg-secondary text-secondary-foreground'
  }
}

const TRIGGER_CLASS =
  'inline-flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground'

function runPluginCommand(command: ActivePluginCommand): void {
  void executePluginCommand(command, 'plugin-status-bar').catch((error: unknown) => {
    toast.error(
      translate(
        'auto.components.status.bar.PluginStatusBarItems.commandFailed',
        '{{value0}} failed',
        {
          value0: command.title
        }
      ),
      { description: error instanceof Error ? error.message : String(error) }
    )
  })
}

function PluginStatusBarItemContent({
  item,
  iconOnly
}: {
  item: ResolvedPluginStatusBarItem
  iconOnly: boolean
}): React.JSX.Element {
  const hasIcon = item.spinner || Boolean(item.icon)
  const showText = item.text.length > 0 && !(iconOnly && hasIcon)
  const progressValue = item.progress?.value
  return (
    <>
      {item.spinner ? (
        <LoaderCircle className="size-3 animate-spin" />
      ) : item.icon ? (
        React.createElement(resolvePluginPanelIcon(item.icon), { className: 'size-3' })
      ) : null}
      {showText ? (
        <span className="max-w-48 truncate text-[11px] font-medium">{item.text}</span>
      ) : null}
      {item.progress ? (
        <span
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressValue}
          className="relative h-1 w-12 overflow-hidden rounded-full bg-primary/20"
        >
          <span
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out',
              progressValue === undefined && 'w-full animate-pulse'
            )}
            style={progressValue === undefined ? undefined : { width: `${progressValue}%` }}
          />
        </span>
      ) : null}
      {item.badge ? (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px] leading-4 font-medium',
            badgeToneClass(item.badge.tone)
          )}
        >
          {item.badge.text}
        </span>
      ) : null}
    </>
  )
}

function PluginStatusBarItem({
  item,
  iconOnly
}: {
  item: ResolvedPluginStatusBarItem
  iconOnly: boolean
}): React.JSX.Element {
  // Why: plugin strings render untranslated by design, like panel titles.
  const label = item.tooltip ?? (item.text ? `${item.pluginName}: ${item.text}` : item.pluginName)
  const content = <PluginStatusBarItemContent item={item} iconOnly={iconOnly} />
  const tooltip = (trigger: React.ReactNode): React.JSX.Element => (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
  const button = (onClick?: () => void): React.JSX.Element => (
    <button
      type="button"
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      data-plugin-status-bar-item={item.key}
      className={cn(TRIGGER_CLASS, 'cursor-pointer')}
      aria-label={label}
      onClick={onClick}
    >
      {content}
    </button>
  )

  if (item.popoverTabKey) {
    const tabKey = item.popoverTabKey
    return (
      <Popover modal={false}>
        {tooltip(<PopoverTrigger asChild>{button()}</PopoverTrigger>)}
        <PopoverContent
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          side="top"
          align="end"
          sideOffset={8}
          className="flex h-[24rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col"
        >
          <React.Suspense fallback={null}>
            <PluginPanel tabKey={tabKey} />
          </React.Suspense>
        </PopoverContent>
      </Popover>
    )
  }
  if (item.menu.length > 0) {
    return (
      <DropdownMenu modal={false}>
        {tooltip(<DropdownMenuTrigger asChild>{button()}</DropdownMenuTrigger>)}
        <DropdownMenuContent
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          side="top"
          align="end"
          sideOffset={8}
        >
          {item.menu.map((entry) => (
            <DropdownMenuItem
              key={`${entry.command.id}:${entry.title}`}
              onSelect={() => runPluginCommand(entry.command)}
            >
              {entry.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  if (item.command) {
    const command = item.command
    return tooltip(button(() => runPluginCommand(command)))
  }
  return tooltip(
    <span
      data-plugin-status-bar-item={item.key}
      aria-label={label}
      className={TRIGGER_CLASS}
      tabIndex={0}
    >
      {content}
    </span>
  )
}

export function PluginStatusBarItems({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  const items = usePluginStatusBarItems()
  const hiddenKeys = usePluginStatusBarStore((state) => state.hiddenKeys)
  const visible = items.filter((item) => !item.hiddenByPlugin && !hiddenKeys.includes(item.key))
  if (visible.length === 0) {
    return null
  }
  return (
    <>
      {visible.map((item) => (
        <PluginStatusBarItem key={item.key} item={item} iconOnly={iconOnly} />
      ))}
    </>
  )
}

/** Per-item toggles appended to the status-bar right-click menu. */
export function PluginStatusBarVisibilityItems(): React.JSX.Element | null {
  const items = usePluginStatusBarItems()
  const hiddenKeys = usePluginStatusBarStore((state) => state.hiddenKeys)
  const toggleHidden = usePluginStatusBarStore((state) => state.toggleHidden)
  if (items.length === 0) {
    return null
  }
  return (
    <>
      <DropdownMenuSeparator />
      {items.map((item) => {
        return (
          <DropdownMenuCheckboxItem
            key={item.key}
            checked={!hiddenKeys.includes(item.key)}
            onCheckedChange={() => toggleHidden(item.key)}
          >
            {React.createElement(resolvePluginPanelIcon(item.icon), { className: 'size-3.5' })}
            {item.text ? `${item.pluginName}: ${item.text}` : item.pluginName}
          </DropdownMenuCheckboxItem>
        )
      })}
    </>
  )
}
