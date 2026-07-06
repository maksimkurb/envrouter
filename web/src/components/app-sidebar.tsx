import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useTheme } from "next-themes"
import axios from "axios"
import {
  History,
  Home,
  Folders,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserRound,
} from "lucide-react"
import { BASE_PATH } from "@/axios/base"
import type { AuthInfo } from "@/hooks/useAuth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Navigation data for EnvRouter. The v2 app is mounted at the root.
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
    },
    {
      title: "Repositories",
      url: "/repo",
      icon: Folders,
    },
  ],
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

function ThemeSelector() {
  const { theme = "system", setTheme } = useTheme()
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton tooltip="Theme" aria-label={`Theme: ${current.label}`}>
            <current.icon className="h-4 w-4" />
            <span>
              Theme: <span className="text-muted-foreground">{current.label}</span>
            </span>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.value} value={t.value}>
              <t.icon className="mr-2 h-4 w-4" aria-hidden="true" />
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CollapseButton() {
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"
  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      tooltip="Expand sidebar"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
      ) : (
        <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
      )}
      <span>Collapse</span>
    </SidebarMenuButton>
  )
}

function UserBlock({ auth }: { auth: AuthInfo }) {
  const logout = () => {
    axios.post(`${BASE_PATH}/auth/logout`).finally(() => {
      // the auth gate redirects to the login flow on reload
      window.location.reload()
    })
  }
  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={auth.userIdentifier}
          className="pointer-events-none"
          aria-label={`Signed in as ${auth.userIdentifier}`}
        >
          <UserRound className="h-4 w-4" aria-hidden="true" />
          <span
            className="truncate"
            title={[auth.fullName, auth.email].filter(Boolean).join(' · ') || undefined}
          >
            {auth.userIdentifier}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Log out" onClick={logout} aria-label="Log out">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

export function AppSidebar({
  auth,
  ...props
}: React.ComponentProps<typeof Sidebar> & { auth?: AuthInfo | null }) {
  const { pathname } = useLocation()
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        {/* no own padding: header's p-2 gives the logo a constant 8px left
            offset, which is also dead-center in the 48px collapsed rail.
            fixed h-8 so hiding the (slightly taller) text can't shift the
            logo vertically during the collapse animation */}
        <div className="flex h-8 items-center gap-2">
          <img src="/logo.svg" alt="" className="h-8 w-8 max-w-none shrink-0" />
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">EnvRouter</span>
            <span className="truncate text-xs text-muted-foreground">Continuous Delivery</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={pathname === item.url || pathname === `${item.url}/`}
                    tooltip={item.title}
                    render={<Link to={item.url} />}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarSeparator className="mx-0 my-2 group-data-[collapsible=icon]:hidden" />
              <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
                <SidebarMenuButton render={<Link to="/v1" />}>
                  <History className="h-4 w-4" aria-hidden="true" />
                  <span>Back to v1 (MUI)</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {auth?.enabled && auth.authenticated && <UserBlock auth={auth} />}
          <SidebarMenuItem>
            <ThemeSelector />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CollapseButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
