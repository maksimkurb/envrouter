import { useState } from 'react'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import InstanceBadge from './InstanceBadge'

interface ApplicationRowProps {
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  onRefBindingChanged: (refBinding: RefBinding) => void
  refsHeads: Ref[]
}

const api = DefaultApiFp()

export default function ApplicationRow({
  application,
  refBinding,
  instances,
  instancePods,
  onRefBindingChanged,
  refsHeads,
}: ApplicationRowProps) {
  const { toast } = useToast()
  const [ref, setRef] = useState(refBinding?.ref || '')

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
    <div className="grid grid-cols-2 gap-4 px-4 py-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start">
        <small className="text-sm text-muted-foreground">{application.name}</small>
      </div>
      <div className="relative">
        <Input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          onBlur={(e) => onRefChanged(e.target.value)}
          className={`h-8 text-sm ${!refExists && ref ? 'border-destructive' : ''}`}
        />
        {!refExists && ref && (
          <Label className="text-xs text-destructive absolute -bottom-4 left-0">Ref does not exist</Label>
        )}
        {deploying && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="col-span-2 flex gap-2 flex-wrap">
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
    </div>
  )
}
