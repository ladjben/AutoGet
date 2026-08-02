import React from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowDownLeft,
  Building2,
  PiggyBank,
  Boxes,
  Users,
  LogOut,
  ClipboardCheck,
  Link2,
  Store,
  ListChecks,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import cosmosLogo from '../assets/cosmos-logo.svg';

const adminNavSections = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Inventaire',
    items: [
      { id: 'products', label: 'Produits', icon: Package },
      { id: 'entries', label: 'Entrées stock', icon: ArrowDownLeft },
      {
        id: 'pending-entries',
        label: 'En attente de validation',
        icon: Clock,
        adminOnly: true,
      },
      { id: 'validated-entries', label: 'Entrées validées', icon: ListChecks },
      { id: 'suppliers', label: 'Fournisseurs', icon: Building2 },
    ],
  },
  {
    title: 'Opérations',
    items: [
      { id: 'depenses', label: 'Dépenses', icon: PiggyBank },
      { id: 'colis', label: 'Colis envoyés', icon: Boxes },
      { id: 'salaries', label: 'Salariés', icon: Users },
    ],
  },
  {
    title: 'Réception',
    items: [
      { id: 'employee-validation', label: 'Valider réception', icon: ClipboardCheck },
      { id: 'supplier-access', label: 'Accès & assignation', icon: Link2 },
    ],
  },
];

const fournisseurNavSections = [
  {
    title: 'Mon espace',
    items: [
      { id: 'supplier-portal', label: 'Portail fournisseur', icon: Store },
    ],
  },
];

const employeNavSections = [
  {
    title: 'Réception',
    items: [
      { id: 'employee-validation', label: 'Valider la marchandise', icon: ClipboardCheck },
    ],
  },
];

const Sidebar = ({
  activeView,
  setActiveView,
  user,
  logout,
  isAdmin,
  isFournisseur,
  isEmploye,
  isMobile,
  sheetOpen,
  setSheetOpen,
}) => {
  const navSections = isFournisseur?.()
    ? fournisseurNavSections
    : isEmploye?.()
      ? employeNavSections
      : adminNavSections;

  const subtitle = isFournisseur?.()
    ? 'Portail fournisseur'
    : isEmploye?.()
      ? 'Réception marchandise'
      : 'Espace administration';

  const handleNavClick = (viewId) => {
    setActiveView(viewId);
    if (isMobile) {
      setSheetOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-primary/10">
            <img src={cosmosLogo} alt="Cosmos" className="h-7 w-auto" />
          </div>
          <div className="min-w-0 flex-col">
            <h1 className="font-display truncate text-base font-semibold tracking-wide text-foreground">
              COSMOS ALGÉRIE
            </h1>
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items
                .filter((item) => !item.adminOnly || isAdmin?.())
                .map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
          <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      'h-10 w-full justify-start gap-3 rounded-md px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive
                        ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                    <span className="truncate">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border/80 p-3">
        <div className="rounded-md border border-border/60 bg-sidebar-accent/80 px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">{user?.name}</span>
            {isAdmin?.() && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Admin
              </Badge>
            )}
            {isFournisseur?.() && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Fournisseur
              </Badge>
            )}
            {isEmploye?.() && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Employé
              </Badge>
            )}
          </div>
          {user?.username ? (
            <p className="truncate text-[11px] text-muted-foreground">@{user.username}</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[280px] border-r border-border bg-sidebar p-0">
          {/* Sheet = Dialog Radix : titre accessible requis (branding déjà dans le panneau). */}
          <SheetTitle className="sr-only">Navigation principale</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-shrink-0 border-r border-border bg-sidebar">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;
