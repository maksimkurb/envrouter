import { useCallback, useMemo, useState } from 'react'
import { Application, Environment, RefBinding } from '@/axios'

const EMPTY: Application[] = []

function useToggleSet(): [Set<string>, (value: string) => void, () => void] {
  const [set, setSet] = useState<Set<string>>(new Set())
  const toggle = useCallback((value: string) => {
    setSet((current) => {
      const next = new Set(current)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }, [])
  const clear = useCallback(() => setSet(new Set()), [])
  return [set, toggle, clear]
}

export function useEnvironmentFilters(
  environments: Environment[],
  applications: Application[],
  refBindings: Map<string, RefBinding>
) {
  const [selectedEnvironments, toggleEnvironmentFilter, clearEnvironmentFilter] = useToggleSet()
  const [selectedServices, toggleServiceFilter, clearServiceFilter] = useToggleSet()
  const [branchSearchQuery, setBranchSearchQuery] = useState<string>('')

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
    const branchQuery = branchSearchQuery.toLowerCase()
    for (const env of filteredEnvironments) {
      const apps = applications.filter((app) => {
        if (selectedServices.size > 0 && !selectedServices.has(app.name)) {
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
  }, [filteredEnvironments, applications, refBindings, selectedServices, branchSearchQuery])

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

  return {
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
  }
}
