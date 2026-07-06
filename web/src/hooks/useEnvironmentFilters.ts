import { useCallback, useMemo, useState } from 'react'
import { Application, Environment, RefBinding } from '@/axios'

const EMPTY: Application[] = []

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

  // One pass per data/filter change; render reads the map instead of
  // re-filtering per environment per render.
  const applicationsByEnv = useMemo(() => {
    const result = new Map<string, Application[]>()
    const serviceQuery = serviceSearchQuery.toLowerCase()
    const branchQuery = branchSearchQuery.toLowerCase()
    for (const env of filteredEnvironments) {
      const apps = applications.filter((app) => {
        if (serviceQuery && !app.name.toLowerCase().includes(serviceQuery)) {
          return false
        }
        if (branchQuery) {
          const refBinding = refBindings.get(`${env.name}-${app.name}`)
          if (!refBinding?.ref?.toLowerCase().includes(branchQuery)) {
            return false
          }
        }
        return true
      })
      result.set(env.name, apps)
    }
    return result
  }, [filteredEnvironments, applications, refBindings, serviceSearchQuery, branchSearchQuery])

  const getApplicationsForEnv = useCallback(
    (envName: string) => applicationsByEnv.get(envName) ?? EMPTY,
    [applicationsByEnv]
  )

  const hasResults = useMemo(() => {
    for (const apps of applicationsByEnv.values()) {
      if (apps.length > 0) return true
    }
    return false
  }, [applicationsByEnv])

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
    getApplicationsForEnv,
    hasResults,
    selectedEnvNames,
  }
}
