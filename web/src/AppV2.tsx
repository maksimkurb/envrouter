import { Routes, Route, Link } from 'react-router-dom';
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import DashboardPage from './pages/v2/DashboardPage';
import RepositoriesPage from './pages/v2/RepositoriesPage';

function V2App() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex">
        <SidebarProvider>
          <AppSidebar collapsible="icon" />
          <main className="flex-1">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-card">
              <SidebarTrigger />
              <div className="flex flex-1 items-center justify-between">
                <h1 className="text-lg font-semibold">EnvRouter</h1>
                <div className="flex items-center gap-2">
                  <Button variant="outline" render={<Link to="/" />}>
                    ← Back to v1 (MUI)
                  </Button>
                </div>
              </div>
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
  )
}

export default V2App;
