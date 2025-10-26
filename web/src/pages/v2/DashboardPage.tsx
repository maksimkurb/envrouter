import React, { useEffect } from 'react'
import { Table, TableBody } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useEnvironmentState } from '@/hooks/useEnvironmentState'
import { useEnvironmentFilters } from '@/hooks/useEnvironmentFilters'
import { FilterControls } from './components/FilterControls'
import { EmptyState } from './components/EmptyState'
import { EnvironmentRow } from './components/EnvironmentRow'
import { DashboardTableHeader } from './components/DashboardTableHeader'
import { ServiceRow } from './components/ServiceRow'

export default function DashboardPage() {
  const { toast } = useToast()

  // Data fetching and SSE subscription
  const {
    environments,
    applications,
    refBindings,
    instances,
    instancePods,
    refsHeads,
    updateRefBinding,
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
    filterApplicationsForEnv,
    hasResults,
    selectedEnvNames,
  } = useEnvironmentFilters(environments, applications, refBindings)

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

      {!hasResults ? (
        <EmptyState />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <DashboardTableHeader />
            <TableBody>
              {filteredEnvironments.map((environment) => {
                const isExpanded = expandedEnvs.has(environment.name)
                const envApplications = filterApplicationsForEnv(environment.name)

                if (envApplications.length === 0) return null

                return (
                  <React.Fragment key={environment.name}>
                    <EnvironmentRow
                      environmentName={environment.name}
                      isExpanded={isExpanded}
                      onToggle={() => toggleEnvironment(environment.name)}
                    />
                    {isExpanded &&
                      envApplications.map((application) => {
                        const refBinding = refBindings.get(`${environment.name}-${application.name}`)

                        const appInstances = Array.from(instances.values()).filter(
                          (i) => i.environment === environment.name && i.application === application.name
                        )

                        const appInstancePods = Array.from(instancePods.values()).filter(
                          (i) => i.environment === environment.name && i.application === application.name
                        )

                        const appRefsHeads = Array.from(refsHeads.values()).filter(
                          (r) => r.repository === application.repositoryName
                        )

                        return (
                          <ServiceRow
                            key={application.name}
                            application={application}
                            refBinding={refBinding}
                            instances={appInstances}
                            instancePods={appInstancePods}
                            refsHeads={appRefsHeads}
                            onRefBindingChanged={updateRefBinding}
                            toast={toast}
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
