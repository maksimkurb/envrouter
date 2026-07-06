import React from 'react'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function DashboardTableHeader() {
  return (
    <TableHeader>
      {/* bg lives on the cells (not the row) so the container's rounded
          corners aren't painted over; radius = container 8px − 1px border.
          overflow-hidden on the wrapper is not an option: it would clip the
          branch-suggestion dropdowns. */}
      <TableRow className="hover:bg-transparent [&>th]:bg-blue-500/20 [&>th:first-child]:rounded-tl-[7px] [&>th:last-child]:rounded-tr-[7px]">
        <TableHead className="w-12">
          <span className="sr-only">Expand</span>
        </TableHead>
        <TableHead className="w-[25%]">Service</TableHead>
        <TableHead className="w-[35%]">Target Branch</TableHead>
        <TableHead className="w-[40%]">Pods</TableHead>
      </TableRow>
    </TableHeader>
  )
}
