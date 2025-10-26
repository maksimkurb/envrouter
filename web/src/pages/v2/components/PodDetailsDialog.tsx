import { useEffect, useState } from 'react'
import { Application, Commit, DefaultApiFp, Instance, InstancePod, Ref } from '@/axios'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

interface PodDetailsDialogProps {
  instance: Instance
  instancePods: InstancePod[]
  application: Application
  refsHeads: Ref[]
  children: React.ReactNode
}

const api = DefaultApiFp()

function PodDetailsCard({ pod, application }: { pod: InstancePod; application: Application }) {
  const [loading, setLoading] = useState(false)
  const [commit, setCommit] = useState<Commit | undefined>(undefined)
  const { toast } = useToast()

  useEffect(() => {
    if (pod.commitSha && application.repositoryName) {
      setLoading(true)
      api
        .apiV1GitRepositoriesRepositoryNameCommitsShaGet(pod.commitSha, application.repositoryName)
        .then((request) => request())
        .then((response) => {
          setCommit(response.data)
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
          toast({
            title: 'Git fetching failed',
            variant: 'destructive',
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pod.commitSha, application.repositoryName])

  const rows: Array<{ key: string; value: React.ReactNode }> = [
    { key: 'Pod name', value: pod.name },
    { key: 'Application', value: pod.application },
    { key: 'Environment', value: pod.environment },
    { key: 'Shard', value: 's01' },
    {
      key: 'Status',
      value: (
        <Badge variant={pod.phase === 'Running' ? 'default' : 'secondary'}>
          {pod.phase}
        </Badge>
      ),
    },
    { key: 'Created', value: pod.createdTime },
    { key: 'Started', value: pod.startedTime },
    { key: 'Branch', value: pod.ref || '-' },
    { key: 'Commit', value: pod.commitSha },
    {
      key: 'Author',
      value: loading ? <Loader2 className="h-4 w-4 animate-spin" /> : commit?.author,
    },
    {
      key: 'Commit time',
      value: loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : commit?.timestamp ? (
        new Date(Date.parse(commit.timestamp)).toLocaleString()
      ) : undefined,
    },
    {
      key: 'Commit Message',
      value: loading ? <Loader2 className="h-4 w-4 animate-spin" /> : commit?.message,
    },
  ]

  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        {rows.map((row, index) => (
          <div key={row.key}>
            {index > 0 && <Separator />}
            <div className="grid grid-cols-3 gap-4 p-4">
              <div className="font-medium">{row.key}:</div>
              <div className="col-span-2 font-mono text-xs">{row.value}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function PodDetailsDialog({
  instance,
  instancePods,
  application,
  children,
}: PodDetailsDialogProps) {
  return (
    <Sheet>
      {children}
      <SheetContent side="right" className="sm:max-w-3xl px-6">
        <SheetHeader className="px-0">
          <SheetTitle>
            {instance.name}.{instance.environment}: {instancePods.length}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-6 -mx-6 px-6">
          <div className="bg-background">
            {instancePods.map((pod) => (
              <PodDetailsCard key={pod.name} pod={pod} application={application} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
