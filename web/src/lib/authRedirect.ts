import axios from 'axios'
import { BASE_PATH } from '@/axios/base'

export function redirectToLogin() {
  window.location.href = `${BASE_PATH}/auth/login?rd=${encodeURIComponent(
    window.location.pathname
  )}`
}

// v1 and v2 both call through the default axios instance (the generated
// client's globalAxios), so this one interceptor gives BOTH UIs the
// redirect-to-login behavior when OIDC is enabled.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !window.location.pathname.startsWith('/auth/')) {
      redirectToLogin()
      // halt the promise chain while the browser navigates
      return new Promise(() => {})
    }
    return Promise.reject(error)
  }
)
