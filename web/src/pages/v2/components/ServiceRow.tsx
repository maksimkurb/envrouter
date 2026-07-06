import React, { memo, useEffect, useState } from 'react'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import InstanceBadge from './InstanceBadge'
import { refExists, isInstanceDeploying } from '@/lib/instanceUtils'

interface ServiceRowProps {
  environmentName: string
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  refsHeads: Ref[]
  onRefBindingChanged: (refBinding: RefBinding) => void
}

const api = DefaultApiFp()

export const ServiceRow = memo(function ServiceRow({
  environmentName,
  application,
  refBinding,
  instances,
  instancePods,
  refsHeads,
  onRefBindingChanged,
}: ServiceRowProps) {
  const { toast } = useToast()
  const [ref, setRef] = useState(refBinding?.ref || '')
  const [editing, setEditing] = useState(false)

  // Sync local state with prop changes, but never clobber the input mid-edit
  useEffect(() => {
    if (!editing) {
      setRef(refBinding?.ref || '')
    }
  }, [refBinding?.ref, editing])

  const boundRef = refBinding?.ref || ''

  const commitRef = (newRef: string) => {
    setEditing(false)
    if (newRef === boundRef) return
    const newRefBinding: RefBinding = refBinding
      ? { ...refBinding, ref: newRef }
      : { environment: environmentName, application: application.name, ref: newRef }
    api
      .apiV1RefBindingsPost(newRefBinding)
      .then((request) => request())
      .then((response) => {
        onRefBindingChanged(response.data)
        toast({
          title: 'Deployment started',
          description: `Deploying ref ${newRef} to ${environmentName} environment`,
        })
      })
      .catch(() => {
        setRef(boundRef)
        toast({
          title: 'Deployment failed',
          description: `Ref ${newRef} could not be deployed to ${environmentName} environment`,
          variant: 'destructive',
        })
      })
  }

  const revert = () => {
    setEditing(false)
    setRef(boundRef)
  }

  const deploying = isInstanceDeploying(refBinding, refsHeads, instancePods)
  const refIsValid = refExists(ref, refsHeads)
  const errorId = `ref-error-${environmentName}-${application.name}`

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
              aria-label={`Target branch for ${application.name} in ${environmentName}`}
              aria-invalid={!refIsValid && !!ref}
              aria-describedby={!refIsValid && ref ? errorId : undefined}
              onFocus={() => setEditing(true)}
              onChange={(e) => setRef(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitRef(e.currentTarget.value)
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  revert()
                  e.currentTarget.blur()
                }
              }}
              onBlur={revert}
              className={`h-8 text-sm ${!refIsValid && ref ? 'border-destructive' : ''}`}
            />
            {deploying && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Loader2 aria-label="Deployment in progress" className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {editing && ref !== boundRef && (
            <p className="text-xs text-muted-foreground">Press Enter to deploy, Escape to cancel</p>
          )}
          {!refIsValid && ref && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              Ref does not exist
            </p>
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
})
