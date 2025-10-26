import { useEffect, useState } from 'react'
import { Application, DefaultApiFp, Environment, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'
import EnvironmentCard from './components/EnvironmentCard'

const api = DefaultApiFp()

export default function DashboardPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [refBindings, setRefBindings] = useState<RefBinding[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [instancePods, setInstancePods] = useState<InstancePod[]>([])
  const [refsHeads, setRefsHeads] = useState<Ref[]>([])

  const onSSEvent = (e: SSEvent) => {
    switch (e.itemType) {
      case 'InstancePod': {
        const instancePod = e.item as InstancePod
        setInstancePods((current) => {
          const index = current.findIndex((i) => i.name === instancePod.name)
          if (e.event === 'DELETED') {
            return [...current.slice(0, index), ...current.slice(index + 1)]
          } else if (index === -1) {
            return [...current, instancePod]
          } else {
            return [...current.slice(0, index), instancePod, ...current.slice(index + 1)]
          }
        })
        break
      }
      case 'Instance': {
        const instance = e.item as Instance
        setInstances((current) => {
          const index = current.findIndex(
            (i) =>
              i.name === instance.name &&
              i.application === instance.application &&
              i.environment === instance.environment
          )
          if (e.event === 'DELETED') {
            return [...current.slice(0, index), ...current.slice(index + 1)]
          } else if (index === -1) {
            return [...current, instance]
          } else {
            return [...current.slice(0, index), instance, ...current.slice(index + 1)]
          }
        })
        break
      }
      case 'RefHead': {
        const ref = e.item as Ref
        setRefsHeads((current) => {
          const index = current.findIndex((r) => r.repository === ref.repository && r.ref === ref.ref)
          if (e.event === 'DELETED') {
            return [...current.slice(0, index), ...current.slice(index + 1)]
          } else if (index === -1) {
            return [...current, ref]
          } else {
            return [...current.slice(0, index), ref, ...current.slice(index + 1)]
          }
        })
        break
      }
    }
  }

  const updateRefBinding = (newRefBinding: RefBinding) => {
    setRefBindings((current) => {
      const index = current.findIndex(
        (r) => r.environment === newRefBinding.environment && r.application === newRefBinding.application
      )
      if (index === -1) {
        return [...current, newRefBinding]
      } else {
        return [...current.slice(0, index), newRefBinding, ...current.slice(index + 1)]
      }
    })
  }

  useEffect(() => {
    const eventSource = new EventSource(`${BASE_PATH}/api/v1/subscription`)
    eventSource.onmessage = (e) => onSSEvent(JSON.parse(e.data) as SSEvent)

    Promise.all([
      api.apiV1EnvironmentsGet().then((request) => request()),
      api.apiV1ApplicationsGet().then((request) => request()),
      api.apiV1RefBindingsGet().then((request) => request()),
      api.apiV1InstancesGet().then((request) => request()),
      api.apiV1InstancePodsGet().then((request) => request()),
      api.apiV1GitRefsGet().then((request) => request()),
    ]).then(([envs, apps, refs, instances, instancePods, refsHeads]) => {
      setRefBindings(refs.data)
      setEnvironments(envs.data.sort((a, b) => a.name.localeCompare(b.name)))
      setApplications(apps.data.sort((a, b) => a.name.localeCompare(b.name)))
      setInstances(instances.data)
      setInstancePods(instancePods.data.sort((a, b) => a.createdTime.localeCompare(b.createdTime)))
      setRefsHeads(refsHeads.data)
    })

    return () => {
      eventSource.close()
    }
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {environments.map((environment) => (
        <EnvironmentCard
          key={environment.name}
          environment={environment}
          applications={applications}
          refBindings={refBindings.filter((r) => r.environment === environment.name)}
          instances={instances.filter((i) => i.environment === environment.name)}
          instancePods={instancePods.filter((i) => i.environment === environment.name)}
          onRefBindingChanged={(refBinding) => updateRefBinding(refBinding)}
          refsHeads={refsHeads}
        />
      ))}
    </div>
  )
}
