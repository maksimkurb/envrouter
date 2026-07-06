import { useCallback, useEffect, useRef, useState } from 'react'
import { Application, DefaultApiFp, Environment, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { SSEvent } from '@/sse/api'
import { useSSESubscription } from './useSSESubscription'

const api = DefaultApiFp()

export function useDashboardData() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [refBindings, setRefBindings] = useState<Map<string, RefBinding>>(new Map())
  const [instances, setInstances] = useState<Map<string, Instance>>(new Map())
  const [instancePods, setInstancePods] = useState<Map<string, InstancePod>>(new Map())
  const [refsHeads, setRefsHeads] = useState<Map<string, Ref>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // guards against an older snapshot response overwriting a newer one
  const fetchSeq = useRef(0)

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

  const fetchData = useCallback(() => {
    const seq = ++fetchSeq.current
    setError(null)
    Promise.all([
      api.apiV1EnvironmentsGet().then((request) => request()),
      api.apiV1ApplicationsGet().then((request) => request()),
      api.apiV1RefBindingsGet().then((request) => request()),
      api.apiV1InstancesGet().then((request) => request()),
      api.apiV1InstancePodsGet().then((request) => request()),
      api.apiV1GitRefsGet().then((request) => request()),
    ])
      .then(([envs, apps, refs, instances, instancePods, refsHeads]) => {
        if (seq !== fetchSeq.current) return
        const refBindingsMap = new Map(
          refs.data.map((r) => [`${r.environment}-${r.application}`, r])
        )
        const instancesMap = new Map(
          instances.data.map((i) => [`${i.environment}-${i.application}-${i.name}`, i])
        )
        const instancePodsMap = new Map(
          instancePods.data.map((p) => [p.name, p])
        )
        const refsHeadsMap = new Map(
          refsHeads.data.map((r) => [`${r.repository}-${r.ref}`, r])
        )

        setRefBindings(refBindingsMap)
        setEnvironments(envs.data.sort((a, b) => a.name.localeCompare(b.name)))
        setApplications(apps.data.sort((a, b) => a.name.localeCompare(b.name)))
        setInstances(instancesMap)
        setInstancePods(instancePodsMap)
        setRefsHeads(refsHeadsMap)
        setLoading(false)
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return
        console.error('Failed to load dashboard data:', err)
        setLoading(false)
        setError('Failed to load dashboard data')
      })
  }, [])

  // The server replays a full state snapshot into every new SSE
  // subscription, so between fetchData() and that replay any wholesale
  // replacement here converges to current state.
  const { error: sseError } = useSSESubscription(onSSEvent, fetchData)

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    refetch: fetchData,
  }
}
