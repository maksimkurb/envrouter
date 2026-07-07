import { Fragment, memo, useEffect, useRef, useState } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { RefBindingUpdate } from '@/sse/api'
import { TableCell, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitBranch, History, Loader2, Package, PackageOpen, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/time'
import { useToast } from '@/hooks/use-toast'
import { PodRow } from './PodRow'
import { UserAvatar } from './UserCell'
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
  // latest switch for this row (who + when), for the avatar by the history button
  lastSwitch?: RefBindingUpdate
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
  lastSwitch,
  onRefBindingChanged,
}: ServiceRowProps) {
  const { toast } = useToast()
  const boundRef = refBinding?.ref || defaultRef

  const [ref, setRef] = useState(boundRef)
  const [editing, setEditing] = useState(false)
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
  // selecting an item and the following blur must not deploy twice
  const lastDeployed = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // live SHA verification: null = unknown/checking, true/false = resolved
  const [shaValid, setShaValid] = useState<boolean | null>(null)

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

  const boundSha = refsHeads.find((r) => r.ref === boundRef)?.commit?.sha?.slice(0, 7)
  // pristine focus shows the full list, current branch first; once the user
  // types we filter ourselves (Combobox filter is disabled) so the pristine
  // full-list behaviour is preserved
  const orderedRefs = [...refsHeads].sort((a, b) =>
    a.ref === boundRef ? -1 : b.ref === boundRef ? 1 : a.ref.localeCompare(b.ref)
  )
  const displayedRefs = dirty
    ? orderedRefs.filter((r) => r.ref.toLowerCase().includes(trimmedRef.toLowerCase()))
    : orderedRefs
  // item values the Combobox knows about (branch/tag names + the custom entry)
  const itemNames = [...displayedRefs.map((r) => r.ref), ...(isCustomRef ? [trimmedRef] : [])]

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
            <div className="flex items-center gap-1">
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
            <Combobox.Root
              items={itemNames}
              filter={null}
              // value tracks the text so Combobox never resets the input to a
              // blank "selected value" label when it closes on blur
              value={ref}
              inputValue={ref}
              onInputValueChange={(value) => {
                setRef(value)
                draft.current = value
                setDirty(true)
                // editing is driven by focus/blur only — a programmatic reset
                // on close must not re-enter edit mode (would hide the SHA badge)
              }}
              // fired on click or keyboard-select of an item (incl. the custom entry)
              onValueChange={(value: string | null) => {
                if (value) commitRef(value)
              }}
              openOnInputClick
            >
              <InputGroup className="h-8 min-w-0 flex-1">
                <Combobox.Input
                  ref={inputRef}
                  data-slot="input-group-control"
                  onFocus={() => {
                    setEditing(true)
                    setDirty(false)
                  }}
                  // Tab / click-away deploys the typed ref; commitRef dedupes so
                  // this never double-deploys after an item was selected
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
                  className="h-full min-w-0 flex-1 overflow-hidden border-0 bg-transparent px-3 text-sm text-ellipsis shadow-none outline-none focus-visible:ring-0 dark:bg-transparent"
                />
                {!editing && boundSha && (
                  <InputGroupAddon align="inline-end" className="pointer-events-none">
                    <span className="font-mono text-xs text-muted-foreground">{boundSha}</span>
                  </InputGroupAddon>
                )}
                {deploying && (
                  <InputGroupAddon align="inline-end" className="pointer-events-none">
                    <Loader2
                      aria-label="Deployment in progress"
                      className="size-4 animate-spin text-muted-foreground"
                    />
                  </InputGroupAddon>
                )}
              </InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner sideOffset={4} align="start" className="z-50">
                  <Combobox.Popup className="max-h-64 w-[var(--anchor-width)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
                      No matching refs
                    </Combobox.Empty>
                    <Combobox.List>
                      {displayedRefs.map((knownRef) => (
                        <Combobox.Item
                          key={knownRef.ref}
                          value={knownRef.ref}
                          title={knownRef.ref}
                          className="relative flex cursor-default items-center gap-1 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted"
                        >
                          {knownRef.type === 'tag' ? (
                            <Tag className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{knownRef.ref}</span>
                          {knownRef.commit?.sha && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {knownRef.commit.sha.slice(0, 7)}
                            </span>
                          )}
                        </Combobox.Item>
                      ))}
                      {isCustomRef && (
                        <Combobox.Item
                          value={trimmedRef}
                          title={trimmedRef}
                          className="relative flex cursor-default items-center gap-1 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted"
                        >
                          <span className="min-w-0 flex-1 truncate">{trimmedRef}</span>
                          <span className="ml-1 shrink-0 text-muted-foreground">
                            {shaLike ? '(commit)' : '(custom ref)'}
                          </span>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            )}
            {/* clickable avatar stack (always two slots reserved, left-aligned),
                one tooltip over the whole control */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Branch switch history for ${application.name} in ${environmentName}`}
                      onClick={() => setHistoryOpen(true)}
                      className="flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {/* pointer-events-none so hover is tracked on the button
                          only — otherwise the cursor crossing between the two
                          overlapping avatars flickers the tooltip */}
                      <span className="pointer-events-none flex items-center">
                        {/* first avatar: the last user, or the History icon when
                            there's no recorded change */}
                        {lastSwitch?.updatedBy ? (
                          <UserAvatar
                            className="relative z-10 size-6 ring-2 ring-background"
                            name={
                              lastSwitch.updatedBy.fullName || lastSwitch.updatedBy.userIdentifier
                            }
                            email={lastSwitch.updatedBy.email}
                          />
                        ) : (
                          <Avatar
                            className="relative z-10 size-6 ring-2 ring-background"
                            aria-hidden="true"
                          >
                            <AvatarFallback className="bg-muted">
                              <History className="size-3.5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {/* second avatar: always an empty circle, barely peeking
                            out behind the first */}
                        <Avatar
                          className="-ml-[18px] size-6 ring-2 ring-background"
                          aria-hidden="true"
                        >
                          <AvatarFallback className="bg-muted" />
                        </Avatar>
                      </span>
                    </button>
                  }
                />
                <TooltipContent>
                  {lastSwitch?.updatedBy ? (
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">
                        {lastSwitch.updatedBy.fullName || lastSwitch.updatedBy.userIdentifier}
                      </span>
                      {lastSwitch.time && (
                        <span className="text-background/70">
                          {timeAgo(new Date(lastSwitch.time))}
                        </span>
                      )}
                      <span className="text-background/70">Open branch change history</span>
                    </span>
                  ) : (
                    'Open branch change history'
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
