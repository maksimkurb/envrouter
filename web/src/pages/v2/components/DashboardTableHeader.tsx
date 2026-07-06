import React from 'react'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function DashboardTableHeader() {
  return (
    <TableHeader>
      <TableRow>
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
