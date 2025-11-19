import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ProfileCenter } from '@/components/profile/ProfileCenter';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as 'showcase' | 'playground' | 'activity' | 'achievements' | null;
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'activity' | 'achievements'>(tabParam || 'showcase');
  const isOwnProfile = username === user?.username;

  // Update tab when query parameter changes
  useEffect(() => {
    if (tabParam && ['showcase', 'playground', 'activity', 'achievements'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Redirect to user's own profile if no username in URL and logged in
  useEffect(() => {
    if (!username && user?.username) {
      navigate(`/${user.username}`, { replace: true });
    }
  }, [username, user?.username, navigate]);

  // For logged-out users, force showcase tab
  useEffect(() => {
    if (!isAuthenticated && activeTab !== 'showcase') {
      setActiveTab('showcase');
    }
  }, [isAuthenticated, activeTab]);

  return (
    <DashboardLayout>
      {({ openChat }) => (
        <div className="flex h-full overflow-hidden">
          {/* Center Profile */}
          <ProfileCenter
            username={username}
            user={user}
            isAuthenticated={isAuthenticated}
            isOwnProfile={isOwnProfile}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenChat={openChat}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
