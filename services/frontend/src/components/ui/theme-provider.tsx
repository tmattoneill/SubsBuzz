"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string | string[];
  defaultTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
  forcedTheme?: string;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({ 
  children, 
  ...props 
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={props.attribute || "class"}
      defaultTheme={props.defaultTheme}
      enableSystem={props.enableSystem}
      storageKey={props.storageKey}
      forcedTheme={props.forcedTheme}
      disableTransitionOnChange={props.disableTransitionOnChange}
    >
      {children}
    </NextThemesProvider>
  )
}