// Desktop side tab navigation for Content Engine
// US-001: Content Engine page shell with tab navigation

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLightbulb,
  faPaintBrush,
  faCalendar,
  faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import type { ContentEngineTab } from '@/types/contentEngine';

interface SideTabBarProps {
  activeTab: ContentEngineTab;
  onTabChange: (tab: ContentEngineTab) => void;
}

const TABS: { id: ContentEngineTab; label: string; icon: typeof faLightbulb }[] = [
  { id: 'ideas', label: 'Ideas', icon: faLightbulb },
  { id: 'create', label: 'Create', icon: faPaintBrush },
  { id: 'calendar', label: 'Calendar', icon: faCalendar },
  { id: 'brand', label: 'Brand', icon: faBullhorn },
];

export function SideTabBar({ activeTab, onTabChange }: SideTabBarProps) {
  return (
    <nav className="flex flex-col gap-1 p-2 pt-4">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            role="tab"
            className={`
              flex flex-col items-center justify-center gap-1 py-3 px-2 rounded transition-all
              ${isActive
                ? 'bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }
            `}
          >
            <FontAwesomeIcon
              icon={tab.icon}
              className={`text-xl ${isActive ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''}`}
            />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
