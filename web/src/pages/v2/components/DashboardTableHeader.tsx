import React from 'react'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function DashboardTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-12">
          <span className="sr-only">Expand</span>
        </TableHead>
        <TableHead>Service</TableHead>
        <TableHead>Target Branch</TableHead>
        <TableHead>Pods</TableHead>
      </TableRow>
    </TableHeader>
  )
}
