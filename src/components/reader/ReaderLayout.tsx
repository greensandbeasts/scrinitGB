import { type ReactNode } from 'react';
import { ReaderAssignments } from '@/pages/reader/ReaderAssignments';
import { ReaderReading } from '@/pages/reader/ReaderReading';
import { ReaderFeedback } from '@/pages/reader/ReaderFeedback';
import { ReaderAnalytics } from '@/pages/reader/ReaderAnalytics';
import { ReaderReview } from '@/pages/reader/ReaderReview';
import { SettingsPage } from '@/pages/shared/SettingsPage';
import { ProfilePage } from '@/pages/shared/ProfilePage';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';
import { ReaderHistory } from '@/pages/reader/ReaderHistory';
import { ReaderContribution } from '@/pages/reader/ReaderContribution';

interface ReaderLayoutProps {
  route: string;
  navigate: (to: string) => void;
}

export function ReaderLayout({ route, navigate }: ReaderLayoutProps) {
  let content: ReactNode;

  if (route.startsWith('/reader/read/')) {
    const id = route.split('/reader/read/')[1];
    content = <ReaderReading assignmentId={id} navigate={navigate} />;
  } else if (route.startsWith('/reader/feedback/')) {
    const id = route.split('/reader/feedback/')[1];
    content = <ReaderFeedback assignmentId={id} navigate={navigate} />;
  } else if (route.startsWith('/reader/analytics/')) {
    const id = route.split('/reader/analytics/')[1];
    content = <ReaderAnalytics screenplayId={id} navigate={navigate} />;
  } else if (route.startsWith('/reader/review/')) {
    const id = route.split('/reader/review/')[1];
    content = <ReaderReview screenplayId={id} navigate={navigate} />;
  } else if (route === '/reader/assignments') {
    content = <ReaderAssignments navigate={navigate} />;
  } else if (route === '/reader/history') {
    content = <ReaderHistory navigate={navigate} />;
  } else if (route === '/reader/contribution') {
    content = <ReaderContribution navigate={navigate} />;
  } else if (route === '/reader/settings') {
    content = <SettingsPage navigate={navigate} />;
  } else if (route === '/reader/profile') {
    content = <ProfilePage navigate={navigate} />;
  } else if (route === '/reader/notifications') {
    content = <NotificationsPage navigate={navigate} />;
  } else {
    content = <ReaderAssignments navigate={navigate} />;
  }

  return <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in">{content}</div>;
}
