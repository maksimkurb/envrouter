import { useEffect, useState } from 'react'
import { Application, DefaultApiFp } from '@/axios'

const api = DefaultApiFp()

export function useApplications() {
  const [data, setData] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    api
      .apiV1ApplicationsGet()
      .then((request) => request())
      .then((response) => {
        setData(response.data.sort((a, b) => a.name.localeCompare(b.name)))
        setLoading(false)
      })
      .catch((err) => {
        setError(err)
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}
