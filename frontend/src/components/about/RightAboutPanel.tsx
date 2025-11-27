import { XMarkIcon } from '@heroicons/react/24/outline';

interface RightAboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightAboutPanel({ isOpen, onClose }: RightAboutPanelProps) {
  return (
    <>
      {/* Sliding Panel */}
      <div
        className={`fixed right-0 top-16 w-full md:w-[480px] h-[calc(100vh-4rem)] border-l border-white/20 dark:border-white/10 flex flex-col shadow-2xl transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            About All Thrive AI
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close about panel"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Banner Image */}
          <div className="w-full h-48 bg-gradient-to-r from-primary-500 to-primary-700 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-6xl mb-2">🌟</div>
              <p className="text-sm font-medium">All Thrive AI</p>
            </div>
          </div>

          {/* Main Content */}
          <div id="about-us" className="p-6 space-y-8">
            {/* Hero Statement */}
            <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 p-6 rounded-lg border-l-4 border-primary-500">
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-relaxed">
                AllThrive is one home where AI-curious creators learn, showcase, and thrive together.
              </p>
            </div>

            {/* Problem & Solution */}
            <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
              <p className="text-base">
                AI gives you hundreds of tools to create, prototype, and launch new ideas, but there&apos;s still no single
                place to consolidate, showcase, and get feedback on all your projects, no matter which tools you used.
              </p>
              <p className="text-base">
                You juggle projects across platforms, struggle to decide where to start, and keep running into spaces
                that act like you need to be a senior engineer before your work is worth sharing.
              </p>
            </div>

            {/* Belief Highlight */}
            <div className="bg-gradient-to-r from-accent-50 to-primary-50 dark:from-accent-900/30 dark:to-primary-900/30 p-5 rounded-lg border-l-4 border-accent-500">
              <p className="text-lg font-semibold text-gray-900 dark:text-white leading-relaxed">
                We believe you only need curiosity, a willingness to try, and a community that encourages you to explore what is possible.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            {/* What We Stand For */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                What We Stand for
              </h2>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We value <strong className="text-gray-900 dark:text-white">curiosity over perfection</strong> and exploration over certainty.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We learn by <strong className="text-gray-900 dark:text-white">experimenting and sharing</strong> what we discover.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We give feedback that is <strong className="text-gray-900 dark:text-white">kind, thoughtful, and helps ideas grow</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We celebrate the <strong className="text-gray-900 dark:text-white">courage to begin</strong>, not just the final result.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We believe <strong className="text-gray-900 dark:text-white">everyone has something worth creating</strong> and sharing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500 mt-1">✦</span>
                  <span>We know creativity grows when it is <strong className="text-gray-900 dark:text-white">supported by others</strong>.</span>
                </li>
              </ul>
            </div>

            {/* Simple Promise */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                💫 Simple promise
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We promise to hold space for curiosity, connection, and shared learning. AllThrive is a place
                where trying matters, ideas are welcomed, and everyone can explore what is possible with AI.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            {/* Community Values */}
            <div>
              <h2 id="our-values" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Community Values
              </h2>

              <div className="space-y-5">
                <div className="border-l-4 border-primary-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-2">
                    1. Curiosity First
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    We champion exploration over expertise. Questions matter more than answers, and trying
                    something new is always worth celebrating.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-2">
                    2. Learn by Doing
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    We believe the best way to understand AI is to build with it. Every experiment, prototype,
                    and project is a chance to learn something new.
                  </p>
                </div>

                <div className="border-l-4 border-accent-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-accent-600 dark:text-accent-400 mb-2">
                    3. We Thrive Together
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    We celebrate both collaboration and healthy competition. Whether we're building together or
                    challenging each other in hackathons, we all grow stronger by lifting each other up.
                  </p>
                </div>

                <div className="border-l-4 border-accent-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-accent-600 dark:text-accent-400 mb-2">
                    4. Lead with Kindness & Respect
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    We treat others the way we want to be treated. Leading by example with empathy, thoughtfulness,
                    and respect creates the supportive community we all deserve.
                  </p>
                </div>

                <div className="border-l-4 border-primary-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-2">
                    5. Celebrate the Messy Middle
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    We share the journey, not just the highlights. Failures, experiments, and lessons learned are
                    just as valuable as the wins because they help everyone grow faster.
                  </p>
                </div>

                <div className="border-l-4 border-accent-400 pl-4 py-2 bg-white dark:bg-gray-800 rounded-r-lg">
                  <h3 className="text-lg font-bold text-accent-600 dark:text-accent-400 mb-2">
                    6. You Belong Here
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    You are enough as you are. You can learn this. Your perspective matters. All you need is
                    curiosity and the willingness to start.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
