import { useCallback, useEffect, useState } from 'react'
import { Application, Environment, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { Snapshot, SSEvent } from '@/sse/api'
import { useSSESubscription } from './useSSESubscription'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

// All dashboard data arrives over one SSE stream: a full Snapshot on every
// (re)connect, then incremental deltas — no REST snapshot, no races.
export function useDashboardData() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [refBindings, setRefBindings] = useState<Map<string, RefBinding>>(new Map())
  const [instances, setInstances] = useState<Map<string, Instance>>(new Map())
  const [instancePods, setInstancePods] = useState<Map<string, InstancePod>>(new Map())
  const [refsHeads, setRefsHeads] = useState<Map<string, Ref>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updateRefBinding = useCallback((newRefBinding: RefBinding) => {
    const key = `${newRefBinding.environment}-${newRefBinding.application}`
    setRefBindings((current) => {
      const newMap = new Map(current)
      newMap.set(key, newRefBinding)
      return newMap
    })
  }, [])

  const onSSEvent = useCallback((e: SSEvent) => {
    switch (e.itemType) {
      case 'Snapshot': {
        const snapshot = e.item as Snapshot
        setEnvironments([...(snapshot.environments ?? [])].sort(byName))
        setApplications([...(snapshot.applications ?? [])].sort(byName))
        setRefBindings(
          new Map((snapshot.refBindings ?? []).map((r) => [`${r.environment}-${r.application}`, r]))
        )
        setInstances(
          new Map(
            (snapshot.instances ?? []).map((i) => [`${i.environment}-${i.application}-${i.name}`, i])
          )
        )
        setInstancePods(new Map((snapshot.instancePods ?? []).map((p) => [p.name, p])))
        setRefsHeads(new Map((snapshot.refsHeads ?? []).map((r) => [`${r.repository}-${r.ref}`, r])))
        setLoading(false)
        setError(null)
        break
      }
      case 'InstancePod': {
        const instancePod = e.item as InstancePod
        setInstancePods((current) => {
          const newMap = new Map(current)
          if (e.event === 'DELETED') {
            newMap.delete(instancePod.name)
          } else {
            newMap.set(instancePod.name, instancePod)
          }
          return newMap
        })
        break
      }
      case 'Instance': {
        const instance = e.item as Instance
        const key = `${instance.environment}-${instance.application}-${instance.name}`
        setInstances((current) => {
          const newMap = new Map(current)
          if (e.event === 'DELETED') {
            newMap.delete(key)
          } else {
            newMap.set(key, instance)
          }
          return newMap
        })
        break
      }
      case 'RefHead': {
        const ref = e.item as Ref
        const key = `${ref.repository}-${ref.ref}`
        setRefsHeads((current) => {
          const newMap = new Map(current)
          if (e.event === 'DELETED') {
            newMap.delete(key)
          } else {
            newMap.set(key, ref)
          }
          return newMap
        })
        break
      }
      case 'RefBinding': {
        const binding = e.item as RefBinding
        const key = `${binding.environment}-${binding.application}`
        setRefBindings((current) => {
          const newMap = new Map(current)
          if (e.event === 'DELETED') {
            newMap.delete(key)
          } else {
            newMap.set(key, binding)
          }
          return newMap
        })
        break
      }
    }
  }, [])

  const { error: sseError, reconnect } = useSSESubscription(onSSEvent)

  // stream down while we still have nothing to show -> full error panel
  // (post-load drops surface as the reconnecting banner instead)
  useEffect(() => {
    if (sseError && loading) {
      setError('Failed to connect to EnvRouter')
    }
  }, [sseError, loading])

  return {
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
    reconnect,
  }
}
