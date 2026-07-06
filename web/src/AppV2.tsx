import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
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

  return (
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
  )
}

export default V2App;
