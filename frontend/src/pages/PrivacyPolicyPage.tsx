import { Link } from 'react-router-dom';
import { Footer } from '@/components/landing/Footer';

export default function PrivacyPolicyPage() {
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
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Last updated: December 2025</p>

        <div className="prose dark:prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Your Privacy Matters</h2>
            <p className="text-slate-600 dark:text-slate-600 dark:text-slate-300 leading-relaxed">
              At All Thrive, we take your privacy seriously. We are committed to protecting your personal
              information and being transparent about how we collect, use, and safeguard your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Information We Collect</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Account information (name, email, profile details)</li>
              <li>Content you create and share on the platform</li>
              <li>Communications with us and other users</li>
              <li>Usage data and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">How We Protect Your Data</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Limited employee access to personal data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">How We Use Your Information</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Provide and improve our services</li>
              <li>Personalize your experience</li>
              <li>Communicate with you about updates and features</li>
              <li>Ensure platform safety and security</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Data Sharing</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              We do not sell your personal information. We may share data with trusted service providers
              who help us operate our platform, but only as necessary and under strict confidentiality agreements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Your Rights</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
              <li>Access and download your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Contact Us</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              If you have questions about this Privacy Policy or your data, please reach out to us
              through our{' '}
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
