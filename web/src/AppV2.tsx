import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import DashboardPage from './pages/v2/DashboardPage';
import RepositoriesPage from './pages/v2/RepositoriesPage';

function V2App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <SidebarProvider>
          <AppSidebar />
          <main className="flex-1">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white">
              <SidebarTrigger />
              <div className="flex flex-1 items-center justify-between">
                <h1 className="text-lg font-semibold">EnvRouter v2</h1>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/">← Back to v1 (MUI)</Link>
                  </Button>
                </div>
              </div>
            </header>
            <div className="flex-1 p-6">
              <Routes>
                <Route path="/" element={<DashboardPage/>}/>
                <Route path="/dashboard" element={<DashboardPage/>}/>
                <Route path="/repo" element={<RepositoriesPage/>}/>
              </Routes>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </div>
  )
}

export default V2App;
