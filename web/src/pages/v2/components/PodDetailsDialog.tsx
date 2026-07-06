import { useEffect, useState } from 'react'
import { Application, Commit, DefaultApiFp, Instance, InstancePod, Ref } from '@/axios'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PodDetailsDialogProps {
  instance: Instance
  instancePods: InstancePod[]
  application: Application
  refsHeads: Ref[]
  children: React.ReactNode
}

const api = DefaultApiFp()

// Pods of one instance usually share a SHA — fetch each commit once.
const commitCache = new Map<string, Promise<Commit>>()

function getCommit(repositoryName: string, sha: string): Promise<Commit> {
  const key = `${repositoryName}:${sha}`
  let promise = commitCache.get(key)
  if (!promise) {
    promise = api
      .apiV1GitRepositoriesRepositoryNameCommitsShaGet(sha, repositoryName)
      .then((request) => request())
      .then((response) => response.data)
    promise.catch(() => commitCache.delete(key))
    commitCache.set(key, promise)
  }
  return promise
}

function PodDetailsCard({ pod, application }: { pod: InstancePod; application: Application }) {
  const [loading, setLoading] = useState(false)
  const [commit, setCommit] = useState<Commit | undefined>(undefined)
  const [commitError, setCommitError] = useState(false)

  useEffect(() => {
    if (pod.commitSha && application.repositoryName) {
      let cancelled = false
      setLoading(true)
      setCommitError(false)
      getCommit(application.repositoryName, pod.commitSha)
        .then((commit) => {
          if (cancelled) return
          setCommit(commit)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setLoading(false)
          setCommitError(true)
        })
      return () => {
        cancelled = true
      }
    }
  }, [pod.commitSha, application.repositoryName])

  const commitValue = (value: React.ReactNode) => {
    if (loading) return <Loader2 aria-label="Loading" className="h-4 w-4 animate-spin" />
    if (commitError) return <span className="text-muted-foreground">unavailable</span>
    return value
  }

  const rows: Array<{ key: string; value: React.ReactNode }> = [
    { key: 'Pod name', value: pod.name },
    { key: 'Application', value: pod.application },
    { key: 'Environment', value: pod.environment },
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
    { key: 'Author', value: commitValue(commit?.author) },
    {
      key: 'Commit time',
      value: commitValue(
        commit?.timestamp ? new Date(Date.parse(commit.timestamp)).toLocaleString() : undefined
      ),
    },
    { key: 'Commit Message', value: commitValue(commit?.message) },
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
            {instance.name} · {instance.environment} — {instancePods.length}{' '}
            {instancePods.length === 1 ? 'pod' : 'pods'}
          </SheetTitle>
          <SheetDescription>
            Pod details for the {application.name} instance in the {instance.environment} environment.
          </SheetDescription>
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
