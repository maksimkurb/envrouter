import { Combobox } from '@base-ui/react/combobox'
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

// Input-styled multi-select: a Combobox popover with a searchable list,
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
      <Combobox.Root
        items={options}
        multiple
        value={Array.from(selected)}
        onValueChange={(next: string[]) => {
          // toggle whichever option's membership changed
          const nextSet = new Set(next)
          options.forEach((o) => {
            if (nextSet.has(o) !== selected.has(o)) onToggle(o)
          })
        }}
      >
        {/* metrics copied from ui/input.tsx so all filter controls line up */}
        <Combobox.Trigger
          aria-label={ariaLabel}
          title={label}
          className={cn(
            'border-input relative flex h-8 w-full items-center rounded-lg border bg-transparent py-1 pl-8 text-left text-sm outline-none transition-colors',
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
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start" className="z-50">
            <Combobox.Popup className="w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              <div className="p-1 pb-0">
                <Combobox.Input
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-8 w-full rounded-lg border border-input/30 bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <Combobox.Empty className="px-2 py-6 text-center text-sm text-muted-foreground empty:hidden">
                Nothing found.
              </Combobox.Empty>
              <Combobox.List className="mt-1 max-h-72 overflow-y-auto">
                {(option: string) => (
                  <Combobox.Item
                    key={option}
                    value={option}
                    title={option}
                    className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted"
                  >
                    <Check
                      className={cn('h-4 w-4', selected.has(option) ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{option}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {selected.size > 0 && (
        <button
          type="button"
          aria-label={`Reset ${ariaLabel}`}
          onClick={onClear}
          className="absolute right-7 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
