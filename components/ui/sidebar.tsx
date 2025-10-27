"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Home, Ticket, Plus, Settings, Workflow, Users, BarChart3, Menu, X } from "lucide-react";

interface SidebarProps {
  className?: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: "Navigation",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: Home,
      },
      {
        title: "Create Ticket",
        href: "/tickets/create",
        icon: Plus,
      },
      {
        title: "Admin Dashboard",
        href: "/admin",
        icon: Settings,
      },
      {
        title: "Workflows",
        href: "/admin/workflows",
        icon: Workflow,
      },
    ],
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    // For exact matches, check if pathname equals href or href with trailing slash
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    // For other routes, use startsWith
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className={cn("flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300", isCollapsed ? "w-16" : "w-64", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Ticket className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-gray-900">Ticketing</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={toggleCollapse} className="h-8 w-8 p-0 hover:bg-gray-100">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-6 px-3">
          {navigationSections.map((section) => (
            <div key={section.title}>
              {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{section.title}</h3>}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={cn("flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors", "hover:bg-gray-100 hover:text-gray-900", active ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700" : "text-gray-600", isCollapsed && "justify-center")}>
                        <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {item.badge && <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{item.badge}</span>}
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">Real Estate Ticketing System</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" onClick={toggleMobile} className="bg-white shadow-md">
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMobile} />}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SidebarContent />
      </div>

      {/* Mobile sidebar */}
      <div className={cn("lg:hidden fixed left-0 top-0 z-40 h-full transition-transform duration-300", isMobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <SidebarContent />
      </div>
    </>
  );
}
