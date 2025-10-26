import { useState } from 'react'
import { Application, Instance, InstancePod, Ref } from '@/axios'
import { Badge } from '@/components/ui/badge'
import PodDetailsDialog from './PodDetailsDialog'

interface InstanceBadgeProps {
  application: Application
  instance: Instance
  instancePods: InstancePod[]
  refsHeads: Ref[]
}

export default function InstanceBadge({ application, instance, instancePods, refsHeads }: InstanceBadgeProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Badge variant="outline" className="cursor-pointer" onClick={() => setOpen(true)}>
        {instance.name}: {instancePods.length}, {instance.ref}
      </Badge>
      <PodDetailsDialog
        open={open}
        onOpenChange={setOpen}
        instance={instance}
        instancePods={instancePods}
        application={application}
        refsHeads={refsHeads}
      />
    </>
  )
}
