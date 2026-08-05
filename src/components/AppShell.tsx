import { type ReactNode, useState, useEffect, useRef } from 'react';
import {
  BookOpen, LogOut, Menu, X, ChevronDown,
  Sun, Moon, Monitor, PenTool, Eye, Building2,
  LayoutDashboard, FileText, Bell, User, Settings,
  Send, Clock, Heart, Compass, ListChecks, Inbox,
  Shield, Users as UsersIcon, BarChart3, Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABELS, SELECTABLE_ROLE_LABELS } from '@/lib/types';
import type { UserRole, SelectableRole, ThemePreference } from '@/lib/types';
import { WriterLayout } from '@/components/writer/WriterLayout';
import { ReaderLayout } from '@/components/reader/ReaderLayout';
import { IndustryLayout } from '@/components/industry/IndustryLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface AppShellProps {
  route: string;
  navigate: (to: string) => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: typeof BookOpen;
}

const NAV_ITEMS: Record<SelectableRole, NavItem[]> = {
  writer: [
    { label: 'Dashboard', path: '/writer', icon: LayoutDashboard },
    { label: 'Screenplays', path: '/writer/screenplays', icon: FileText },
    { label: 'Requests', path: '/writer/requests', icon: Inbox },
    { label: 'Notifications', path: '/writer/notifications', icon: Bell },
    { label: 'Profile', path: '/writer/profile', icon: User },
    { label: 'Settings', path: '/writer/settings', icon: Settings },
  ],
  reader: [
    { label: 'Dashboard', path: '/reader', icon: LayoutDashboard },
    { label: 'Assigned Reading', path: '/reader/assignments', icon: BookOpen },
    { label: 'Reading History', path: '/reader/history', icon: Clock },
    { label: 'Contribution', path: '/reader/contribution', icon: Heart },
    { label: 'Notifications', path: '/reader/notifications', icon: Bell },
    { label: 'Profile', path: '/reader/profile', icon: User },
    { label: 'Settings', path: '/reader/settings', icon: Settings },
  ],
  industry: [
    { label: 'Dashboard', path: '/industry', icon: LayoutDashboard },
    { label: 'Discover', path: '/industry/discover', icon: Compass },
    { label: 'Watchlists', path: '/industry/watchlists', icon: ListChecks },
    { label: 'Introduction Requests', path: '/industry/requests', icon: Send },
    { label: 'Notifications', path: '/industry/notifications', icon: Bell },
    { label: 'Profile', path: '/industry/profile', icon: User },
    { label: 'Settings', path: '/industry/settings', icon: Settings },
  ],
};

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard },
  { label: 'Users', path: '/admin/users', icon: UsersIcon },
  { label: 'Screenplays', path: '/admin/screenplays', icon: FileText },
  { label: 'Contribution', path: '/admin/contribution', icon: Zap },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
];

const ROLE_ICONS: Record<SelectableRole, typeof BookOpen> = {
  writer: PenTool,
  reader: Eye,
  industry: Building2,
};

const THEME_ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function AppShell({ route, navigate }: AppShellProps) {
  const { profile, signOut, activeRole, userRoles, switchRole } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  const isAdmin = activeRole === 'admin';
  const navItems = isAdmin ? ADMIN_NAV : NAV_ITEMS[activeRole as SelectableRole] ?? [];
  const currentRoleLabel = isAdmin ? 'Administrator' : SELECTABLE_ROLE_LABELS[activeRole as SelectableRole];
  const CurrentRoleIcon = isAdmin ? Shield : ROLE_ICONS[activeRole as SelectableRole];
  const ThemeIcon = THEME_ICONS[theme];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRoleSwitch = async (role: SelectableRole) => {
    await switchRole(role);
    setRoleMenuOpen(false);
    navigate(`/${role}`);
  };

  const handleThemeCycle = () => {
    cycleTheme();
  };

  const isActive = (path: string) => {
    const basePath = isAdmin ? '/admin' : `/${activeRole}`;
    if (path === basePath) return route === path || route === `${basePath}/`;
    return route.startsWith(path);
  };

  const renderContent = (): ReactNode => {
    if (isAdmin) {
      return <AdminLayout route={route} navigate={navigate} />;
    }
    switch (activeRole) {
      case 'writer':
        return <WriterLayout route={route} navigate={navigate} />;
      case 'reader':
        return <ReaderLayout route={route} navigate={navigate} />;
      case 'industry':
        return <IndustryLayout route={route} navigate={navigate} />;
      default:
        return <WriterLayout route={route} navigate={navigate} />;
    }
  };

  const canSwitchRoles = !isAdmin && userRoles.length > 1;

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-ink-900 dark:bg-ink-900 text-white flex flex-col z-40 transition-transform duration-300 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center gap-2.5 border-b border-ink-800">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <div className="font-bold text-base">Scrinit</div>
            <div className="text-[10px] text-ink-400 uppercase tracking-wider">{currentRoleLabel}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(item.path) ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-ink-800 relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <Avatar name={profile.display_name} color={profile.avatar_color} size="sm" />
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">{profile.display_name}</div>
              <div className="text-xs text-ink-400 truncate">{profile.email}</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-ink-800 rounded-xl border border-ink-700 shadow-xl overflow-hidden animate-slide-down">
              <button
                onClick={() => { navigate(isAdmin ? '/admin/settings' : `/${activeRole}/settings`); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-ink-50/80 dark:bg-ink-950/80 backdrop-blur-xl border-b border-ink-100 dark:border-ink-800 h-14 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile menu button */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="lg:hidden text-ink-600 dark:text-ink-400">
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="lg:hidden font-bold text-ink-900 dark:text-white">Scrinit</span>
          </div>

          {/* Theme toggle + Role switcher */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={handleThemeCycle}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-ink-800 transition-all text-sm font-medium"
              title={`Theme: ${theme}`}
            >
              <ThemeIcon className="w-4 h-4" />
              <span className="hidden sm:inline capitalize">{theme}</span>
            </button>

            {/* Role switcher */}
            <div className="relative" ref={roleMenuRef}>
              <button
                onClick={() => canSwitchRoles && setRoleMenuOpen(!roleMenuOpen)}
                disabled={!canSwitchRoles}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  canSwitchRoles
                    ? 'text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800'
                    : 'text-ink-500 dark:text-ink-500 cursor-default'
                }`}
              >
                <CurrentRoleIcon className="w-4 h-4" />
                <span>{currentRoleLabel}</span>
                {canSwitchRoles && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />}
              </button>

              {roleMenuOpen && canSwitchRoles && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 shadow-lg overflow-hidden animate-slide-down">
                  <div className="px-3 py-2 text-[10px] font-medium text-ink-400 dark:text-ink-500 uppercase tracking-wider border-b border-ink-100 dark:border-ink-800">
                    Switch role
                  </div>
                  {userRoles.map((role) => {
                    const RoleIcon = ROLE_ICONS[role];
                    const isActiveRole = role === activeRole;
                    return (
                      <button
                        key={role}
                        onClick={() => handleRoleSwitch(role)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                          isActiveRole
                            ? 'bg-ink-50 dark:bg-ink-800 text-ink-900 dark:text-white font-medium'
                            : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'
                        }`}
                      >
                        <RoleIcon className="w-4 h-4" />
                        {SELECTABLE_ROLE_LABELS[role]}
                        {isActiveRole && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
