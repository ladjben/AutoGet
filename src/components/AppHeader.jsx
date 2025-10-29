import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Package, ArrowDownLeft, Building2, PiggyBank, Boxes, Users, Menu, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '../config/supabaseClient';
import { USE_SUPABASE } from '../config';
import { useData } from '../context/UnifiedDataContext';

// Hook pour détecter mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Configuration des items de navigation
const navItems = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'entries', label: 'Entrées de Stock', icon: ArrowDownLeft },
  { id: 'suppliers', label: 'Fournisseurs', icon: Building2 },
  { id: 'depenses', label: 'Dépenses', icon: PiggyBank },
  { id: 'colis', label: 'Colis Envoyés', icon: Boxes },
  { id: 'salaries', label: 'Salariés', icon: Users },
];

const AppHeader = ({ activeView, setActiveView, user, logout, isAdmin, isUser }) => {
  // Debug
  console.log('🚀 AppHeader chargé - version moderne avec shadcn/ui');
  console.log('📊 Props:', { activeView, user: user?.name, hasLogout: !!logout });
  
  const isMobile = useIsMobile();
  const [supabaseStatus, setSupabaseStatus] = useState({ ok: true, msg: '', count: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const dataCtx = useData();
  
  // Récupérer le count de produits depuis le contexte
  const produitsCount = USE_SUPABASE 
    ? (dataCtx?.produits?.length ?? 0)
    : (dataCtx?.state?.produits?.length ?? 0);

  // Vérifier le statut Supabase
  useEffect(() => {
    if (!USE_SUPABASE) {
      setSupabaseStatus({ ok: true, msg: 'LocalStorage', count: 0 });
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const { data, error } = await supabase.from('produits').select('id').limit(1);
        if (error) throw error;
        if (!cancelled) {
          const currentCount = USE_SUPABASE 
            ? (dataCtx?.produits?.length ?? 0)
            : (dataCtx?.state?.produits?.length ?? 0);
          setSupabaseStatus({ 
            ok: true, 
            msg: `OK — ${currentCount} produits`, 
            count: currentCount 
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSupabaseStatus({ ok: false, msg: e?.message || 'Erreur', count: 0 });
        }
      }
    };

    check();
    // Mettre à jour aussi quand produitsCount change
    if (!cancelled && produitsCount !== undefined) {
      setSupabaseStatus(prev => ({
        ...prev,
        msg: prev.ok ? `OK — ${produitsCount} produits` : prev.msg,
        count: produitsCount
      }));
    }
    
    return () => {
      cancelled = true;
    };
  }, [USE_SUPABASE, produitsCount, dataCtx?.produits?.length, dataCtx?.state?.produits?.length]);

  // Calculer quels items mettre dans "Plus" (overflow) sur desktop
  const getVisibleItems = useCallback(() => {
    if (isMobile) return navItems;
    // Pour desktop, on peut mettre les 2-3 derniers dans "Plus"
    // Ici on garde les 5 premiers visibles, les 2 derniers dans "Plus"
    const primary = navItems.slice(0, 5);
    const overflow = navItems.slice(5);
    return { primary, overflow };
  }, [isMobile]);

  const handleNavClick = (viewId) => {
    setActiveView(viewId);
  };

  const { primary, overflow } = getVisibleItems();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4">
        {/* Logo et Marque */}
        <div className="mr-4 flex items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              COSMOS ALGÉRIE
            </h1>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Gestion & Suivi
            </span>
          </div>
        </div>

        {/* Navigation Desktop */}
        {!isMobile && (
          <div className="flex-1 flex items-center justify-center gap-1">
            {primary.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleNavClick(item.id)}
                  className="gap-2"
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
            
            {/* Menu "Plus" pour les items overflow */}
            {overflow.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ChevronDown className="h-4 w-4" />
                    <span>Plus</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={cn(isActive && "bg-accent")}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Mobile Menu Button */}
        {isMobile && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Ouvrir le menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[300px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        handleNavClick(item.id);
                        setSheetOpen(false);
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="px-2 py-1 text-sm font-medium text-muted-foreground">
                  {user?.name}
                </div>
                {isAdmin() && (
                  <Badge variant="secondary" className="ml-2">
                    Administrateur
                  </Badge>
                )}
              </div>
              <Separator className="my-4" />
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => {
                  setSheetOpen(false);
                  logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </SheetContent>
          </Sheet>
        )}

        {/* Right side: Status, Badge, Logout */}
        <div className="ml-auto flex items-center gap-2">
          {/* Statut Supabase (petit pill) */}
          {USE_SUPABASE && (
            <Badge
              variant={supabaseStatus.ok ? "secondary" : "destructive"}
              className="text-[10px] px-2 py-0.5 hidden md:flex"
            >
              {supabaseStatus.ok ? '✓' : '✗'} {supabaseStatus.msg}
            </Badge>
          )}

          {/* Badge Rôle (Desktop only) */}
          {!isMobile && isAdmin() && (
            <Badge variant="secondary">
              Administrateur
            </Badge>
          )}

          {/* User info (Desktop only) */}
          {!isMobile && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate max-w-[120px]">{user?.name}</span>
            </div>
          )}

          {/* Logout Button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={logout}
            className="gap-2"
          >
            {isMobile ? <LogOut className="h-4 w-4" /> : null}
            <span>{isMobile ? '' : 'Déconnexion'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

