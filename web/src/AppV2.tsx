import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import axios from 'axios';
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Loader2, ShieldX } from 'lucide-react'
import { BASE_PATH } from '@/axios/base'
import { AuthContext, useAuth } from '@/hooks/useAuth'
import DashboardPage from './pages/v2/DashboardPage';
import RepositoriesPage from './pages/v2/RepositoriesPage';

const SIDEBAR_STORAGE_KEY = 'envrouter_sidebar'

function V2App() {
  // default collapsed; explicit user choice persists
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'open'
  )
  // gate the whole app (including SSE) on the auth check; redirects to
  // /auth/login when OIDC is enabled and there's no valid session
  const auth = useAuth()

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Checking authentication">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // authenticated but not in the view group — the API rejects everything with
  // 403, so show a clear error instead of an empty dashboard
  if (auth.enabled && auth.authenticated && auth.canView === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-sm" role="alert">
          <ShieldX className="h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You are signed in as{' '}
            <span className="font-medium text-foreground">
              {auth.fullName || auth.userIdentifier}
            </span>
            , but your account is not in a group permitted to view EnvRouter.
            Contact your administrator, or sign in with a different account.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              axios.post(`${BASE_PATH}/auth/logout`).finally(() => {
                window.location.href = `${BASE_PATH}/auth/login`
              })
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="envrouter_theme"
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-card focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <div className="flex">
          <SidebarProvider
            open={sidebarOpen}
            onOpenChange={(open) => {
              setSidebarOpen(open)
              localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? 'open' : 'collapsed')
            }}
          >
            <AppSidebar collapsible="icon" auth={auth} />
            <main className="flex-1">
              {/* mobile-only: the off-canvas sidebar needs a trigger; desktop
                  collapses via the button inside the sidebar itself */}
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-card md:hidden">
                <SidebarTrigger />
              </header>
              <div id="main-content" className="flex-1 p-6">
                <Routes>
                  <Route path="/" element={<DashboardPage/>}/>
                  <Route path="/repo" element={<RepositoriesPage/>}/>
                </Routes>
              </div>
            </main>
          </SidebarProvider>
        </div>
        <Toaster />
      </div>
    </ThemeProvider>
    </AuthContext.Provider>
  )
}

export default V2App;
