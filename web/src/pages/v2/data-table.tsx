import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  useReactTable,
  ExpandedState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Search } from 'lucide-react'
import { useState } from 'react'
import type { InstancePod } from '@/axios'
import { getStatusBadge } from './columns'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  applicationNames: string[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  applicationNames,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onExpandedChange: setExpanded,
    state: {
      globalFilter,
      expanded,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search environments, applications, branches..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Environments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Environments</SelectItem>
            {Array.from(new Set((data as any[]).map((row) => row.environment))).map(
              (env) => (
                <SelectItem key={env} value={env}>
                  {env}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="not-ready">Not Ready</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Environment</TableHead>
              {applicationNames.map((appName) => (
                <TableHead key={appName}>{appName}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const rowData = row.original as any
                return (
                  <>
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                      {applicationNames.map((appName) => {
                        const appData = rowData.applications[appName]
                        if (!appData) {
                          return (
                            <TableCell key={appName}>
                              <Badge variant="outline">No data</Badge>
                            </TableCell>
                          )
                        }
                        return (
                          <TableCell key={appName}>
                            <div className="space-y-1">
                              {getStatusBadge(appData.status, appData.podCount)}
                              {appData.branch && (
                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                  {appData.branch}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>

                    {/* Expanded row with pod details */}
                    {row.getIsExpanded() && (
                      <TableRow className="bg-muted/50">
                        <TableCell></TableCell>
                        <TableCell colSpan={applicationNames.length + 1}>
                          <div className="py-4 space-y-4">
                            {applicationNames.map((appName) => {
                              const appData = rowData.applications[appName]
                              if (!appData || !appData.pods || appData.pods.length === 0) {
                                return null
                              }

                              return (
                                <div key={appName} className="space-y-2">
                                  <div className="font-medium text-sm">{appName} pods:</div>
                                  <div className="space-y-1 ml-4">
                                    {appData.pods.map((pod: InstancePod, idx: number) => (
                                      <TooltipProvider key={idx}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center gap-2 text-sm">
                                              <span className="text-muted-foreground">"</span>
                                              <span className="font-mono text-xs">{pod.name}</span>
                                              <Badge
                                                variant={
                                                  pod.phase === 'Running' && pod.ready
                                                    ? 'default'
                                                    : pod.phase === 'Running' && !pod.ready
                                                    ? 'destructive'
                                                    : pod.phase === 'Pending'
                                                    ? 'secondary'
                                                    : 'destructive'
                                                }
                                              >
                                                {pod.phase === 'Running' && pod.ready
                                                  ? 'Running'
                                                  : pod.phase === 'Running' && !pod.ready
                                                  ? 'Not Ready'
                                                  : pod.phase}
                                              </Badge>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="space-y-1">
                                              <div>Phase: {pod.phase}</div>
                                              <div>Ready: {pod.ready ? 'Yes' : 'No'}</div>
                                              {pod.containerName && (
                                                <div>Container: {pod.containerName}</div>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + applicationNames.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
