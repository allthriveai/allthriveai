// Content Engine - Single page with tabbed navigation
// US-001: Content Engine page shell with tab navigation

import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { TabBar } from '@/components/content-engine/tabs/TabBar';
import { SideTabBar } from '@/components/content-engine/tabs/SideTabBar';
import { IdeasTab } from '@/components/content-engine/tabs/IdeasTab';
import { CreateTab } from '@/components/content-engine/tabs/CreateTab';
import { CalendarTab } from '@/components/content-engine/tabs/CalendarTab';
import { BrandVoiceTab } from '@/components/content-engine/tabs/BrandVoiceTab';
import type { ContentEngineTab } from '@/types/contentEngine';

const VALID_TABS: ContentEngineTab[] = ['ideas', 'create', 'calendar', 'brand'];
const DEFAULT_TAB: ContentEngineTab = 'ideas';

function isValidTab(tab: string | undefined): tab is ContentEngineTab {
  return VALID_TABS.includes(tab as ContentEngineTab);
}

export default function ContentEnginePage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();

  // Validate and normalize tab parameter
  const activeTab: ContentEngineTab = isValidTab(tab) ? tab : DEFAULT_TAB;

  // Redirect invalid tabs to default
  useEffect(() => {
    if (tab && !isValidTab(tab)) {
      navigate('/create/content-engine/ideas', { replace: true });
    }
  }, [tab, navigate]);

  const handleTabChange = useCallback(
    (newTab: ContentEngineTab) => {
      navigate(`/create/content-engine/${newTab}`);
    },
    [navigate]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ideas':
        return <IdeasTab />;
      case 'create':
        return <CreateTab isActive={activeTab === 'create'} />;
      case 'calendar':
        return <CalendarTab />;
      case 'brand':
        return <BrandVoiceTab />;
      default:
        return <IdeasTab />;
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col md:flex-row">
        {/* Side Tab Bar (Desktop) */}
        <aside className="hidden md:flex flex-col w-20 glass-panel border-r border-slate-700/50 shrink-0">
          <SideTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-0 pb-14 md:pb-0">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderTabContent()}
          </div>
        </main>

        {/* Bottom Tab Bar (Mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-700/50 md:hidden z-50">
          <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </nav>
      </div>
    </DashboardLayout>
  );
}
