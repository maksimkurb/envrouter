import { memo } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface EnvironmentRowProps {
  environmentName: string
  isExpanded: boolean
  onToggle: (environmentName: string) => void
}

export const EnvironmentRow = memo(function EnvironmentRow({
  environmentName,
  isExpanded,
  onToggle,
}: EnvironmentRowProps) {
  return (
    <TableRow
      // bg on cells, not the row: a <tr> background stops at the container edge
      // when the table scrolls horizontally, leaving the overflow unpainted
      className="cursor-pointer font-medium [&>td]:bg-blue-500/10 hover:[&>td]:bg-blue-500/15"
      onClick={() => onToggle(environmentName)}
    >
      <TableCell>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} environment ${environmentName}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(environmentName)
          }}
          className="flex items-center justify-center rounded p-1 hover:bg-muted-foreground/10"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </TableCell>
      <TableCell colSpan={3}>{environmentName}</TableCell>
    </TableRow>
  )
})
