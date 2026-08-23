"use client"

import * as React from "react"

/**
 * Shell state shared between the sidebar and the page header.
 *
 * The mobile drawer trigger belongs in the header's flow (§18.3) rather than
 * floating over it, so the header needs to open a drawer the sidebar owns.
 */

type ShellContextValue = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const ShellContext = React.createContext<ShellContextValue | null>(null)

export function useShell() {
  const ctx = React.useContext(ShellContext)
  if (!ctx) throw new Error("useShell must be used within <ShellProvider>")
  return ctx
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  const value = React.useMemo(
    () => ({ drawerOpen, setDrawerOpen, collapsed, setCollapsed }),
    [drawerOpen, collapsed]
  )

  return <ShellContext value={value}>{children}</ShellContext>
}
