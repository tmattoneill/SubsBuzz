"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useState } from "react"

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

interface ThemeColorSelectorProps {
  value?: string;
  onChange?: (color: string) => void;
}

export function ThemeColorSelector({ value = "blue", onChange }: ThemeColorSelectorProps) {
  const { theme } = useTheme()
  const [colorTheme, setColorTheme] = useState<string>(value)
  
  // Apply theme color to CSS variables
  const applyThemeColor = (color: string) => {
    const themeConfig = getThemeConfig(color);
    document.documentElement.style.setProperty('--color-primary-hue', themeConfig.primaryHue);
    document.documentElement.style.setProperty('--color-primary-saturation', themeConfig.primarySat);
    document.documentElement.style.setProperty('--color-accent-hue', themeConfig.accentHue);
    document.documentElement.style.setProperty('--color-accent-saturation', themeConfig.accentSat);
  };
  
  // Update local state when value prop changes
  React.useEffect(() => {
    setColorTheme(value)
    // Apply the color theme immediately
    applyThemeColor(value)
  }, [value])
  
  // Listen for theme color change events
  React.useEffect(() => {
    const handleThemeColorEvent = (event: CustomEvent) => {
      const newColor = event.detail;
      setColorTheme(newColor);
      applyThemeColor(newColor);
    };
    
    window.addEventListener('themeColorChange', handleThemeColorEvent as EventListener);
    return () => window.removeEventListener('themeColorChange', handleThemeColorEvent as EventListener);
  }, []);
  
  const handleColorChange = (newValue: string) => {
    setColorTheme(newValue)
    
    // Apply theme color
    applyThemeColor(newValue)
    
    // Call the onChange callback if provided
    onChange?.(newValue)
  }
  
  interface ThemeConfig {
    primaryHue: string;
    primarySat: string;
    accentHue: string;
    accentSat: string;
    color: string;
  }
  
  const getThemeConfig = (theme: string): ThemeConfig => {
    switch (theme) {
      case "blue":
        return { 
          primaryHue: "210", 
          primarySat: "90%", 
          accentHue: "141", 
          accentSat: "73%", 
          color: "bg-blue-500" 
        };
      case "green":
        return { 
          primaryHue: "150", 
          primarySat: "80%", 
          accentHue: "210", 
          accentSat: "90%", 
          color: "bg-green-500" 
        };
      case "purple":
        return { 
          primaryHue: "270", 
          primarySat: "80%", 
          accentHue: "330", 
          accentSat: "80%", 
          color: "bg-purple-500" 
        };
      case "teal":
        return { 
          primaryHue: "180", 
          primarySat: "75%", 
          accentHue: "45", 
          accentSat: "95%", 
          color: "bg-teal-500" 
        };
      case "red":
        return { 
          primaryHue: "0", 
          primarySat: "85%", 
          accentHue: "210", 
          accentSat: "90%", 
          color: "bg-red-500" 
        };
      case "amber":
        return { 
          primaryHue: "45", 
          primarySat: "95%", 
          accentHue: "210", 
          accentSat: "90%", 
          color: "bg-amber-500" 
        };
      default:
        return { 
          primaryHue: "210", 
          primarySat: "90%", 
          accentHue: "141", 
          accentSat: "73%", 
          color: "bg-blue-500" 
        };
    }
  }

  const themes = [
    { name: "blue", color: "bg-blue-500" },
    { name: "green", color: "bg-green-500" },
    { name: "purple", color: "bg-purple-500" },
    { name: "teal", color: "bg-teal-500" },
    { name: "red", color: "bg-red-500" },
    { name: "amber", color: "bg-amber-500" }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((t) => (
        <button
          key={t.name}
          className={`w-6 h-6 rounded-full ${t.color} transition-all duration-200 
            ${colorTheme === t.name ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'hover:scale-110'}`}
          onClick={() => handleColorChange(t.name)}
          title={t.name.charAt(0).toUpperCase() + t.name.slice(1)}
        />
      ))}
    </div>
  )
}