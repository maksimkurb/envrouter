import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [defaultRef, setDefaultRef] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // delta events are buffered and flushed once per animation frame so a burst
  // of deltas rebuilds each Map at most once per frame instead of once per event
  const pendingRef = useRef<SSEvent[]>([])
  const rafRef = useRef<number | null>(null)

  const updateRefBinding = useCallback((newRefBinding: RefBinding) => {
    const key = `${newRefBinding.environment}-${newRefBinding.application}`
    setRefBindings((current) => {
      const newMap = new Map(current)
      newMap.set(key, newRefBinding)
      return newMap
    })
  }, [])

  const flush = useCallback(() => {
    rafRef.current = null
    const events = pendingRef.current
    if (events.length === 0) return
    pendingRef.current = []
    const has = (t: SSEvent['itemType']) => events.some((e) => e.itemType === t)

    if (has('InstancePod')) {
      setInstancePods((current) => {
        const next = new Map(current)
        for (const e of events) {
          if (e.itemType !== 'InstancePod') continue
          const pod = e.item as InstancePod
          if (e.event === 'DELETED') next.delete(pod.name)
          else next.set(pod.name, pod)
        }
        return next
      })
    }
    if (has('Instance')) {
      setInstances((current) => {
        const next = new Map(current)
        for (const e of events) {
          if (e.itemType !== 'Instance') continue
          const i = e.item as Instance
          const key = `${i.environment}-${i.application}-${i.name}`
          if (e.event === 'DELETED') next.delete(key)
          else next.set(key, i)
        }
        return next
      })
    }
    if (has('RefHead')) {
      setRefsHeads((current) => {
        const next = new Map(current)
        for (const e of events) {
          if (e.itemType !== 'RefHead') continue
          const r = e.item as Ref
          const key = `${r.repository}-${r.ref}`
          if (e.event === 'DELETED') next.delete(key)
          else next.set(key, r)
        }
        return next
      })
    }
    if (has('RefBinding')) {
      setRefBindings((current) => {
        const next = new Map(current)
        for (const e of events) {
          if (e.itemType !== 'RefBinding') continue
          const b = e.item as RefBinding
          const key = `${b.environment}-${b.application}`
          if (e.event === 'DELETED') next.delete(key)
          else next.set(key, b)
        }
        return next
      })
    }
  }, [])

  const onSSEvent = useCallback(
    (e: SSEvent) => {
      switch (e.itemType) {
        case 'Snapshot': {
          // snapshot is a full resync — apply immediately and drop any buffered deltas
          pendingRef.current = []
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
          }
          const snapshot = e.item as Snapshot
          setEnvironments([...(snapshot.environments ?? [])].sort(byName))
          setApplications([...(snapshot.applications ?? [])].sort(byName))
          setRefBindings(
            new Map(
              (snapshot.refBindings ?? []).map((r) => [`${r.environment}-${r.application}`, r])
            )
          )
          setInstances(
            new Map(
              (snapshot.instances ?? []).map((i) => [
                `${i.environment}-${i.application}-${i.name}`,
                i,
              ])
            )
          )
          setInstancePods(new Map((snapshot.instancePods ?? []).map((p) => [p.name, p])))
          setRefsHeads(
            new Map((snapshot.refsHeads ?? []).map((r) => [`${r.repository}-${r.ref}`, r]))
          )
          setDefaultRef(snapshot.defaultRef ?? '')
          setLoading(false)
          setError(null)
          break
        }
        case 'InstancePod':
        case 'Instance':
        case 'RefHead':
        case 'RefBinding': {
          pendingRef.current.push(e)
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush)
          break
        }
      }
    },
    [flush]
  )

  const { error: sseError, reconnect } = useSSESubscription(onSSEvent)

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

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
    defaultRef,
    updateRefBinding,
    loading,
    error,
    sseError,
    reconnect,
  }
}
