import React from 'react'
import { Environment } from '@/axios'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Search, ListChevronsUpDown, ListChevronsDownUp } from 'lucide-react'

interface FilterControlsProps {
  environments: Environment[]
  selectedEnvironments: Set<string>
  selectedEnvNames: string
  serviceSearchQuery: string
  branchSearchQuery: string
  onServiceSearchChange: (value: string) => void
  onBranchSearchChange: (value: string) => void
  onToggleEnvironmentFilter: (envName: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export function FilterControls({
  environments,
  selectedEnvironments,
  selectedEnvNames,
  serviceSearchQuery,
  branchSearchQuery,
  onServiceSearchChange,
  onBranchSearchChange,
  onToggleEnvironmentFilter,
  onExpandAll,
  onCollapseAll,
}: FilterControlsProps) {
  return (
    <div className="flex gap-4 items-center flex-wrap">
      <div className="w-64">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Service filter"
            aria-label="Filter by service name"
            value={serviceSearchQuery}
            onChange={(e) => onServiceSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="w-64">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Branch filter"
            aria-label="Filter by branch"
            value={branchSearchQuery}
            onChange={(e) => onBranchSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-48 max-w-md justify-start">
              <span className="truncate">
                {selectedEnvironments.size === 0 ? 'All environments' : selectedEnvNames}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Environment filter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {environments.map((env) => (
              <DropdownMenuCheckboxItem
                key={env.name}
                checked={selectedEnvironments.has(env.name)}
                onCheckedChange={() => onToggleEnvironmentFilter(env.name)}
                onSelect={(e) => e.preventDefault()}
              >
                {env.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex gap-2 ml-auto">
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
