import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast as sonnerToast } from 'sonner'
import { Eye, MoveRight } from 'lucide-react'
import { Ref } from '@/axios'
import { RefBindingUpdate } from '@/sse/api'
import { Table, TableBody } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { gravatarUrl } from '@/lib/gravatar'
import { copyToClipboard } from '@/lib/clipboard'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useAuthContext } from '@/hooks/useAuth'
import { useEnvironmentState } from '@/hooks/useEnvironmentState'
import { useEnvironmentFilters } from '@/hooks/useEnvironmentFilters'
import { FilterControls } from './components/FilterControls'
import { EmptyState } from './components/EmptyState'
import { EnvironmentRow } from './components/EnvironmentRow'
import { DashboardTableHeader } from './components/DashboardTableHeader'
import { ServiceRow } from './components/ServiceRow'
import { UserAvatar } from './components/UserCell'

const envAppKey = (item: { environment: string; application: string }) =>
  `${item.environment}-${item.application}`
const repoKey = (ref: Ref) => ref.repository ?? ''

const EMPTY: never[] = []

// Groups map values by key in one O(N) pass, reusing the previous array
// instance when its contents are unchanged so memoized rows skip re-render.
function useStableGrouping<T>(map: Map<string, T>, keyFn: (item: T) => string): Map<string, T[]> {
  const cacheRef = useRef(new Map<string, T[]>())
  return useMemo(() => {
    const grouped = new Map<string, T[]>()
    for (const item of map.values()) {
      const key = keyFn(item)
      const arr = grouped.get(key)
      if (arr) {
        arr.push(item)
      } else {
        grouped.set(key, [item])
      }
    }
    const cache = cacheRef.current
    const result = new Map<string, T[]>()
    for (const [key, arr] of grouped) {
      const prev = cache.get(key)
      if (prev && prev.length === arr.length && prev.every((v, i) => v === arr[i])) {
        result.set(key, prev)
      } else {
        result.set(key, arr)
      }
    }
    cacheRef.current = result
    return result
  }, [map, keyFn])
}

function LoadingSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3" role="status" aria-label="Loading dashboard">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border border-destructive/50 rounded-lg p-12 flex flex-col items-center justify-center gap-4"
    >
      <div className="text-center">
        <p className="text-lg font-medium">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground">
          Check that the EnvRouter API is reachable and try again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

const NOTIFY_STORAGE_KEY = 'envrouter_notify_view'

// "Information_Bell" from https://github.com/akx/Notifications (CC0), see
// public/sounds/README.txt. play() may reject under autoplay policies if the
// user hasn't interacted with the page yet — silence is an acceptable fallback.
const notifySound = new Audio('/sounds/Information_Bell.ogg')
notifySound.preload = 'auto'

// once per page load, not per Dashboard mount
let soundHintShown = false

export default function DashboardPage() {
  // filled in below, once auth and filter state exist — the SSE hook only
  // needs a stable function identity
  const remoteUpdateRef = useRef<(binding: RefBindingUpdate) => void>(() => {})
  const onRefBindingUpdate = useCallback(
    (binding: RefBindingUpdate) => remoteUpdateRef.current(binding),
    []
  )

  // Data fetching and SSE subscription
  const {
    environments,
    applications,
    refBindings,
    instances,
    instancePods,
    refsHeads,
    lastSwitches,
    defaultRef,
    updateRefBinding,
    loading,
    error,
    sseError,
    reconnect,
  } = useDashboardData(onRefBindingUpdate)
  const auth = useAuthContext()
  const canDeploy = auth?.canDeploy !== false

  // rows recently switched by someone else — carry the green blink class
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const [notifyView, setNotifyView] = useState(
    () => localStorage.getItem(NOTIFY_STORAGE_KEY) === 'on'
  )

  const toggleNotifyView = () => {
    if (notifyView) {
      setNotifyView(false)
      localStorage.setItem(NOTIFY_STORAGE_KEY, 'off')
      return
    }
    const enable = () => {
      setNotifyView(true)
      localStorage.setItem(NOTIFY_STORAGE_KEY, 'on')
      sonnerToast('Watching for changes', {
        description:
          'You’ll get a notification when someone switches a branch in the currently visible rows. Use the filters above to choose what you watch.',
        icon: <Eye className="h-4 w-4" aria-hidden="true" />,
      })
    }
    if (!('Notification' in window)) {
      sonnerToast.error('This browser does not support notifications')
      return
    }
    if (Notification.permission === 'granted') {
      enable()
      return
    }
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') enable()
      else sonnerToast.error('Notifications are blocked by the browser')
    })
  }

  // Environment expand/collapse state
  const { expandedEnvs, toggleEnvironment, expandAll, collapseAll } = useEnvironmentState(environments)

  // Filter state and logic
  const {
    selectedEnvironments,
    selectedServices,
    branchSearchQuery,
    setBranchSearchQuery,
    toggleEnvironmentFilter,
    toggleServiceFilter,
    clearEnvironmentFilter,
    clearServiceFilter,
    filteredEnvironments,
    getApplicationsForEnv,
    hasResults,
  } = useEnvironmentFilters(environments, applications, refBindings)

  // Until the user interacts with the page, autoplay policies block the
  // notification sound — tell them so with a persistent toast that the first
  // click/keypress (which is also what unlocks audio) dismisses. Shown at
  // most once per page load (route changes remount this page; F5 resets it).
  useEffect(() => {
    if (soundHintShown || localStorage.getItem(NOTIFY_STORAGE_KEY) !== 'on') return
    let id: string | number | undefined
    // our effect runs before <Toaster>'s subscription in the same commit —
    // a toast fired synchronously here would be dropped, so defer a tick.
    // The flag is set inside the callback so StrictMode's throwaway first
    // mount (which clears the timer in cleanup) doesn't burn the one showing.
    const timer = setTimeout(() => {
      soundHintShown = true
      id = sonnerToast('Click anywhere to enable notification sounds', {
        duration: Infinity,
      })
    }, 0)
    const dismiss = () => {
      clearTimeout(timer)
      if (id !== undefined) sonnerToast.dismiss(id)
    }
    window.addEventListener('pointerdown', dismiss, { once: true })
    window.addEventListener('keydown', dismiss, { once: true })
    return () => {
      dismiss()
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [])

  // Reacts to branch switches made by OTHER users: toast + row blink always,
  // browser notification when the eye toggle is on and the row matches the
  // current filters. Assigned every render so it closes over fresh state.
  remoteUpdateRef.current = (binding) => {
    const who = binding.updatedBy
    // ponytail: with auth disabled everyone is anonymous — can't tell "someone
    // else" apart, so stay silent
    if (!who?.userIdentifier || who.userIdentifier === (auth?.userIdentifier ?? '')) return

    const key = `${binding.environment}-${binding.application}`
    setHighlighted((current) => new Set(current).add(key))
    setTimeout(() => {
      setHighlighted((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }, 1700) // slightly past the 2×0.8s blink so the class outlives the animation

    const name = who.fullName || who.userIdentifier
    // Custom layout instead of sonner's icon/description slots: those pin the
    // avatar to the vertical center of a tall wrapped description. items-start
    // keeps it beside the title, and refs stack old→new like the history table.
    sonnerToast(
      <div className="flex w-full items-start gap-2.5">
        <UserAvatar name={name} email={who.email} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div>
            <span className="font-medium">{name}</span> switched {binding.application} @{' '}
            {binding.environment}
          </div>
          {/* stacked old→new like the history table; click a ref to copy it */}
          <div className="mt-1 min-w-0 font-mono text-xs leading-tight">
            <button
              type="button"
              onClick={() => copyToClipboard(binding.oldRef ?? '')}
              disabled={!binding.oldRef}
              title={binding.oldRef ? `Copy ${binding.oldRef}` : undefined}
              className="block w-full cursor-pointer truncate text-left text-muted-foreground/60 hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/60"
            >
              {binding.oldRef || '—'}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(binding.ref)}
              title={`Copy ${binding.ref}`}
              className="flex w-full min-w-0 cursor-pointer items-center gap-1 text-left hover:text-foreground"
            >
              <MoveRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{binding.ref}</span>
            </button>
          </div>
        </div>
      </div>,
      {
        duration: 60_000,
        closeButton: true,
      }
    )

    const matchesView =
      (selectedEnvironments.size === 0 || selectedEnvironments.has(binding.environment)) &&
      (selectedServices.size === 0 || selectedServices.has(binding.application)) &&
      (!branchSearchQuery ||
        binding.ref.toLowerCase().includes(branchSearchQuery.toLowerCase()))
    if (notifyView && matchesView && 'Notification' in window && Notification.permission === 'granted') {
      // 'mp' fallback: a browser notification can't fall back to initials
      gravatarUrl(who.email, 128, 'mp').then((icon) => {
        new Notification(`${name} switched ${binding.application} @ ${binding.environment}`, {
          body: `${binding.oldRef || '—'} → ${binding.ref}`,
          icon,
        })
        notifySound.currentTime = 0
        notifySound.play().catch(() => {})
      })
    }
  }

  // One O(N) grouping pass per data change instead of per-row filtering
  const instancesByEnvApp = useStableGrouping(instances, envAppKey)
  const podsByEnvApp = useStableGrouping(instancePods, envAppKey)
  const refsByRepo = useStableGrouping(refsHeads, repoKey)

  // Auto-expand all environments on initial load if no saved state
  useEffect(() => {
    if (environments.length > 0) {
      const saved = localStorage.getItem('envrouter_envs_state')
      if (!saved) {
        expandAll()
      }
    }
  }, [environments.length, expandAll])

  return (
    <div className="space-y-4">
      <FilterControls
        environments={environments}
        applications={applications}
        selectedEnvironments={selectedEnvironments}
        selectedServices={selectedServices}
        branchSearchQuery={branchSearchQuery}
        onBranchSearchChange={setBranchSearchQuery}
        onToggleEnvironmentFilter={toggleEnvironmentFilter}
        onToggleServiceFilter={toggleServiceFilter}
        onClearEnvironmentFilter={clearEnvironmentFilter}
        onClearServiceFilter={clearServiceFilter}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        notifyEnabled={notifyView}
        onToggleNotify={toggleNotifyView}
      />

      {sseError && !loading && !error && (
        <div
          role="status"
          className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm"
        >
          Connection lost — reconnecting… Data may be out of date.
        </div>
      )}

      {error ? (
        <ErrorState onRetry={reconnect} />
      ) : loading ? (
        <LoadingSkeleton />
      ) : !hasResults ? (
        <EmptyState />
      ) : (
        <div className="border rounded-lg">
          <Table className="table-fixed">
            <DashboardTableHeader />
            <TableBody>
              {filteredEnvironments.map((environment) => {
                const isExpanded = expandedEnvs.has(environment.name)
                const envApplications = getApplicationsForEnv(environment.name)

                if (envApplications.length === 0) return null

                return (
                  <React.Fragment key={environment.name}>
                    <EnvironmentRow
                      environmentName={environment.name}
                      isExpanded={isExpanded}
                      onToggle={toggleEnvironment}
                    />
                    {isExpanded &&
                      envApplications.map((application) => {
                        const key = `${environment.name}-${application.name}`
                        return (
                          <ServiceRow
                            key={application.name}
                            environmentName={environment.name}
                            application={application}
                            refBinding={refBindings.get(key)}
                            instances={instancesByEnvApp.get(key) ?? EMPTY}
                            instancePods={podsByEnvApp.get(key) ?? EMPTY}
                            refsHeads={refsByRepo.get(application.repositoryName ?? '') ?? EMPTY}
                            defaultRef={defaultRef}
                            canDeploy={canDeploy}
                            highlight={highlighted.has(key)}
                            lastSwitch={lastSwitches.get(key)}
                            onRefBindingChanged={updateRefBinding}
                          />
                        )
                      })}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
