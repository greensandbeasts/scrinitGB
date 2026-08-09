import { type ReactNode } from 'react';
import { IndustryDiscover } from '@/pages/industry/IndustryDiscover';
import { IndustryScreenplayDetail } from '@/pages/industry/IndustryScreenplayDetail';
import { IndustryRequests } from '@/pages/industry/IndustryRequests';
import { SettingsPage } from '@/pages/shared/SettingsPage';
import { ProfilePage } from '@/pages/shared/ProfilePage';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';
import { IndustryWatchlists } from '@/pages/industry/IndustryWatchlists';

interface IndustryLayoutProps {
  route: string;
  navigate: (to: string) => void;
}

export function IndustryLayout({ route, navigate }: IndustryLayoutProps) {
  let content: ReactNode;

  if (route === '/industry/discover' || route === '/industry' || route === '/industry/') {
    content = <IndustryDiscover navigate={navigate} />;
  } else if (route.startsWith('/industry/screenplay/')) {
    const id = route.split('/industry/screenplay/')[1];
    content = <IndustryScreenplayDetail screenplayId={id} navigate={navigate} />;
  } else if (route === '/industry/requests') {
    content = <IndustryRequests navigate={navigate} />;
  } else if (route === '/industry/watchlists') {
    content = <IndustryWatchlists navigate={navigate} />;
  } else if (route === '/industry/settings') {
    content = <SettingsPage navigate={navigate} />;
  } else if (route === '/industry/profile') {
    content = <ProfilePage navigate={navigate} />;
  } else if (route === '/industry/notifications') {
    content = <NotificationsPage navigate={navigate} />;
  } else {
    content = <IndustryDiscover navigate={navigate} />;
  }

  return <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in">{content}</div>;
}
