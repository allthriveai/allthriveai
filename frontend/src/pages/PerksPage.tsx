/**
 * PerksPage - Coming Soon landing page for member perks
 * Will eventually feature discounts to tools, events, and exclusive offers
 * Supports both light and dark themes with neon glass aesthetic
 */

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGift,
  faTicket,
  faPercent,
  faCalendarDays,
  faBolt,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

const PERK_PREVIEWS = [
  {
    icon: faPercent,
    title: 'Tool Discounts',
    description: 'Exclusive deals on popular AI and productivity tools',
    gradient: 'from-cyan-500 to-blue-500',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    bgLight: 'bg-cyan-100',
    bgDark: 'dark:bg-cyan-500/20',
  },
  {
    icon: faCalendarDays,
    title: 'Event Access',
    description: 'Early access and discounts to workshops and conferences',
    gradient: 'from-pink-500 to-purple-500',
    iconColor: 'text-pink-600 dark:text-pink-400',
    bgLight: 'bg-pink-100',
    bgDark: 'dark:bg-pink-500/20',
  },
  {
    icon: faTicket,
    title: 'Partner Offers',
    description: 'Special pricing from our curated partner network',
    gradient: 'from-emerald-500 to-teal-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-500/20',
  },
  {
    icon: faStar,
    title: 'Member Exclusives',
    description: 'Perks and surprises only for All Thrive members',
    gradient: 'from-amber-500 to-orange-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-amber-500/20',
  },
];

export default function PerksPage() {
  return (
    <DashboardLayout>
      {() => (
        <div className="min-h-screen bg-gray-50 dark:bg-background relative overflow-hidden">
          {/* Ambient Background Effects - visible in dark mode only */}
          <div className="fixed inset-0 bg-grid-pattern opacity-0 dark:opacity-20 pointer-events-none" />
          <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-pink-500/0 dark:bg-pink-500/10 blur-[100px] pointer-events-none" />
          <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/0 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full overflow-y-auto">
            {/* Hero Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 dark:from-pink-500/5 to-transparent" />
              <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                {/* Coming Soon Badge */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-100 to-cyan-100 dark:from-pink-500/20 dark:to-cyan-500/20 border border-pink-200 dark:border-pink-500/30 backdrop-blur-sm">
                    <FontAwesomeIcon icon={faBolt} className="text-pink-500 dark:text-pink-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Coming Soon</span>
                  </div>
                </div>

                {/* Main Icon */}
                <div className="flex justify-center mb-8">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-100 to-cyan-100 dark:from-pink-500/20 dark:to-cyan-500/20 flex items-center justify-center shadow-lg dark:shadow-neon border border-pink-200 dark:border-white/10">
                    <FontAwesomeIcon icon={faGift} className="text-5xl text-pink-500 dark:text-pink-400" />
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white text-center mb-6">
                  Member <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">Perks</span>
                </h1>

                {/* Description */}
                <p className="text-xl text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto mb-12 leading-relaxed">
                  Unlock exclusive discounts on tools, early access to events, and special offers
                  curated just for All Thrive members.
                </p>

                {/* Perk Preview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                  {PERK_PREVIEWS.map((perk, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-6 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 group hover:shadow-lg dark:hover:shadow-none"
                    >
                      <div className={`w-12 h-12 rounded-xl ${perk.bgLight} ${perk.bgDark} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <FontAwesomeIcon icon={perk.icon} className={`text-xl ${perk.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{perk.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{perk.description}</p>
                    </div>
                  ))}
                </div>

                {/* CTA Section */}
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-pink-500/30 rounded-xl p-8 text-center shadow-lg dark:shadow-none dark:shadow-pink-500/10">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Be the First to Know
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    We're partnering with top tools and event organizers to bring you amazing perks.
                    Stay tuned for the launch!
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                      href="/explore"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg dark:shadow-neon-strong transition-all duration-300"
                    >
                      <FontAwesomeIcon icon={faBolt} />
                      Explore All Thrive
                    </a>
                    <span className="text-gray-500 dark:text-gray-500 text-sm">
                      Perks launching soon for all members
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
