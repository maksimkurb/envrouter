import * as React from "react"
import { Settings } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons"

export function VersionSwitcher({
  versions,
  defaultVersion,
}: {
  versions: string[]
  defaultVersion: string
}) {
  const [selectedVersion, setSelectedVersion] = React.useState(defaultVersion)

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version)
    // Navigate to appropriate version
    if (version.includes("v1")) {
      window.location.href = "/" // Old MUI interface
    } else {
      window.location.href = "/v2" // New shadcn interface
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Settings className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">EnvRouter</span>
                <span className="text-xs">{selectedVersion}</span>
              </div>
              <CaretSortIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width]"
            align="start"
          >
            {versions.map((version) => (
              <DropdownMenuItem
                key={version}
                onSelect={() => handleVersionChange(version)}
              >
                {version}{" "}
                {version === selectedVersion && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
