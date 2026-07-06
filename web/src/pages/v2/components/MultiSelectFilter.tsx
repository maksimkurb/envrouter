import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react'

interface MultiSelectFilterProps {
  icon: LucideIcon
  allLabel: string
  searchPlaceholder: string
  ariaLabel: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
}

// Input-styled multi-select: popover with a searchable command list,
// check marks for selected values, X button resets the whole filter.
export function MultiSelectFilter({
  icon: Icon,
  allLabel,
  searchPlaceholder,
  ariaLabel,
  options,
  selected,
  onToggle,
  onClear,
}: MultiSelectFilterProps) {
  const label = selected.size === 0 ? allLabel : Array.from(selected).sort().join(', ')
  return (
    <div className="relative w-64">
      <Popover>
        {/* metrics copied from ui/input.tsx so all filter controls line up */}
        <PopoverTrigger
          aria-label={ariaLabel}
          title={label}
          className={cn(
            'border-input relative h-8 w-full rounded-lg border bg-transparent py-1 pl-8 text-left text-sm outline-none transition-colors',
            selected.size > 0 ? 'pr-13' : 'pr-8',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'dark:bg-input/30'
          )}
        >
          <Icon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className={cn('block truncate', selected.size === 0 && 'text-muted-foreground')}>
            {label}
          </span>
          <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
            <CommandList className="mt-1">
              <CommandEmpty>Nothing found.</CommandEmpty>
              {options.map((option) => (
                <CommandItem key={option} value={option} title={option} onSelect={() => onToggle(option)}>
                  <Check
                    className={cn('h-4 w-4', selected.has(option) ? 'opacity-100' : 'opacity-0')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.size > 0 && (
        <button
          type="button"
          aria-label={`Reset ${ariaLabel}`}
          onClick={onClear}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
