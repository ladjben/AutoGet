import React, { useState } from 'react';
import { LayoutDashboard, Package, ArrowDownLeft, Building2, PiggyBank, Boxes, Users, Menu, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

// Configuration des items de navigation avec catégories
const navSections = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'INVENTORY MANAGEMENT',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'entries', label: 'Inventory', icon: ArrowDownLeft },
      { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { id: 'depenses', label: 'Dépenses', icon: PiggyBank },
      { id: 'colis', label: 'Colis Envoyés', icon: Boxes },
      { id: 'salaries', label: 'Salariés', icon: Users },
    ],
  },
];

const Sidebar = ({ activeView, setActiveView, user, logout, isAdmin, isUser, isMobile, sheetOpen, setSheetOpen }) => {
  const handleNavClick = (viewId) => {
    setActiveView(viewId);
    if (isMobile) {
      setSheetOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo et titre */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">C</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-foreground">COSMOS ALGÉRIE</h1>
            <span className="text-xs text-muted-foreground">Admin Dashboard</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-10",
                      isActive && "bg-sidebar-accent text-sidebar-foreground"
                    )}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User info et logout en bas */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="px-3 py-2 rounded-md bg-sidebar-accent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">{user?.name}</span>
            {isAdmin() && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </div>
  );

  // Mobile: Sheet (drawer)
  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-r border-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Sidebar fixe
  return (
    <aside className="w-64 border-r border-border bg-sidebar flex-shrink-0 h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;

