import React from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface EnvironmentRowProps {
  environmentName: string
  isExpanded: boolean
  onToggle: () => void
}

export function EnvironmentRow({ environmentName, isExpanded, onToggle }: EnvironmentRowProps) {
  return (
    <TableRow
      className="font-medium bg-muted/50 hover:bg-muted cursor-pointer"
      onClick={onToggle}
    >
      <TableCell>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </TableCell>
      <TableCell colSpan={3}>{environmentName}</TableCell>
    </TableRow>
  )
}
