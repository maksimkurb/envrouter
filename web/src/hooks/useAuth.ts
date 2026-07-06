import { useEffect, useState } from 'react'
import axios from 'axios'
import { BASE_PATH } from '@/axios/base'

export interface AuthInfo {
  enabled: boolean
  authenticated: boolean
  userIdentifier?: string
  fullName?: string
  email?: string
}

// null while the userinfo check is in flight; when OIDC is enabled and the
// session is missing/expired this redirects to the login flow instead of
// resolving.
export function useAuth(): AuthInfo | null {
  const [auth, setAuth] = useState<AuthInfo | null>(null)

  useEffect(() => {
    axios
      .get<AuthInfo>(`${BASE_PATH}/auth/userinfo`)
      .then((response) => {
        if (response.data.enabled && !response.data.authenticated) {
          window.location.href = `${BASE_PATH}/auth/login?rd=${encodeURIComponent(
            window.location.pathname
          )}`
          return
        }
        setAuth(response.data)
      })
      .catch(() => {
        // backend unreachable — proceed unauthenticated; data hooks surface
        // their own connection errors
        setAuth({ enabled: false, authenticated: false })
      })
  }, [])

  return auth
}
