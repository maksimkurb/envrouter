import { useCallback, useState } from 'react'
import { Environment } from '@/axios'

export function useEnvironmentState(environments: Environment[]) {
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('envrouter_envs_state')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggleEnvironment = useCallback((envName: string) => {
    setExpandedEnvs((current) => {
      const newSet = new Set(current)
      if (newSet.has(envName)) {
        newSet.delete(envName)
      } else {
        newSet.add(envName)
      }
      localStorage.setItem('envrouter_envs_state', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedEnvs(new Set())
    localStorage.setItem('envrouter_envs_state', JSON.stringify([]))
  }, [])

  const expandAll = useCallback(() => {
    const allEnvNames = new Set(environments.map((env) => env.name))
    setExpandedEnvs(allEnvNames)
    localStorage.setItem('envrouter_envs_state', JSON.stringify(Array.from(allEnvNames)))
  }, [environments])

  return {
    expandedEnvs,
    toggleEnvironment,
    collapseAll,
    expandAll,
  }
}
