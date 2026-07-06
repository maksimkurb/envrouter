import { Application, Instance, InstancePod, Ref } from '@/axios'
import { Badge } from '@/components/ui/badge'
import { SheetTrigger } from '@/components/ui/sheet'
import PodDetailsDialog from './PodDetailsDialog'

interface InstanceBadgeProps {
  application: Application
  instance: Instance
  instancePods: InstancePod[]
  refsHeads: Ref[]
}

export default function InstanceBadge({ application, instance, instancePods, refsHeads }: InstanceBadgeProps) {
  const podCount = instancePods.length
  const summary = `${instance.name}: ${podCount} ${podCount === 1 ? 'pod' : 'pods'} on ${instance.ref || 'unknown ref'}`
  return (
    <PodDetailsDialog
      instance={instance}
      instancePods={instancePods}
      application={application}
      refsHeads={refsHeads}
    >
      <SheetTrigger asChild>
        <Badge asChild variant="outline" className="cursor-pointer">
          <button type="button" title={`${summary} — click for pod details`} aria-label={`${summary} — show pod details`}>
            {instance.name}: {podCount}, {instance.ref}
          </button>
        </Badge>
      </SheetTrigger>
    </PodDetailsDialog>
  )
}
