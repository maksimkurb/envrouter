import React, { useState } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Application, Environment } from '@/axios'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Search, ListChevronsUpDown, ListChevronsDownUp } from 'lucide-react'

interface FilterControlsProps {
  environments: Environment[]
  applications: Application[]
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

// Text filter with service-name suggestions; free text stays a substring filter.
function ServiceFilterCombobox({
  value,
  onChange,
  suggestions,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Command shouldFilter className="relative w-64 overflow-visible rounded-none bg-transparent p-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <CommandPrimitive.Input
          value={value}
          onValueChange={(v) => {
            onChange(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
          placeholder="Service filter"
          aria-label="Filter by service name"
          className={cn(
            'border-input h-9 w-full rounded-md border bg-transparent py-1 pl-9 pr-3 text-sm outline-none transition-[color,box-shadow]',
            'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'dark:bg-input/30'
          )}
        />
      </div>
      {open && suggestions.length > 0 && (
        <CommandList
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((name) => (
            <CommandItem
              key={name}
              value={name}
              title={name}
              onSelect={(v) => {
                onChange(v)
                setOpen(false)
              }}
            >
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  )
}

// Multi-select environment picker: searchable command list with check marks.
function EnvironmentFilterCombobox({
  environments,
  selectedEnvironments,
  selectedEnvNames,
  onToggle,
}: {
  environments: Environment[]
  selectedEnvironments: Set<string>
  selectedEnvNames: string
  onToggle: (envName: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" className="min-w-48 max-w-md justify-start" />}
      >
        <span className="truncate">
          {selectedEnvironments.size === 0 ? 'All environments' : selectedEnvNames}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search environments…" aria-label="Search environments" />
          <CommandList>
            <CommandEmpty>No environments found.</CommandEmpty>
            {environments.map((env) => (
              <CommandItem key={env.name} value={env.name} onSelect={() => onToggle(env.name)}>
                <Check
                  className={cn(
                    'h-4 w-4',
                    selectedEnvironments.has(env.name) ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{env.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function FilterControls({
  environments,
  applications,
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
      <ServiceFilterCombobox
        value={serviceSearchQuery}
        onChange={onServiceSearchChange}
        suggestions={applications.map((a) => a.name)}
      />
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
      <EnvironmentFilterCombobox
        environments={environments}
        selectedEnvironments={selectedEnvironments}
        selectedEnvNames={selectedEnvNames}
        onToggle={onToggleEnvironmentFilter}
      />
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
