import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO, SEOPresets } from '@/components/common/SEO';

export default function AboutPage() {
  return (
    <DashboardLayout openAboutPanel={true}>
      <SEO {...SEOPresets.about} />
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            About All Thrive AI
          </h1>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <section className="mb-12">
              <h2 className="text-3xl font-semibold mb-4">AI Portfolio Platform with Gamified Learning & Discovery</h2>
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">
                All Thrive AI is where AI practitioners, learners, and researchers come together to showcase their work,
                level up their skills, and connect with a thriving community passionate about artificial intelligence.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                We're building the future of AI learning by combining professional portfolio showcasing with gamified
                learning experiences that make mastering AI/ML concepts engaging and rewarding.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-semibold mb-6">What We Offer</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-2xl font-semibold mb-3">🎨 AI Portfolio Builder</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Create stunning portfolios that showcase your AI projects with rich documentation,
                    code examples, and live demos. Import directly from GitHub and organize by technology stack.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-2xl font-semibold mb-3">🎮 Gamified Learning</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Master AI/ML through interactive challenges, earn achievements, and track your progress.
                    From fundamentals to advanced topics like NLP, computer vision, and reinforcement learning.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-2xl font-semibold mb-3">🔍 Project Discovery</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Explore innovative AI projects from the community. Filter by technology, difficulty,
                    and domain. Find inspiration and learn from real-world implementations.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h3 className="text-2xl font-semibold mb-3">👥 Community Collaboration</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    Join Thrive Circles, get peer feedback, participate in challenges, and connect with
                    fellow AI practitioners. Build your reputation and grow together.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-semibold mb-6">Who It's For</h2>
              <ul className="space-y-3 text-lg text-gray-700 dark:text-gray-300">
                <li><strong>AI/ML Engineers & Developers:</strong> Showcase your work and build your professional brand</li>
                <li><strong>Students & Learners:</strong> Build a portfolio while mastering AI concepts</li>
                <li><strong>Researchers:</strong> Share findings and collaborate with the community</li>
                <li><strong>Career Switchers:</strong> Demonstrate skills to potential employers</li>
                <li><strong>AI Enthusiasts:</strong> Explore, learn, and contribute to the AI ecosystem</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-semibold mb-6">Our Technology</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Built with modern, scalable technologies:
              </p>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>• <strong>AI/ML:</strong> OpenAI, Anthropic Claude, LangChain</li>
                <li>• <strong>Backend:</strong> Django REST Framework, PostgreSQL</li>
                <li>• <strong>Frontend:</strong> React, TypeScript, TailwindCSS</li>
                <li>• <strong>Vector Search:</strong> RedisVL for semantic discovery</li>
                <li>• <strong>Integration:</strong> GitHub OAuth, API access</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-semibold mb-6">Get Started</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                Join All Thrive AI today and start building your AI future:
              </p>
              <ol className="space-y-3 text-lg text-gray-700 dark:text-gray-300 list-decimal list-inside">
                <li>Sign up with GitHub or Google</li>
                <li>Complete your profile</li>
                <li>Create your first project or start a learning challenge</li>
                <li>Join a Thrive Circle community</li>
                <li>Earn achievements and level up</li>
              </ol>
            </section>

            <div className="text-center mt-12 p-8 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4">Ready to Thrive?</h3>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                Check out the right sidebar to learn more, or explore other sections of the platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
