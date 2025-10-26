import { Application, Environment, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ApplicationRow from './ApplicationRow'

interface EnvironmentCardProps {
  environment: Environment
  applications: Application[]
  refBindings: RefBinding[]
  instances: Instance[]
  instancePods: InstancePod[]
  onRefBindingChanged: (refBinding: RefBinding) => void
  refsHeads: Ref[]
}

export default function EnvironmentCard({
  environment,
  applications,
  refBindings,
  instances,
  instancePods,
  onRefBindingChanged,
  refsHeads,
}: EnvironmentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-left">{environment.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {applications.map((application) => (
          <ApplicationRow
            key={application.name}
            application={application}
            refBinding={refBindings.find((r) => r.application === application.name)}
            instances={instances.filter((i) => i.application === application.name)}
            instancePods={instancePods.filter((i) => i.application === application.name)}
            onRefBindingChanged={onRefBindingChanged}
            refsHeads={refsHeads.filter((r) => r.repository === application.repositoryName)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
