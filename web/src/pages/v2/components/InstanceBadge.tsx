import { Application, Instance, InstancePod, Ref } from '@/axios'
import { badgeVariants } from '@/components/ui/badge'
import { SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
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
      {/* SheetTrigger renders a native button; badgeVariants gives it badge styling */}
      <SheetTrigger
        title={`${summary} — click for pod details`}
        aria-label={`${summary} — show pod details`}
        className={cn(badgeVariants({ variant: 'outline' }), 'cursor-pointer')}
      >
        {instance.name}: {podCount}, {instance.ref}
      </SheetTrigger>
    </PodDetailsDialog>
  )
}
