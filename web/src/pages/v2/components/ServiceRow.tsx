import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Command as CommandPrimitive } from 'cmdk'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { GitBranch, History, Loader2, Package, PackageOpen, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { PodRow } from './PodRow'
import { RefSwitchLogDialog } from './RefSwitchLogDialog'
import { isInstanceDeploying, filterPodsByInstance } from '@/lib/instanceUtils'

// SHA-shaped strings (short or full) are valid deploy targets even though they
// are not in the refs list; cache live-verification results per repo:sha.
const SHA_RE = /^[0-9a-f]{7,40}$/i
const shaVerifyCache = new Map<string, boolean>()

interface ServiceRowProps {
  environmentName: string
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  refsHeads: Ref[]
  defaultRef: string
  canDeploy: boolean
  // two green blinks when someone else just switched this row's branch
  highlight?: boolean
  onRefBindingChanged: (refBinding: RefBinding) => void
}

const api = DefaultApiFp()

export const ServiceRow = memo(function ServiceRow({
  environmentName,
  application,
  refBinding,
  instances,
  instancePods,
  refsHeads,
  defaultRef,
  canDeploy,
  highlight,
  onRefBindingChanged,
}: ServiceRowProps) {
  const { toast } = useToast()
  const boundRef = refBinding?.ref || defaultRef

  const [ref, setRef] = useState(boundRef)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  // full suggestion list on focus; filter only once the user types
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // blur handlers fire before state updates land — mirror the draft in a ref
  const draft = useRef(boundRef)
  // async .catch must revert to the CURRENT binding, not the render-time
  // closure value (an SSE update may have landed while the POST was in flight)
  const boundRefLive = useRef(boundRef)
  boundRefLive.current = boundRef
  // Enter deploys via onSelect and the following blur must not deploy again
  const lastDeployed = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // wrapper we measure to position the portaled suggestion list
  const anchorRef = useRef<HTMLDivElement>(null)
  // live SHA verification: null = unknown/checking, true/false = resolved
  const [shaValid, setShaValid] = useState<boolean | null>(null)
  // fixed-position rect for the portaled dropdown (escapes the table's overflow)
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null)

  // Sync local state with prop changes, but never clobber the input mid-edit
  // or while a deploy is in flight (the binding still carries the OLD ref
  // until the POST response / RefBinding event lands — syncing then would
  // flash the old branch name)
  useEffect(() => {
    if (boundRef === lastDeployed.current) {
      // deploy confirmed by the binding — resume normal prop syncing
      lastDeployed.current = null
    }
    if (!editing && lastDeployed.current === null) {
      setRef(boundRef)
      draft.current = boundRef
    }
  }, [boundRef, editing])

  const commitRef = (value: string) => {
    setOpen(false)
    setEditing(false)
    setDirty(false)
    const newRef = value.trim()
    if (!newRef || newRef === boundRef || newRef === lastDeployed.current) return
    lastDeployed.current = newRef
    setRef(newRef)
    draft.current = newRef
    const newRefBinding: RefBinding = refBinding
      ? { ...refBinding, ref: newRef }
      : { environment: environmentName, application: application.name, ref: newRef }
    api
      .apiV1RefBindingsPost(newRefBinding)
      .then((request) => request())
      .then((response) => {
        onRefBindingChanged(response.data)
        toast({
          title: 'Deployment started',
          description: `Deploying ref ${newRef} to ${environmentName} environment`,
        })
      })
      .catch((err) => {
        lastDeployed.current = null
        setRef(boundRefLive.current)
        draft.current = boundRefLive.current
        toast({
          title:
            err?.response?.status === 403
              ? "You don't have permission to do that"
              : 'Deployment failed',
          description: `Ref ${newRef} could not be deployed to ${environmentName} environment`,
          variant: 'destructive',
        })
      })
  }

  const cancelEdit = () => {
    draft.current = boundRef
    setRef(boundRef)
    setOpen(false)
    setEditing(false)
    setDirty(false)
    inputRef.current?.blur()
  }

  const deploying = isInstanceDeploying(refBinding, refsHeads, instancePods)
  const errorId = `ref-error-${environmentName}-${application.name}`

  const trimmedRef = ref.trim()
  const isKnownRef = refsHeads.some((r) => r.ref === trimmedRef)
  const shaLike = SHA_RE.test(trimmedRef)

  // Verify a SHA-shaped, non-listed ref against the commits API (debounced,
  // cached) so a valid commit isn't flagged "does not exist".
  useEffect(() => {
    if (!trimmedRef || isKnownRef || !shaLike || !application.repositoryName) {
      setShaValid(null)
      return
    }
    const key = `${application.repositoryName}:${trimmedRef}`
    const cached = shaVerifyCache.get(key)
    if (cached !== undefined) {
      setShaValid(cached)
      return
    }
    setShaValid(null) // checking
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .apiV1GitRepositoriesRepositoryNameCommitsShaGet(trimmedRef, application.repositoryName!)
        .then((request) => request())
        .then(() => {
          shaVerifyCache.set(key, true)
          if (!cancelled) setShaValid(true)
        })
        .catch(() => {
          shaVerifyCache.set(key, false)
          if (!cancelled) setShaValid(false)
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmedRef, isKnownRef, shaLike, application.repositoryName])

  const refIsValid = isKnownRef || (shaLike && shaValid === true)
  // suppress the error while a SHA is still being checked
  const showRefError = !!trimmedRef && !isKnownRef && (!shaLike || shaValid === false)

  const isCustomRef = !!trimmedRef && !isKnownRef

  // Position the portaled suggestion list under the input. Portaling escapes
  // the table's overflow-x-auto, which otherwise clips the dropdown.
  const updateMenuRect = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuRect({ top: r.bottom, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuRect()
    // capture=true so scrolling the table container (not just window) repositions
    window.addEventListener('scroll', updateMenuRect, true)
    window.addEventListener('resize', updateMenuRect)
    return () => {
      window.removeEventListener('scroll', updateMenuRect, true)
      window.removeEventListener('resize', updateMenuRect)
    }
  }, [open, updateMenuRect])
  const boundSha = refsHeads.find((r) => r.ref === boundRef)?.commit?.sha?.slice(0, 7)
  // with filtering off (pristine focus), DOM order wins: current branch first,
  // so a bare Enter re-selects it and deploys nothing
  const orderedRefs = dirty
    ? refsHeads
    : [...refsHeads].sort((a, b) =>
        a.ref === boundRef ? -1 : b.ref === boundRef ? 1 : a.ref.localeCompare(b.ref)
      )

  // pods grouped per instance, in instance order (same filter the sheet used)
  const instancePodGroups = instances.map(
    (instance) => [instance, filterPodsByInstance(instancePods, instance)] as const
  )
  const podCount = instancePodGroups.reduce((sum, [, pods]) => sum + pods.length, 0)
  const canExpand = podCount > 0

  return (
    <Fragment>
      <TableRow className={cn(highlight && 'ref-updated-blink')}>
        <TableCell>
          {canExpand && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} pods of ${application.name} in ${environmentName}`}
              onClick={() => setExpanded((e) => !e)}
              // indented relative to the env-level chevron to show hierarchy
              className="ml-4 flex items-center justify-center rounded p-1 hover:bg-muted-foreground/10"
            >
              {expanded ? (
                <PackageOpen className="h-4 w-4 fill-primary/15 text-primary" aria-hidden="true" />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          )}
        </TableCell>
        <TableCell>
          <small className="text-sm text-muted-foreground">{application.name}</small>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <div className="flex max-w-xs items-center gap-1">
            {!canDeploy ? (
              // read-only: no deploy permission — show the current ref, not an editable combobox
              <div className="border-input flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-transparent px-3 text-sm dark:bg-input/30">
                <span className="min-w-0 flex-1 truncate" title={ref}>{ref}</span>
                {boundSha && <span className="font-mono text-xs text-muted-foreground">{boundSha}</span>}
                {deploying && (
                  <Loader2
                    aria-label="Deployment in progress"
                    className="h-4 w-4 animate-spin text-muted-foreground"
                  />
                )}
              </div>
            ) : (
            <Command
              shouldFilter={dirty}
              className="relative min-w-0 flex-1 overflow-visible rounded-none bg-transparent p-0"
            >
              <div className="relative" ref={anchorRef}>
                <CommandPrimitive.Input
                  ref={inputRef}
                  value={ref}
                  onValueChange={(value) => {
                    setRef(value)
                    draft.current = value
                    setDirty(true)
                    setOpen(true)
                    setEditing(true)
                  }}
                  onFocus={() => {
                    setEditing(true)
                    setDirty(false)
                    setOpen(true)
                  }}
                  onBlur={() => commitRef(draft.current)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelEdit()
                    }
                  }}
                  aria-label={`Target branch for ${application.name} in ${environmentName}`}
                  aria-invalid={showRefError}
                  aria-describedby={showRefError ? errorId : undefined}
                  className={cn(
                    'border-input h-8 w-full rounded-md border bg-transparent px-3 py-1 text-sm outline-none transition-[color,box-shadow]',
                    'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                    'dark:bg-input/30',
                    (deploying || (!editing && boundSha)) && 'pr-16'
                  )}
                />
                <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {!editing && boundSha && (
                    <span className="font-mono text-xs text-muted-foreground">{boundSha}</span>
                  )}
                  {deploying && (
                    <Loader2
                      aria-label="Deployment in progress"
                      className="h-4 w-4 animate-spin text-muted-foreground"
                    />
                  )}
                </div>
              </div>
              {open &&
                menuRect &&
                createPortal(
                  <CommandList
                    // keep focus in the input so selecting an item doesn't blur-deploy first
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      position: 'fixed',
                      top: menuRect.top + 4,
                      left: menuRect.left,
                      width: menuRect.width,
                    }}
                    className="z-50 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
                  >
                    {orderedRefs.map((knownRef) => (
                      <CommandItem
                        key={knownRef.ref}
                        value={knownRef.ref}
                        onSelect={commitRef}
                        title={knownRef.ref}
                      >
                        {knownRef.type === 'tag' ? (
                          <Tag className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <GitBranch className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{knownRef.ref}</span>
                        {knownRef.commit?.sha && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {knownRef.commit.sha.slice(0, 7)}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                    {isCustomRef && (
                      <CommandItem value={trimmedRef} onSelect={commitRef} title={trimmedRef}>
                        <span className="min-w-0 flex-1 truncate">{trimmedRef}</span>
                        <span className="ml-1 shrink-0 text-muted-foreground">
                          {shaLike ? '(commit)' : '(custom ref)'}
                        </span>
                      </CommandItem>
                    )}
                  </CommandList>,
                  document.body
                )}
            </Command>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Branch switch history for ${application.name} in ${environmentName}`}
              title="Branch switch history"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" aria-hidden="true" />
            </Button>
            </div>
            {historyOpen && (
              <RefSwitchLogDialog
                environmentName={environmentName}
                applicationName={application.name}
                onClose={() => setHistoryOpen(false)}
              />
            )}
            {editing && ref !== boundRef && (
              <p className="text-xs text-muted-foreground">Enter or Tab deploys, Esc cancels</p>
            )}
            {showRefError && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                Ref does not exist
              </p>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-2 flex-wrap">
            {instancePodGroups.map(([instance, pods]) => (
              <Badge
                key={instance.name}
                variant="outline"
                className={cn(pods.length > 0 && 'cursor-pointer')}
                render={
                  pods.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${instance.name}: ${pods.length} ${pods.length === 1 ? 'pod' : 'pods'} on ${instance.ref || 'unknown ref'} — toggle pod list`}
                      onClick={() => setExpanded((e) => !e)}
                    />
                  ) : undefined
                }
              >
                <span className="truncate" title={`${instance.name}: ${pods.length}, ${instance.ref}`}>
                  {instance.name}: {pods.length}, {instance.ref}
                </span>
              </Badge>
            ))}
          </div>
        </TableCell>
      </TableRow>
      {expanded &&
        instancePodGroups.map(([instance, pods]) =>
          pods.map((pod) => <PodRow key={`${instance.name}-${pod.name}`} pod={pod} application={application} />)
        )}
    </Fragment>
  )
})
