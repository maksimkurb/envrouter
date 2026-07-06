import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useTheme } from "next-themes"
import {
  Home,
  Folders,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Sun,
} from "lucide-react"
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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Navigation data for EnvRouter. Paths are relative to the /v2 router mount.
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/v2",
      icon: Home,
    },
    {
      title: "Repositories",
      url: "/v2/repo",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/v2" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Route className="size-4" aria-hidden="true" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">EnvRouter</span>
                <span className="truncate text-xs text-muted-foreground">
                  Continuous Delivery
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
