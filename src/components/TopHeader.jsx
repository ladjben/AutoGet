import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VIEW_TITLES } from '@/constants/viewTitles';

/**
 * Header commun. Badge « Admin » conservé tel quel (risque R12 — hors scope).
 */
const TopHeader = ({ user, isAdmin: _isAdmin, isMobile, onMenuClick, activeView }) => {
  const pageTitle = VIEW_TITLES[activeView] || 'COSMOS ALGÉRIE';
  // Badge « Admin » volontairement hardcodé (R12 hors scope redesign).
  void _isAdmin;

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border/80 bg-card/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-9 w-9 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {pageTitle}
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Cosmos Algérie · AutoGet
            </p>
          </div>
          {!isMobile && (
            <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">
              Admin
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-sm font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden max-w-[140px] truncate text-sm sm:inline">
                  {user?.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.username}</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
