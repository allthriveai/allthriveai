import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ProfileCenter } from '@/components/profile/ProfileCenter';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground'>('showcase');

  // Redirect to user's own profile if no username in URL
  useEffect(() => {
    if (!username && user?.username) {
      navigate(`/${user.username}`, { replace: true });
    }
  }, [username, user?.username, navigate]);

  return (
    <DashboardLayout>
      <div className="flex h-full overflow-hidden">
        {/* Center Profile */}
        <ProfileCenter
          user={user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </DashboardLayout>
  );
}
