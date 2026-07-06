import { useCallback, useEffect, useRef, useState } from 'react'
import { Application, CredentialsSecretListItem, DefaultApiFp, Repository } from '@/axios'

const api = DefaultApiFp()

// No SSE here — repositories/applications/secrets change rarely;
// refetch-after-mutation converges.
export function useRepositoriesData() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [credentialsSecrets, setCredentialsSecrets] = useState<CredentialsSecretListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // guards against an older response overwriting a newer one
  const fetchSeq = useRef(0)

  const fetchData = useCallback(() => {
    const seq = ++fetchSeq.current
    setError(null)
    Promise.all([
      api.apiV1RepositoriesGet().then((request) => request()),
      api.apiV1ApplicationsGet().then((request) => request()),
      api.apiV1CredentialsSecretsGet().then((request) => request()),
    ])
      .then(([repos, apps, secrets]) => {
        if (seq !== fetchSeq.current) return
        setRepositories(repos.data.sort((a, b) => a.name.localeCompare(b.name)))
        setApplications(apps.data.sort((a, b) => a.name.localeCompare(b.name)))
        setCredentialsSecrets(secrets.data.sort((a, b) => a.name.localeCompare(b.name)))
        setLoading(false)
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return
        console.error('Failed to load repositories data:', err)
        setLoading(false)
        setError('Failed to load repositories data')
      })
  }, [])

  // Makes a secret created inside the repository dialog selectable
  // immediately, without a mid-dialog refetch.
  const addCredentialsSecret = useCallback((secret: CredentialsSecretListItem) => {
    setCredentialsSecrets((current) =>
      [...current.filter((s) => s.name !== secret.name), secret].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    )
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    repositories,
    applications,
    credentialsSecrets,
    addCredentialsSecret,
    loading,
    error,
    refetch: fetchData,
  }
}
