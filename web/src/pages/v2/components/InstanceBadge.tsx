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
  return (
    <PodDetailsDialog
      instance={instance}
      instancePods={instancePods}
      application={application}
      refsHeads={refsHeads}
    >
      <SheetTrigger asChild>
        <Badge variant="outline" className="cursor-pointer">
          {instance.name}: {instancePods.length}, {instance.ref}
        </Badge>
      </SheetTrigger>
    </PodDetailsDialog>
  )
}
