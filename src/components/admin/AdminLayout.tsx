import { type ReactNode } from 'react';
import { AdminOverview } from '@/pages/admin/AdminOverview';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminScreenplays } from '@/pages/admin/AdminScreenplays';
import { AdminScreenplayDetail } from '@/pages/admin/AdminScreenplayDetail';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminContribution } from '@/pages/admin/AdminContribution';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';

interface AdminLayoutProps {
  route: string;
  navigate: (to: string) => void;
}

export function AdminLayout({ route, navigate }: AdminLayoutProps) {
  let content: ReactNode;

  if (route === '/admin' || route === '/admin/') {
    content = <AdminOverview navigate={navigate} />;
  } else if (route === '/admin/users') {
    content = <AdminUsers />;
  } else if (route === '/admin/screenplays') {
    content = <AdminScreenplays navigate={navigate} />;
  } else if (route.startsWith('/admin/screenplay/')) {
    const id = route.split('/admin/screenplay/')[1];
    content = <AdminScreenplayDetail screenplayId={id} navigate={navigate} />;
  } else if (route === '/admin/contribution') {
    content = <AdminContribution navigate={navigate} />;
  } else if (route === '/admin/settings') {
    content = <AdminSettings navigate={navigate} />;
  } else if (route === '/admin/notifications') {
    content = <NotificationsPage navigate={navigate} />;
  } else {
    content = <AdminOverview navigate={navigate} />;
  }

  return <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in">{content}</div>;
}
