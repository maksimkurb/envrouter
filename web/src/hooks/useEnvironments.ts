import { useEffect, useState } from 'react'
import { Environment, DefaultApiFp } from '@/axios'

const api = DefaultApiFp()

export function useEnvironments() {
  const [data, setData] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    api
      .apiV1EnvironmentsGet()
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
