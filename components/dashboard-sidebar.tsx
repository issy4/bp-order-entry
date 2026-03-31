"use client"

import { useState } from "react"
import { 
  ClipboardList, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  Menu,
  X,
  FileText,
  Truck,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const menuItems = [
  { 
    icon: ClipboardList, 
    label: "受注入力", 
    href: "#",
    active: true 
  },
  { 
    icon: Package, 
    label: "在庫管理", 
    href: "#",
    active: false 
  },
  { 
    icon: Users, 
    label: "顧客管理", 
    href: "#",
    active: false 
  },
  { 
    icon: FileText, 
    label: "請求書", 
    href: "#",
    active: false 
  },
  { 
    icon: Truck, 
    label: "配送管理", 
    href: "#",
    active: false 
  },
  { 
    icon: BarChart3, 
    label: "レポート", 
    href: "#",
    active: false 
  },
  { 
    icon: Settings, 
    label: "設定", 
    href: "#",
    active: false 
  },
]

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        <span className="sr-only">メニューを開く</span>
      </Button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ERPシステム</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    item.active 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-medium">
              YT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">山田 太郎</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">営業部</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
