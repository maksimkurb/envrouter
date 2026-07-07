import { useCallback, useMemo, useState } from 'react'
import { Application, Environment, RefBinding } from '@/axios'

const EMPTY: Application[] = []

// localStorage keys for persisted dashboard filters (survive reload).
const ENVS_KEY = 'envrouter_filter_envs'
const SERVICES_KEY = 'envrouter_filter_services'
const BRANCH_KEY = 'envrouter_filter_branch'

function loadSet(key: string): Set<string> {
  try {
    const saved = localStorage.getItem(key)
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch {
    return new Set()
  }
}

// A toggle-able set of strings, persisted to localStorage under `storageKey`
// (same pattern as useEnvironmentState).
function useToggleSet(storageKey: string): [Set<string>, (value: string) => void, () => void] {
  const [set, setSet] = useState<Set<string>>(() => loadSet(storageKey))
  const toggle = useCallback((value: string) => {
    setSet((current) => {
      const next = new Set(current)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)))
      return next
    })
  }, [storageKey])
  const clear = useCallback(() => {
    setSet(new Set())
    localStorage.setItem(storageKey, JSON.stringify([]))
  }, [storageKey])
  return [set, toggle, clear]
}

export function useEnvironmentFilters(
  environments: Environment[],
  applications: Application[],
  refBindings: Map<string, RefBinding>
) {
  const [selectedEnvironments, toggleEnvironmentFilter, clearEnvironmentFilter] = useToggleSet(ENVS_KEY)
  const [selectedServices, toggleServiceFilter, clearServiceFilter] = useToggleSet(SERVICES_KEY)
  const [branchSearchQuery, setBranchSearchQueryState] = useState<string>(
    () => localStorage.getItem(BRANCH_KEY) ?? ''
  )
  const setBranchSearchQuery = useCallback((value: string) => {
    setBranchSearchQueryState(value)
    localStorage.setItem(BRANCH_KEY, value)
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
