import { Fragment, memo, useEffect, useRef, useState } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Application, DefaultApiFp, Instance, InstancePod, Ref, RefBinding } from '@/axios'
import { TableCell, TableRow } from '@/components/ui/table'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { History, Loader2, Package, PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { PodRow } from './PodRow'
import { RefSwitchLogDialog } from './RefSwitchLogDialog'
import { refExists, isInstanceDeploying, filterPodsByInstance } from '@/lib/instanceUtils'

interface ServiceRowProps {
  environmentName: string
  application: Application
  refBinding: RefBinding | undefined
  instances: Instance[]
  instancePods: InstancePod[]
  refsHeads: Ref[]
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
  onRefBindingChanged,
}: ServiceRowProps) {
  const { toast } = useToast()
  const boundRef = refBinding?.ref || ''

  const [ref, setRef] = useState(boundRef)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  // full suggestion list on focus; filter only once the user types
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // blur handlers fire before state updates land — mirror the draft in a ref
  const draft = useRef(boundRef)
  // Enter deploys via onSelect and the following blur must not deploy again
  const lastDeployed = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      .catch(() => {
        lastDeployed.current = null
        setRef(boundRef)
        draft.current = boundRef
        toast({
          title: 'Deployment failed',
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
  const refIsValid = refExists(ref, refsHeads)
  const errorId = `ref-error-${environmentName}-${application.name}`

  const isCustomRef = !!ref.trim() && !refsHeads.some((r) => r.ref === ref.trim())
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
      <TableRow>
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
            <Command
              shouldFilter={dirty}
              className="relative min-w-0 flex-1 overflow-visible rounded-none bg-transparent p-0"
            >
              <div className="relative">
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
                  aria-invalid={!refIsValid && !!ref}
                  aria-describedby={!refIsValid && ref ? errorId : undefined}
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
              {open && (
                <CommandList
                  // keep focus in the input so selecting an item doesn't blur-deploy first
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
                >
                  {orderedRefs.map((knownRef) => (
                    <CommandItem
                      key={knownRef.ref}
                      value={knownRef.ref}
                      onSelect={commitRef}
                      title={knownRef.ref}
                    >
                      <span className="min-w-0 flex-1 truncate">{knownRef.ref}</span>
                      {knownRef.commit?.sha && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {knownRef.commit.sha.slice(0, 7)}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                  {isCustomRef && (
                    <CommandItem value={ref.trim()} onSelect={commitRef} title={ref.trim()}>
                      {ref.trim()}
                      <span className="ml-1 text-muted-foreground">(custom ref)</span>
                    </CommandItem>
                  )}
                </CommandList>
              )}
            </Command>
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
            {!refIsValid && ref && (
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
                {instance.name}: {pods.length}, {instance.ref}
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
