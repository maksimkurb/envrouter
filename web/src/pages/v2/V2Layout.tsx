import React from 'react'
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from 'sonner'

interface V2LayoutProps {
  children: React.ReactNode
}

export default function V2Layout({ children }: V2LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">EnvRouter v2</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Modern Interface
              </span>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
      <Toaster />
    </SidebarProvider>
  )
}
