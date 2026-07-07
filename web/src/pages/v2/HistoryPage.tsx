import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { BASE_PATH } from '@/axios/base'
import { Input } from '@/components/ui/input'
import { Loader2, GitBranch, Layers, Tag, X } from 'lucide-react'
import { MultiSelectFilter } from './components/MultiSelectFilter'
import { RefSwitchTable, type RefSwitch } from './components/RefSwitchTable'

function useToggleSet(): [Set<string>, (value: string) => void, () => void] {
  const [set, setSet] = useState<Set<string>>(new Set())
  const toggle = (value: string) =>
    setSet((current) => {
      const next = new Set(current)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  const clear = () => setSet(new Set())
  return [set, toggle, clear]
}

export default function HistoryPage() {
  const [records, setRecords] = useState<RefSwitch[] | null>(null)
  const [error, setError] = useState(false)
  const [selectedEnvironments, toggleEnvironment, clearEnvironments] = useToggleSet()
  const [selectedServices, toggleService, clearServices] = useToggleSet()
  const [branchQuery, setBranchQuery] = useState('')

  useEffect(() => {
    axios
      .get<RefSwitch[]>(`${BASE_PATH}/api/v2/audit/refSwitches`)
      .then((response) => setRecords(response.data ?? []))
      .catch(() => setError(true))
  }, [])

  // filter options come from the data itself — no extra API calls
  const environments = useMemo(
    () => [...new Set((records ?? []).map((r) => r.environment))].sort(),
    [records]
  )
  const services = useMemo(
    () => [...new Set((records ?? []).map((r) => r.application))].sort(),
    [records]
  )

  const filtered = useMemo(() => {
    const query = branchQuery.trim().toLowerCase()
    return (records ?? []).filter((r) => {
      if (selectedEnvironments.size > 0 && !selectedEnvironments.has(r.environment)) return false
      if (selectedServices.size > 0 && !selectedServices.has(r.application)) return false
      if (
        query &&
        !r.oldRef.toLowerCase().includes(query) &&
        !r.newRef.toLowerCase().includes(query)
      )
        return false
      return true
    })
  }, [records, selectedEnvironments, selectedServices, branchQuery])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deploy history</h1>
        <p className="text-sm text-muted-foreground">
          Branch switches across all environments and services. Last 50 changes per service and
          environment, up to 30 days; kept in memory until the EnvRouter server restarts.
        </p>
      </div>
      <div className="flex gap-4 items-center flex-wrap">
        <MultiSelectFilter
          icon={Tag}
          allLabel="All services"
          searchPlaceholder="Search services…"
          ariaLabel="Filter by service"
          options={services}
          selected={selectedServices}
          onToggle={toggleService}
          onClear={clearServices}
        />
        <div className="relative w-64">
          <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Branch filter"
            aria-label="Filter by branch"
            value={branchQuery}
            onChange={(e) => setBranchQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {branchQuery && (
            <button
              type="button"
              aria-label="Reset branch filter"
              onClick={() => setBranchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <MultiSelectFilter
          icon={Layers}
          allLabel="All environments"
          searchPlaceholder="Search environments…"
          ariaLabel="Filter by environment"
          options={environments}
          selected={selectedEnvironments}
          onToggle={toggleEnvironment}
          onClear={clearEnvironments}
        />
      </div>
      {error ? (
        <p role="alert" className="py-12 text-center text-sm text-destructive">
          Failed to load the deploy history.
        </p>
      ) : records === null ? (
        <div className="flex justify-center py-12" role="status" aria-label="Loading history">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {records.length === 0
            ? 'No deploys recorded since server start.'
            : 'No deploys match the current filters.'}
        </p>
      ) : (
        <div className="border rounded-lg">
          <RefSwitchTable records={filtered} showScope />
        </div>
      )}
    </div>
  )
}
