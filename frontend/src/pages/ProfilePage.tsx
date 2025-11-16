import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ProfileCenter } from '@/components/profile/ProfileCenter';
import { RightChatPanel } from '@/components/chat/RightChatPanel';

export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'settings'>('showcase');
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);

  const handleCloseChat = () => {
    setChatOpen(false);
    setSelectedMenuItem(null);
  };

  return (
    <DashboardLayout>
      <div className="flex h-full overflow-hidden">
        {/* Center Profile */}
        <ProfileCenter
          user={user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Right Chat Panel */}
        <RightChatPanel
          isOpen={chatOpen}
          onClose={handleCloseChat}
          selectedMenuItem={selectedMenuItem}
        />

        {/* Overlay when chat is open */}
        {chatOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={handleCloseChat}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
