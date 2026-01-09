import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo,
  faRoute,
  faPlay,
  faLock,
  faWandMagicSparkles,
  faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface CreatorToolCard {
  title: string;
  description: string;
  icon: typeof faVideo;
  href: string;
  color: string;
  colorTo: string;
  isAvailable: boolean;
  badge?: string;
}

const CREATOR_TOOLS: CreatorToolCard[] = [
  {
    title: 'Social Clip Creator',
    description: 'Create animated educational clips for LinkedIn and YouTube. Chat with AI to build and refine your content.',
    icon: faVideo,
    href: '/create/social-clip',
    color: '#22D3EE', // cyan
    colorTo: '#10B981', // green
    isAvailable: true,
    badge: 'NEW',
  },
  {
    title: 'Brand Voice',
    description: 'Define your unique tone of voice and style. Your clips will automatically match your brand personality.',
    icon: faBullhorn,
    href: '/account/settings/brand-voice',
    color: '#A855F7', // purple
    colorTo: '#EC4899', // pink
    isAvailable: true,
  },
  {
    title: 'Learning Path Builder',
    description: 'Create and share custom learning paths. Curate content from lessons, tools, and projects.',
    icon: faRoute,
    href: '/create/learning-path',
    color: '#F59E0B', // amber
    colorTo: '#EF4444', // red
    isAvailable: false,
    badge: 'COMING SOON',
  },
];

export default function CreatePage() {
  const { user } = useAuth();

  // Admin-only feature check
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center glass-panel p-8 rounded-2xl max-w-md">
            <FontAwesomeIcon icon={faLock} className="text-4xl text-muted mb-4" />
            <h1 className="text-2xl font-bold mb-2">Creator Tools</h1>
            <p className="text-secondary">
              Creator Tools is currently in beta and only available to admins.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto">
        {/* Hero Banner */}
        <header className="relative h-64 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          {/* Ambient Glow Background */}
          <div
            className="absolute top-1/2 left-1/4 -translate-x-1/4 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none opacity-30 dark:opacity-100"
            style={{ background: 'rgba(34, 211, 238, 0.15)' }}
          />
          <div
            className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-30 dark:opacity-100"
            style={{ background: 'rgba(16, 185, 129, 0.1)' }}
          />

          <div className="relative px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xl text-cyan-500 dark:text-cyan-400" />
              </div>
              <h1 className="text-4xl font-bold">
                <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-green-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-green-400 bg-clip-text text-transparent">
                  Creator Tools
                </span>
              </h1>
            </div>
            <p className="text-xl text-slate-600 dark:text-gray-300 max-w-2xl">
              Build content that grows your audience. Create animated clips, learning paths, and more.
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {CREATOR_TOOLS.map((tool) => {
              const CardContent = (
                <div
                  className={`
                    group relative overflow-hidden rounded-2xl p-6
                    transition-all duration-300
                    ${tool.isAvailable ? 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer' : 'opacity-60 cursor-not-allowed'}
                  `}
                  style={{
                    background: `linear-gradient(135deg, ${tool.color}10, ${tool.colorTo}05)`,
                    border: `1px solid ${tool.color}30`,
                  }}
                >
                  {/* Hover Glow */}
                  {tool.isAvailable && (
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at center, ${tool.color}20, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Badge */}
                  {tool.badge && (
                    <div className="absolute top-4 right-4">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${tool.isAvailable
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 animate-pulse'
                            : 'bg-slate-500/20 text-slate-500 dark:text-gray-400 border border-slate-500/30 dark:border-gray-500/30'
                          }
                        `}
                      >
                        {tool.badge}
                      </span>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${tool.color}25, ${tool.colorTo}15)`,
                    }}
                  >
                    <FontAwesomeIcon
                      icon={tool.isAvailable ? tool.icon : faLock}
                      className="text-2xl"
                      style={{ color: tool.color }}
                    />
                  </div>

                  {/* Title */}
                  <h3
                    className={`font-bold text-xl mb-2 transition-colors ${
                      tool.isAvailable
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tool.title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                    {tool.description}
                  </p>

                  {/* Action */}
                  {tool.isAvailable && (
                    <div className="flex items-center gap-2 text-sm font-medium" style={{ color: tool.color }}>
                      <span>Get Started</span>
                      <FontAwesomeIcon
                        icon={faPlay}
                        className="text-xs group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  )}
                </div>
              );

              return tool.isAvailable ? (
                <Link key={tool.title} to={tool.href}>
                  {CardContent}
                </Link>
              ) : (
                <div key={tool.title}>
                  {CardContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
