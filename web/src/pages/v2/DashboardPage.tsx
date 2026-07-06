import React, { useEffect, useMemo, useRef } from 'react'
import { Ref } from '@/axios'
import { Table, TableBody } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useEnvironmentState } from '@/hooks/useEnvironmentState'
import { useEnvironmentFilters } from '@/hooks/useEnvironmentFilters'
import { FilterControls } from './components/FilterControls'
import { EmptyState } from './components/EmptyState'
import { EnvironmentRow } from './components/EnvironmentRow'
import { DashboardTableHeader } from './components/DashboardTableHeader'
import { ServiceRow } from './components/ServiceRow'

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

export default function DashboardPage() {
  // Data fetching and SSE subscription
  const {
    environments,
    applications,
    refBindings,
    instances,
    instancePods,
    refsHeads,
    updateRefBinding,
    loading,
    error,
    sseError,
    refetch,
  } = useDashboardData()

  // Environment expand/collapse state
  const { expandedEnvs, toggleEnvironment, expandAll, collapseAll } = useEnvironmentState(environments)

  // Filter state and logic
  const {
    selectedEnvironments,
    serviceSearchQuery,
    branchSearchQuery,
    setServiceSearchQuery,
    setBranchSearchQuery,
    toggleEnvironmentFilter,
    filteredEnvironments,
    getApplicationsForEnv,
    hasResults,
    selectedEnvNames,
  } = useEnvironmentFilters(environments, applications, refBindings)

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
        selectedEnvNames={selectedEnvNames}
        serviceSearchQuery={serviceSearchQuery}
        branchSearchQuery={branchSearchQuery}
        onServiceSearchChange={setServiceSearchQuery}
        onBranchSearchChange={setBranchSearchQuery}
        onToggleEnvironmentFilter={toggleEnvironmentFilter}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
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
        <ErrorState onRetry={refetch} />
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
