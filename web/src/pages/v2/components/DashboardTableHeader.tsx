import React from 'react'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function DashboardTableHeader() {
  return (
    <TableHeader>
      <TableRow className="bg-blue-500/20 hover:bg-blue-500/20">
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
