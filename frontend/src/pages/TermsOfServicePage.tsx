import { Link } from 'react-router-dom';
import { Footer } from '@/components/landing/Footer';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/all-thrvie-logo.png" alt="All Thrive" className="h-8 w-auto" />
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              All Thrive
            </span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Last updated: January 2026</p>

        <div className="prose dark:prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Welcome to All Thrive</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              By using All Thrive, you agree to these terms. We're building a community for the AI curious
              to showcase their work, learn, and grow together. To keep this space positive and productive,
              we ask all members to follow these guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Community Standards</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              All Thrive is built on respect and collaboration. We expect all members to:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Be kind and respectful to other community members</li>
              <li>Share constructive feedback and support others' growth</li>
              <li>Keep discussions relevant and helpful</li>
              <li>Respect intellectual property and give credit where due</li>
              <li>Avoid spam, harassment, or any form of discrimination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Account Termination</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">We reserve the right to suspend or terminate any account</strong> that
              violates our community standards or these terms. This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2 mt-4">
              <li>Harassment, bullying, or threatening behavior toward other users</li>
              <li>Posting illegal, harmful, or offensive content</li>
              <li>Spam, scams, or deceptive practices</li>
              <li>Attempting to exploit or harm the platform or its users</li>
              <li>Any behavior that negatively impacts the community experience</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-4">
              Simply put: <strong className="text-cyan-400">be a good person</strong>. If your actions make the
              community worse for others, we will take action to protect our members.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Your Content</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              When you share content on All Thrive:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>You retain ownership of your original content</li>
              <li>You grant us a license to display and share your content on the platform</li>
              <li>You're responsible for ensuring you have the rights to share what you post</li>
              <li>You agree not to post content that infringes on others' rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Platform Security</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              We take security seriously and implement measures to protect our platform and users.
              You agree not to attempt to circumvent security measures, access unauthorized areas,
              or interfere with the platform's operation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">SMS Notifications</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              By providing your phone number and opting in to SMS notifications, you consent to receive text messages
              from All Thrive regarding:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Battle invitations from friends</li>
              <li>Battle results and updates</li>
              <li>Streak alerts and reminders</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-4">
              <strong className="text-slate-900 dark:text-white">Message frequency varies.</strong> Message and data rates may apply.
              You can opt out at any time by replying <strong className="text-cyan-400">STOP</strong> to any message.
              For help, reply <strong className="text-cyan-400">HELP</strong> or visit your{' '}
              <Link to="/account/settings/notifications" className="text-cyan-400 hover:text-cyan-300 underline">
                notification settings
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Changes to These Terms</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              We may update these terms from time to time. We'll notify you of significant changes
              through the platform or via email. Continued use of All Thrive after changes means
              you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Disclaimer</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              All Thrive is provided "as is" without warranties of any kind. We strive to provide
              a reliable service but cannot guarantee uninterrupted access. We are not liable for
              any damages arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Contact Us</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Questions about these terms? Reach out through our{' '}
              <a
                href="https://chat.whatsapp.com/ILi7yNkQB0e7dKbzaHjfZy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                WhatsApp community
              </a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
