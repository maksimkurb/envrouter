import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { BASE_PATH } from '@/axios/base'
import { redirectToLogin } from '@/lib/authRedirect'

export interface AuthInfo {
  enabled: boolean
  authenticated: boolean
  userIdentifier?: string
  fullName?: string
  email?: string
  groups?: string[]
  // absent on older backends — consumers treat missing as allowed (`!== false`)
  canView?: boolean
  canDeploy?: boolean
  canConfigure?: boolean
}

// AppV2 fetches auth once and provides it here so route pages read it without
// re-fetching /auth/userinfo
export const AuthContext = createContext<AuthInfo | null>(null)
export const useAuthContext = () => useContext(AuthContext)

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
          redirectToLogin()
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
