import { useEffect, useState } from 'react'
import { Application, DefaultApiFp, Environment, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { SSEvent } from '@/sse/api'
import { BASE_PATH } from '@/axios/base'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown, Search, Loader2, ListChevronsUpDown, ListChevronsDownUp, CircleSlash } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import InstanceBadge from './components/InstanceBadge'

const api = DefaultApiFp()

export default function DashboardPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [refBindings, setRefBindings] = useState<RefBinding[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [instancePods, setInstancePods] = useState<InstancePod[]>([])
  const [refsHeads, setRefsHeads] = useState<Ref[]>([])
  const [selectedEnvironments, setSelectedEnvironments] = useState<Set<string>>(new Set())
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('')
  const [branchSearchQuery, setBranchSearchQuery] = useState<string>('')
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('envrouter_envs_state')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const { toast } = useToast()

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

  const toggleEnvironment = (envName: string) => {
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
  }

  const collapseAll = () => {
    setExpandedEnvs(new Set())
    localStorage.setItem('envrouter_envs_state', JSON.stringify([]))
  }

  const expandAll = () => {
    const allEnvNames = new Set(environments.map((env) => env.name))
    setExpandedEnvs(allEnvNames)
    localStorage.setItem('envrouter_envs_state', JSON.stringify(Array.from(allEnvNames)))
  }

  const toggleEnvironmentFilter = (envName: string) => {
    setSelectedEnvironments((current) => {
      const newSet = new Set(current)
      if (newSet.has(envName)) {
        newSet.delete(envName)
      } else {
        newSet.add(envName)
      }
      return newSet
    })
  }

  const filteredEnvironments = environments.filter((env) => {
    if (selectedEnvironments.size > 0 && !selectedEnvironments.has(env.name)) return false
    return true
  })

  const selectedEnvNames = Array.from(selectedEnvironments).sort().join(', ')

  // Check if there are any matching results
  const hasResults = filteredEnvironments.some((environment) => {
    const envApplications = applications.filter((app) => {
      const refBinding = refBindings.find(
        (r) => r.environment === environment.name && r.application === app.name
      )

      if (serviceSearchQuery && !app.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())) {
        return false
      }

      if (branchSearchQuery && !refBinding?.ref?.toLowerCase().includes(branchSearchQuery.toLowerCase())) {
        return false
      }

      return true
    })

    return envApplications.length > 0
  })

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
      const sortedEnvs = envs.data.sort((a, b) => a.name.localeCompare(b.name))
      setEnvironments(sortedEnvs)
      setApplications(apps.data.sort((a, b) => a.name.localeCompare(b.name)))
      setInstances(instances.data)
      setInstancePods(instancePods.data.sort((a, b) => a.createdTime.localeCompare(b.createdTime)))
      setRefsHeads(refsHeads.data)
      // Only expand all if no saved state exists
      const saved = localStorage.getItem('envrouter_envs_state')
      if (!saved) {
        const allEnvNames = new Set(sortedEnvs.map((env) => env.name))
        setExpandedEnvs(allEnvNames)
        localStorage.setItem('envrouter_envs_state', JSON.stringify(Array.from(allEnvNames)))
      }
    })

    return () => {
      eventSource.close()
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Service filter"
              value={serviceSearchQuery}
              onChange={(e) => setServiceSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Branch filter"
              value={branchSearchQuery}
              onChange={(e) => setBranchSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-48 max-w-md justify-start">
                <span className="truncate">
                  {selectedEnvironments.size === 0 ? 'All environments' : selectedEnvNames}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Environment filter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {environments.map((env) => (
                <DropdownMenuCheckboxItem
                  key={env.name}
                  checked={selectedEnvironments.has(env.name)}
                  onCheckedChange={() => toggleEnvironmentFilter(env.name)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {env.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} title="Expand All">
            <ListChevronsUpDown />
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} title="Collapse All">
            <ListChevronsDownUp />
          </Button>
        </div>
      </div>

      {/* Table */}
      {!hasResults ? (
        <div className="border rounded-lg p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <CircleSlash className="h-16 w-16" />
          <div className="text-center">
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try adjusting your filters to find what you're looking for</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Target Branch</TableHead>
                <TableHead>Pods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {filteredEnvironments.map((environment) => {
              const isExpanded = expandedEnvs.has(environment.name)
              const envApplications = applications.filter((app) => {
                const refBinding = refBindings.find(
                  (r) => r.environment === environment.name && r.application === app.name
                )

                // Filter by service name
                if (serviceSearchQuery && !app.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())) {
                  return false
                }

                // Filter by branch name
                if (branchSearchQuery && !refBinding?.ref?.toLowerCase().includes(branchSearchQuery.toLowerCase())) {
                  return false
                }

                return true
              })

              if (envApplications.length === 0) return null

              return (
                <>
                  <TableRow
                    key={environment.name}
                    className="font-medium bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => toggleEnvironment(environment.name)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell colSpan={3}>{environment.name}</TableCell>
                  </TableRow>
                  {isExpanded &&
                    envApplications.map((application) => {
                      const refBinding = refBindings.find(
                        (r) => r.environment === environment.name && r.application === application.name
                      )
                      const appInstances = instances.filter(
                        (i) => i.environment === environment.name && i.application === application.name
                      )
                      const appInstancePods = instancePods.filter(
                        (i) => i.environment === environment.name && i.application === application.name
                      )
                      const appRefsHeads = refsHeads.filter((r) => r.repository === application.repositoryName)

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
                </>
              )
            })}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  )
}

interface ServiceRowProps {
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  refsHeads: Ref[]
  onRefBindingChanged: (refBinding: RefBinding) => void
  toast: ReturnType<typeof useToast>['toast']
}

function ServiceRow({
  application,
  refBinding,
  instances,
  instancePods,
  refsHeads,
  onRefBindingChanged,
  toast,
}: ServiceRowProps) {
  const [ref, setRef] = useState(refBinding?.ref || '')

  useEffect(() => {
    setRef(refBinding?.ref || '')
  }, [refBinding?.ref])

  const onRefChanged = (newRef: string) => {
    if (refBinding && refBinding.ref !== newRef) {
      const newRefBinding = { ...refBinding, ref: newRef } as RefBinding
      api
        .apiV1RefBindingsPost(newRefBinding)
        .then((request) => request())
        .then((response) => {
          onRefBindingChanged(response.data)
          toast({
            title: 'Deployment initiated',
            description: `Ref ${newRef} has been deployed to ${refBinding.environment} environment`,
          })
        })
        .catch(() => {
          toast({
            title: 'Deployment failed',
            description: `Ref ${newRef} could not be deployed to ${refBinding.environment} environment`,
            variant: 'destructive',
          })
        })
    }
  }

  const targetCommit = refsHeads.find((r) => r.ref === refBinding?.ref)?.commit
  const deploying = targetCommit?.sha && !instancePods.every((pod) => pod.commitSha === targetCommit.sha)
  const refExists = refsHeads.some((r) => r.ref === ref)

  return (
    <TableRow>
      <TableCell></TableCell>
      <TableCell>
        <small className="text-sm text-muted-foreground">{application.name}</small>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="relative max-w-xs">
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              onBlur={(e) => onRefChanged(e.target.value)}
              className={`h-8 text-sm ${!refExists && ref ? 'border-destructive' : ''}`}
            />
            {deploying && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {!refExists && ref && (
            <Label className="text-xs text-destructive block">Ref does not exist</Label>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2 flex-wrap">
          {instances.map((instance) => (
            <InstanceBadge
              key={instance.name}
              application={application}
              instance={instance}
              instancePods={instancePods.filter(
                (pod) => pod.parents?.includes(`${instance.type}/${instance.name}`) || false
              )}
              refsHeads={refsHeads.filter((r) => refBinding?.ref && r.ref === refBinding.ref)}
            />
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
}
