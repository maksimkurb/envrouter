import React from 'react'
import { Application, Environment } from '@/axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from './MultiSelectFilter'
import {
  Eye,
  EyeOff,
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
      <div className="flex gap-2 ml-auto">
        <Button
          variant={notifyEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleNotify}
          title="Notify about changes in current view"
          aria-label="Notify about changes in current view"
          aria-pressed={notifyEnabled}
        >
          {notifyEnabled ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" onClick={onExpandAll} title="Expand All" aria-label="Expand all environments">
          <ListChevronsUpDown aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" onClick={onCollapseAll} title="Collapse All" aria-label="Collapse all environments">
          <ListChevronsDownUp aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
