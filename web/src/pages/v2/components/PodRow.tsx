import { useEffect, useState } from 'react'
import { Application, Commit, DefaultApiFp, InstancePod } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export function PodRow({ pod, application }: { pod: InstancePod; application: Application }) {
  const [commit, setCommit] = useState<Commit | undefined>(undefined)
  const [loading, setLoading] = useState(false)

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

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell></TableCell>
      <TableCell>
        <div className="flex items-center gap-2 pl-4">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dotClass)} aria-hidden="true" />
          <span className="font-mono text-xs text-muted-foreground" title={`Created ${pod.createdTime}`}>
            {pod.name}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-xs font-mono">
          {pod.ref || '—'}
          {shortSha && <span className="text-muted-foreground" title={pod.commitSha}>{` @ ${shortSha}`}</span>}
        </div>
        {loading ? (
          <Loader2 aria-label="Loading commit info" className="mt-0.5 h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          commit && (
            <div
              className="mt-0.5 max-w-md truncate text-xs text-muted-foreground"
              title={`${commit.author}: ${commit.message}`}
            >
              {commit.author} — {commit.message}
            </div>
          )
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={pod.phase === 'Running' && pod.ready ? 'default' : 'secondary'}>
            {pod.phase}
          </Badge>
          <span className="text-xs text-muted-foreground">{status.label}</span>
        </div>
      </TableCell>
    </TableRow>
  )
}
