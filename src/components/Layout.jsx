import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Building2, Users, DollarSign, Wrench, 
  FileText, TrendingUp, ShieldCheck, Store, ChevronRight,
  Bell, Settings, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/Dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/Properties', label: 'Properties', icon: Building2 },
  { path: '/Tenants', label: 'Tenants', icon: Users },
  { path: '/Finances', label: 'Finances', icon: DollarSign },
  { path: '/Maintenance', label: 'Maintenance', icon: Wrench },
  { path: '/Leases', label: 'Leases', icon: FileText },
  { path: '/Compliance', label: 'Compliance', icon: ShieldCheck },
  { path: '/ROI', label: 'ROI & Growth', icon: TrendingUp },
  { path: '/Pipeline', label: 'Pipeline', icon: Store },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background font-inter overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-secondary flex flex-col transition-transform duration-300 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-wide">LandlordOS</div>
            <div className="text-white/40 text-xs">Property Dashboard</div>
          </div>
          <button className="ml-auto lg:hidden text-white/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active 
                    ? "bg-primary text-white shadow-sm" 
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <div className="text-white/30 text-xs">Blueprint v2.1 · March 2026</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}