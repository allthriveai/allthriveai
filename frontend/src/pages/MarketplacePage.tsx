/**
 * MarketplacePage - Coming Soon landing page for the creator marketplace
 * Will feature courses, prompt packs, templates, and digital products
 * Supports both light and dark themes with neon glass aesthetic
 */

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStore,
  faGraduationCap,
  faLightbulb,
  faFileCode,
  faBolt,
  faRocket,
} from '@fortawesome/free-solid-svg-icons';

const PRODUCT_TYPES = [
  {
    icon: faGraduationCap,
    title: 'Online Courses',
    description: 'Learn from expert creators with structured video courses',
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-100',
    bgDark: 'dark:bg-blue-500/20',
  },
  {
    icon: faLightbulb,
    title: 'Prompt Packs',
    description: 'Ready-to-use AI prompts for various use cases',
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-amber-500/20',
  },
  {
    icon: faFileCode,
    title: 'Templates & Tools',
    description: 'Workflows, automations, and productivity templates',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-500/20',
  },
  {
    icon: faRocket,
    title: 'Digital Products',
    description: 'E-books, guides, and resources from the community',
    iconColor: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-100',
    bgDark: 'dark:bg-purple-500/20',
  },
];

export default function MarketplacePage() {
  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects - visible in dark mode only */}
          <div className="fixed inset-0 bg-grid-pattern opacity-0 dark:opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-blue-500/0 dark:bg-blue-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/0 dark:bg-purple-500/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Hero Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 dark:from-blue-500/5 to-transparent" />
              <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                {/* Coming Soon Badge */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-200 dark:border-blue-500/30 backdrop-blur-sm">
                    <FontAwesomeIcon icon={faBolt} className="text-blue-500 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Coming Soon</span>
                  </div>
                </div>

                {/* Main Icon */}
                <div className="flex justify-center mb-8">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-500/20 dark:to-purple-500/20 flex items-center justify-center shadow-lg dark:shadow-neon border border-blue-200 dark:border-white/10">
                    <FontAwesomeIcon icon={faStore} className="text-5xl text-blue-500 dark:text-blue-400" />
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white text-center mb-6">
                  Creator <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Marketplace</span>
                </h1>

                {/* Description */}
                <p className="text-xl text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-12 leading-relaxed">
                  Discover courses, prompt packs, and digital products created by the AllThrive community.
                  Or become a creator and share your expertise.
                </p>

                {/* Product Type Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                  {PRODUCT_TYPES.map((product, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 group hover:shadow-lg dark:hover:shadow-none"
                    >
                      <div className={`w-12 h-12 rounded-xl ${product.bgLight} ${product.bgDark} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <FontAwesomeIcon icon={product.icon} className={`text-xl ${product.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{product.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                    </div>
                  ))}
                </div>

                {/* CTA Section */}
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-blue-500/30 rounded-xl p-8 text-center shadow-lg dark:shadow-none dark:shadow-blue-500/10">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Want to Sell Your Products?
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    We're building a platform for creators to share and monetize their AI expertise.
                    Join the waitlist to be notified when we launch.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                      href="/explore"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg dark:shadow-neon-strong transition-all duration-300"
                    >
                      <FontAwesomeIcon icon={faBolt} />
                      Explore AllThrive
                    </a>
                    <span className="text-gray-500 dark:text-gray-500 text-sm">
                      Marketplace launching soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
