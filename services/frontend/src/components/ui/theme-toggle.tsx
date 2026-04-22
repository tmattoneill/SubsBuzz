"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="sm"
        className="w-9 h-6 px-1 rounded-full transition-all duration-300"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <div className="relative w-full h-full">
          <Sun className="absolute left-0.5 h-4 w-4 rotate-0 scale-100 transition-all text-yellow-500 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute right-0.5 h-4 w-4 rotate-90 scale-0 transition-all text-blue-400 dark:rotate-0 dark:scale-100" />
        </div>
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  )
}
