import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { InstancePod } from '@/axios'

export interface EnvironmentRow {
  environment: string
  applications: {
    [appName: string]: {
      status: 'running' | 'not-ready' | 'pending' | 'failed' | 'no-pods'
      podCount: number
      branch?: string
      pods?: InstancePod[]
    }
  }
}

export const columns: ColumnDef<EnvironmentRow>[] = [
  {
    id: 'expander',
    header: () => null,
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => row.toggleExpanded()}
          className="h-8 w-8 p-0"
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )
    },
  },
  {
    accessorKey: 'environment',
    header: 'Environment',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('environment')}</div>
    ),
  },
]

export const getStatusBadge = (
  status: 'running' | 'not-ready' | 'pending' | 'failed' | 'no-pods',
  count: number
) => {
  const variants: Record<typeof status, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    running: 'default',
    'not-ready': 'destructive',
    pending: 'secondary',
    failed: 'destructive',
    'no-pods': 'outline',
  }

  const labels: Record<typeof status, string> = {
    running: `${count} Running`,
    'not-ready': `${count} Not Ready`,
    pending: `${count} Pending`,
    failed: `${count} Failed`,
    'no-pods': 'No pods',
  }

  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}
