import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ProfileCenter } from '@/components/profile/ProfileCenter';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'activity'>('showcase');
  const isOwnProfile = username === user?.username;

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
