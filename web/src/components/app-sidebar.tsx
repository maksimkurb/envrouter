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
  Undo2,
  UserRound,
} from "lucide-react"
import { BASE_PATH } from "@/axios/base"
import { Button } from "@/components/ui/button"
import { initialsOf, useGravatar } from "@/lib/gravatar"
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
      title: "History",
      url: "/history",
      icon: History,
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

function accessMode(auth: AuthInfo): string {
  if (auth.canConfigure) return "Administrator"
  if (auth.canDeploy) return "Editor"
  return "View only"
}

// Card with avatar + name + access mode + logout. Mirrors SidebarMenuButton's
// collapse mechanics: constant p-2 + overflow-hidden, the box shrinking to
// size-8 in the icon rail. The avatar is the first child (left edge fixed at
// 8px), and it shrinks in place from size-8 to size-4 — so it never slides
// sideways, it just scales down and lands centered (8+16+8=32). Text + logout
// clip and are hidden in collapsed.
function UserBlock({ auth }: { auth: AuthInfo }) {
  const avatar = useGravatar(auth.email, 96)
  const [imgFailed, setImgFailed] = React.useState(false)
  const logout = () => {
    axios.post(`${BASE_PATH}/auth/logout`).finally(() => {
      // the auth gate redirects to the login flow on reload
      window.location.reload()
    })
  }
  const displayName = auth.fullName || auth.userIdentifier || "User"
  return (
    <div className="mb-1 flex w-full items-center gap-2 overflow-hidden rounded-lg border bg-card p-2 transition-[width,height,padding] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-1.5! group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent">
      {avatar && !imgFailed ? (
        <img
          src={avatar}
          alt=""
          title={displayName}
          onError={() => setImgFailed(true)}
          className="size-8 shrink-0 rounded-full bg-muted object-cover transition-[width,height] group-data-[collapsible=icon]:size-5"
        />
      ) : (
        <div
          title={displayName}
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold leading-none text-primary transition-[width,height] group-data-[collapsible=icon]:size-5 group-data-[collapsible=icon]:text-[9px]"
        >
          {initialsOf(displayName)}
        </div>
      )}
      <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-medium" title={displayName}>
          {displayName}
        </span>
        <span className="truncate text-xs text-muted-foreground">{accessMode(auth)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={logout}
        aria-label="Log out"
        title="Log out"
        className="shrink-0 group-data-[collapsible=icon]:hidden"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
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
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  <span>Back to v1 (MUI)</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {auth?.enabled && auth.authenticated && <UserBlock auth={auth} />}
        <SidebarMenu>
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
