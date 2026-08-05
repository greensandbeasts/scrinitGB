import { type ReactNode } from 'react';
import { WriterDashboard } from '@/pages/writer/WriterDashboard';
import { WriterScreenplays } from '@/pages/writer/WriterScreenplays';
import { WriterScreenplayDetail } from '@/pages/writer/WriterScreenplayDetail';
import { WriterRequests } from '@/pages/writer/WriterRequests';
import { WriterUpload } from '@/pages/writer/WriterUpload';
import { SettingsPage } from '@/pages/shared/SettingsPage';
import { ProfilePage } from '@/pages/shared/ProfilePage';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';

interface WriterLayoutProps {
  route: string;
  navigate: (to: string) => void;
}

export function WriterLayout({ route, navigate }: WriterLayoutProps) {
  let content: ReactNode;

  if (route === '/writer' || route === '/writer/') {
    content = <WriterDashboard navigate={navigate} />;
  } else if (route === '/writer/screenplays') {
    content = <WriterScreenplays navigate={navigate} />;
  } else if (route.startsWith('/writer/screenplay/')) {
    const id = route.split('/writer/screenplay/')[1];
    content = <WriterScreenplayDetail screenplayId={id} navigate={navigate} />;
  } else if (route === '/writer/upload') {
    content = <WriterUpload navigate={navigate} />;
  } else if (route === '/writer/requests') {
    content = <WriterRequests navigate={navigate} />;
  } else if (route === '/writer/settings') {
    content = <SettingsPage navigate={navigate} />;
  } else if (route === '/writer/profile') {
    content = <ProfilePage navigate={navigate} />;
  } else if (route === '/writer/notifications') {
    content = <NotificationsPage navigate={navigate} />;
  } else {
    content = <WriterDashboard navigate={navigate} />;
  }

  return <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in">{content}</div>;
}
