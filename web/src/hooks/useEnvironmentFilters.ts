import { useCallback, useMemo, useState } from 'react'
import { Application, Environment, RefBinding } from '@/axios'

export function useEnvironmentFilters(
  environments: Environment[],
  applications: Application[],
  refBindings: Map<string, RefBinding>
) {
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set())
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('')
  const [branchSearchQuery, setBranchSearchQuery] = useState<string>('')

  const toggleEnvironmentFilter = useCallback((envName: string) => {
    setSelectedEnvironments((current) => {
      const newSet = new Set(current)
      if (newSet.has(envName)) {
        newSet.delete(envName)
      } else {
        newSet.add(envName)
      }
      return newSet
    })
  }, [])

  const filteredEnvironments = useMemo(() => {
    return environments.filter((env) => {
      if (selectedEnvironments.size > 0 && !selectedEnvironments.has(env.name)) return false
      return true
    })
  }, [environments, selectedEnvironments])

  const filterApplicationsForEnv = useCallback(
    (envName: string) => {
      return applications.filter((app) => {
        const refBinding = refBindings.get(`${envName}-${app.name}`)

        if (serviceSearchQuery && !app.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())) {
          return false
        }

        if (branchSearchQuery && !refBinding?.ref?.toLowerCase().includes(branchSearchQuery.toLowerCase())) {
          return false
        }

        return true
      })
    },
    [applications, refBindings, serviceSearchQuery, branchSearchQuery]
  )

  const hasResults = useMemo(() => {
    return filteredEnvironments.some((environment) => {
      return filterApplicationsForEnv(environment.name).length > 0
    })
  }, [filteredEnvironments, filterApplicationsForEnv])

  const selectedEnvNames = useMemo(() => {
    return Array.from(selectedEnvironments).sort().join(', ')
  }, [selectedEnvironments])

  return {
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
  }
}
