import { useEffect, useState } from 'react'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import InstanceBadge from './InstanceBadge'
import { refExists, isInstanceDeploying } from '@/lib/instanceUtils'

interface ServiceRowProps {
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  refsHeads: Ref[]
  onRefBindingChanged: (refBinding: RefBinding) => void
  toast: ReturnType<typeof useToast>['toast']
}

const api = DefaultApiFp()

export function ServiceRow({
  application,
  refBinding,
  instances,
  instancePods,
  refsHeads,
  onRefBindingChanged,
  toast,
}: ServiceRowProps) {
  const [ref, setRef] = useState(refBinding?.ref || '')

  // Sync local state with prop changes
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

  const deploying = isInstanceDeploying(refBinding, refsHeads, instancePods)
  const refIsValid = refExists(ref, refsHeads)

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
              className={`h-8 text-sm ${!refIsValid && ref ? 'border-destructive' : ''}`}
            />
            {deploying && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {!refIsValid && ref && (
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
