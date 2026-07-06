import { useEffect, useState } from 'react'
import { Application, Commit, DefaultApiFp, InstancePod } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseGoTime, timeAgo } from '@/lib/time'

const api = DefaultApiFp()

// Pods of one service usually share a SHA — fetch each commit once.
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

function podStatus(pod: InstancePod): { label: string; dotClass: string } {
  if (pod.phase === 'Running' && pod.ready) {
    return { label: 'Ready', dotClass: 'bg-green-500' }
  }
  if (pod.phase === 'Running') {
    return { label: 'Not ready', dotClass: 'bg-yellow-500' }
  }
  return { label: pod.phase, dotClass: 'bg-muted-foreground' }
}

function PodDetailsModal({
  pod,
  commit,
  commitLoading,
  onClose,
}: {
  pod: InstancePod
  commit: Commit | undefined
  commitLoading: boolean
  onClose: () => void
}) {
  const commitValue = (value: React.ReactNode) => {
    if (commitLoading) return <Loader2 aria-label="Loading" className="h-4 w-4 animate-spin" />
    return value ?? <span className="text-muted-foreground">—</span>
  }

  const rows: Array<{ key: string; value: React.ReactNode }> = [
    { key: 'Pod name', value: pod.name },
    { key: 'Application', value: pod.application },
    { key: 'Environment', value: pod.environment },
    {
      key: 'Status',
      value: (
        <div className="flex items-center gap-2">
          <Badge variant={pod.phase === 'Running' && pod.ready ? 'default' : 'secondary'}>
            {pod.phase}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {pod.ready ? 'ready' : 'not ready'}, {pod.started ? 'started' : 'not started'}
          </span>
        </div>
      ),
    },
    { key: 'Created', value: pod.createdTime },
    { key: 'Started', value: pod.startedTime ?? <span className="text-muted-foreground">—</span> },
    {
      key: 'Instance',
      value: pod.parents?.length ? (
        <div className="space-y-0.5">
          {pod.parents.map((parent) => (
            <div key={parent}>{parent}</div>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    },
    { key: 'Branch', value: pod.ref || <span className="text-muted-foreground">—</span> },
    { key: 'Commit', value: pod.commitSha || <span className="text-muted-foreground">—</span> },
    { key: 'Author', value: commitValue(commit?.author) },
    {
      key: 'Commit time',
      value: commitValue(
        commit?.timestamp ? new Date(Date.parse(commit.timestamp)).toLocaleString() : undefined
      ),
    },
    {
      key: 'Commit message',
      value: commitValue(
        commit?.message && <span className="whitespace-pre-wrap">{commit.message}</span>
      ),
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{pod.name}</DialogTitle>
          <DialogDescription>
            Pod details for {pod.application} in the {pod.environment} environment.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {rows.map((row, index) => (
            <div key={row.key}>
              {index > 0 && <Separator />}
              <div className="grid grid-cols-3 gap-4 px-4 py-2.5">
                <div className="text-sm font-medium">{row.key}</div>
                <div className="col-span-2 font-mono text-xs break-all">{row.value}</div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PodRow({ pod, application }: { pod: InstancePod; application: Application }) {
  const [commit, setCommit] = useState<Commit | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copySha = () => {
    if (!pod.commitSha) return
    navigator.clipboard.writeText(pod.commitSha).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  useEffect(() => {
    if (pod.commitSha && application.repositoryName) {
      let cancelled = false
      setLoading(true)
      getCommit(application.repositoryName, pod.commitSha)
        .then((commit) => {
          if (cancelled) return
          setCommit(commit)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }
  }, [pod.commitSha, application.repositoryName])

  const status = podStatus(pod)
  const shortSha = pod.commitSha ? pod.commitSha.slice(0, 7) : ''
  const created = parseGoTime(pod.createdTime)
  const started = parseGoTime(pod.startedTime)

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell></TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-1 pl-4">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dotClass)} aria-hidden="true" />
          <span className="ml-1 truncate font-mono text-xs text-muted-foreground" title={pod.name}>
            {pod.name}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Show details of pod ${pod.name}`}
            onClick={() => setDetailsOpen(true)}
          >
            <Info aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center text-xs font-mono">
          {pod.ref || '—'}
          {shortSha && (
            <button
              type="button"
              onClick={copySha}
              title={`Copy full commit hash: ${pod.commitSha}`}
              aria-label={`Copy full commit hash of pod ${pod.name}`}
              className="ml-2 cursor-pointer text-muted-foreground hover:text-foreground hover:underline"
            >
              {copied ? 'copied!' : shortSha}
            </button>
          )}
          {loading && (
            <Loader2
              aria-label="Loading commit info"
              className="ml-2 h-3 w-3 animate-spin text-muted-foreground"
            />
          )}
        </div>
        {!loading && commit && (
          <div
            className="mt-0.5 max-w-md truncate text-xs text-muted-foreground"
            title={`${commit.author}: ${commit.message}`}
          >
            {commit.author} — {commit.message}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={pod.phase === 'Running' && pod.ready ? 'default' : 'secondary'}>
            {pod.phase}
          </Badge>
          <span
            className="text-xs text-muted-foreground"
            title={`Created ${pod.createdTime}${pod.startedTime ? `, started ${pod.startedTime}` : ''}`}
          >
            {status.label}
            {created && ` · created ${timeAgo(created)}`}
            {started && ` · started ${timeAgo(started)}`}
          </span>
        </div>
        {detailsOpen && (
          <PodDetailsModal
            pod={pod}
            commit={commit}
            commitLoading={loading}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </TableCell>
    </TableRow>
  )
}
