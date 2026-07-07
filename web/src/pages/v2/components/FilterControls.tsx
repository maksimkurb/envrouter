import React from 'react'
import { Application, Environment } from '@/axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MultiSelectFilter } from './MultiSelectFilter'
import {
  Eye,
  GitBranch,
  Layers,
  ListChevronsUpDown,
  ListChevronsDownUp,
  Tag,
  X,
} from 'lucide-react'

interface FilterControlsProps {
  environments: Environment[]
  applications: Application[]
  selectedEnvironments: Set<string>
  selectedServices: Set<string>
  branchSearchQuery: string
  onBranchSearchChange: (value: string) => void
  onToggleEnvironmentFilter: (envName: string) => void
  onToggleServiceFilter: (serviceName: string) => void
  onClearEnvironmentFilter: () => void
  onClearServiceFilter: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  notifyEnabled: boolean
  onToggleNotify: () => void
}

export function FilterControls({
  environments,
  applications,
  selectedEnvironments,
  selectedServices,
  branchSearchQuery,
  onBranchSearchChange,
  onToggleEnvironmentFilter,
  onToggleServiceFilter,
  onClearEnvironmentFilter,
  onClearServiceFilter,
  onExpandAll,
  onCollapseAll,
  notifyEnabled,
  onToggleNotify,
}: FilterControlsProps) {
  return (
    <div className="flex gap-4 items-center flex-wrap">
      <MultiSelectFilter
        icon={Tag}
        allLabel="All services"
        searchPlaceholder="Search services…"
        ariaLabel="Filter by service"
        options={applications.map((a) => a.name)}
        selected={selectedServices}
        onToggle={onToggleServiceFilter}
        onClear={onClearServiceFilter}
      />
      <div className="relative w-64">
        <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Branch filter"
          aria-label="Filter by branch"
          value={branchSearchQuery}
          onChange={(e) => onBranchSearchChange(e.target.value)}
          className="pl-8 pr-8"
        />
        {branchSearchQuery && (
          <button
            type="button"
            aria-label="Reset branch filter"
            onClick={() => onBranchSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <MultiSelectFilter
        icon={Layers}
        allLabel="All environments"
        searchPlaceholder="Search environments…"
        ariaLabel="Filter by environment"
        options={environments.map((e) => e.name)}
        selected={selectedEnvironments}
        onToggle={onToggleEnvironmentFilter}
        onClear={onClearEnvironmentFilter}
      />
      <TooltipProvider>
        <div className="flex gap-2 ml-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={notifyEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={onToggleNotify}
                  aria-label="Watch for changes in current view"
                  aria-pressed={notifyEnabled}
                  className="relative"
                >
                  <Eye aria-hidden="true" />
                  Watch
                  {notifyEnabled && (
                    // pulsing "live" dot, one ping every 2s
                    <span className="pointer-events-none absolute -right-1 -top-1 flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 [animation-duration:2s]" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                </Button>
              }
            />
            <TooltipContent>Notify about branch changes in the current view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExpandAll}
                  aria-label="Expand all environments"
                >
                  <ListChevronsUpDown aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Expand all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCollapseAll}
                  aria-label="Collapse all environments"
                >
                  <ListChevronsDownUp aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Collapse all</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
