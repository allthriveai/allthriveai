import { useState } from 'react';

/**
 * StyleguideDemo Component
 *
 * Comprehensive showcase of the All Thrive AI design system
 * Demonstrates glassmorphism, light/dark themes, and all global CSS classes
 */
export default function StyleguideDemo() {
  const [isDark, setIsDark] = useState(false);

  // Toggle dark mode
  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Theme Toggle - Fixed Position */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 btn-ghost"
        aria-label="Toggle theme"
      >
        {isDark ? '☀️ Light' : '🌙 Dark'}
      </button>

      {/* Main Content */}
      <div className="content-container py-12">
        <div className="mb-12">
          <h1 className="text-gradient mb-4">
            All Thrive AI Styleguide
          </h1>
          <p className="text-muted text-xl">
            Glassmorphism design system with light/dark theme support
          </p>
        </div>

        <div className="divider" />

        {/* Glassmorphism Showcase */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Glassmorphism Levels</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-subtle p-6 rounded-2xl">
              <h3 className="text-xl font-semibold mb-2">Subtle Glass</h3>
              <p className="text-muted">50-60% opacity, 8px blur</p>
              <p className="text-sm mt-2">Navigation, background trays</p>
            </div>
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-xl font-semibold mb-2">Standard Glass</h3>
              <p className="text-muted">70% opacity, 12px blur</p>
              <p className="text-sm mt-2">Content cards, modals</p>
            </div>
            <div className="glass-strong p-6 rounded-2xl">
              <h3 className="text-xl font-semibold mb-2">Strong Glass</h3>
              <p className="text-muted">85-90% opacity, 16px blur</p>
              <p className="text-sm mt-2">Overlays, chat panels</p>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="text-xl font-semibold mb-2">Standard Card</h3>
              <p className="text-muted">Glass card with standard opacity</p>
            </div>
            <div className="card-hover">
              <h3 className="text-xl font-semibold mb-2">Hoverable Card</h3>
              <p className="text-muted">Hover me for lift effect</p>
            </div>
            <div className="card-solid">
              <h3 className="text-xl font-semibold mb-2">Solid Card</h3>
              <p className="text-muted">For text-heavy content</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <button className="btn-primary">Primary</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-outline">Outline</button>
            <button className="btn-ghost">Ghost</button>
            <button className="btn-primary btn-sm">Small</button>
            <button className="btn-primary btn-lg">Large</button>
          </div>
        </section>

        {/* Forms */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Forms</h2>
          <div className="card-solid max-w-2xl">
            <div className="mb-4">
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div className="mb-4">
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div className="mb-4">
              <label className="label">Message</label>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Enter your message..."
              />
            </div>
            <div className="mb-4">
              <label className="label">Error State</label>
              <input
                type="text"
                className="input input-error"
                placeholder="This field has an error"
              />
            </div>
            <div className="mb-4">
              <label className="label">Success State</label>
              <input
                type="text"
                className="input input-success"
                placeholder="This field is valid"
              />
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Badges</h2>
          <div className="flex flex-wrap gap-3">
            <span className="badge-primary">Primary</span>
            <span className="badge-success">Success</span>
            <span className="badge-warning">Warning</span>
            <span className="badge-error">Error</span>
            <span className="badge-info">Info</span>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Typography</h2>
          <div className="card-solid space-y-6">
            <div>
              <h1 className="mb-2">Heading 1 - Display</h1>
              <h2 className="mb-2">Heading 2 - Page Title</h2>
              <h3 className="mb-2">Heading 3 - Section</h3>
              <h4 className="mb-2">Heading 4 - Subsection</h4>
              <h5 className="mb-2">Heading 5 - Small Heading</h5>
              <h6 className="mb-2">Heading 6 - Tiny Heading</h6>
            </div>
            <div>
              <h3 className="text-gradient mb-2">Gradient Text</h3>
              <p className="text-body mb-2">
                Body text with optimal line height and color for readability
              </p>
              <p className="text-muted mb-2">Muted text for secondary info</p>
              <a href="#" className="link">This is a link</a>
            </div>
          </div>
        </section>

        {/* Navigation Links */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Navigation</h2>
          <div className="glass-subtle p-6 rounded-2xl max-w-md">
            <nav className="space-y-2">
              <a href="#" className="nav-link">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </a>
              <a href="#" className="nav-link-active">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Dashboard (Active)</span>
              </a>
              <a href="#" className="nav-link">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </a>
            </nav>
          </div>
        </section>

        {/* Loading States */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Loading States</h2>
          <div className="card space-y-6">
            <div>
              <h4 className="text-lg font-semibold mb-3">Spinner</h4>
              <div className="spinner" />
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-3">Skeleton Loaders</h4>
              <div className="skeleton h-8 w-64 mb-4" />
              <div className="skeleton h-4 w-full mb-2" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          </div>
        </section>

        {/* Animations */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Animations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card animate-fade-in">
              <h3 className="text-xl font-semibold mb-2">Fade In</h3>
              <p className="text-muted">animate-fade-in</p>
            </div>
            <div className="card animate-scale-in">
              <h3 className="text-xl font-semibold mb-2">Scale In</h3>
              <p className="text-muted">animate-scale-in</p>
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-3">Staggered Children</h4>
            <ul className="stagger-children space-y-2">
              <li className="card">Item 1 (0ms delay)</li>
              <li className="card">Item 2 (50ms delay)</li>
              <li className="card">Item 3 (100ms delay)</li>
              <li className="card">Item 4 (150ms delay)</li>
            </ul>
          </div>
        </section>

        {/* Color Showcase */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Color Palette</h2>
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold mb-3">Primary (Indigo)</h4>
              <div className="flex gap-2">
                <div className="w-16 h-16 bg-primary-500 rounded-lg" />
                <div className="w-16 h-16 bg-primary-400 rounded-lg" />
                <div className="w-16 h-16 bg-primary-600 rounded-lg" />
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-3">Accent (Purple)</h4>
              <div className="flex gap-2">
                <div className="w-16 h-16 bg-accent-500 rounded-lg" />
                <div className="w-16 h-16 bg-accent-400 rounded-lg" />
                <div className="w-16 h-16 bg-accent-600 rounded-lg" />
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-3">Semantic Colors</h4>
              <div className="flex gap-2">
                <div className="w-16 h-16 bg-success-500 rounded-lg" />
                <div className="w-16 h-16 bg-warning-500 rounded-lg" />
                <div className="w-16 h-16 bg-error-500 rounded-lg" />
                <div className="w-16 h-16 bg-info-500 rounded-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Complete Example */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">Complete Card Example</h2>
          <div className="card-hover max-w-xl">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                AI
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">AI Content Generator</h3>
                <p className="text-muted text-sm mb-3">
                  Created 2 hours ago by John Doe
                </p>
                <p className="text-body mb-4">
                  A powerful AI tool for generating high-quality content at scale.
                  Perfect for blog posts, social media, and more.
                </p>
                <div className="flex gap-2 mb-4">
                  <span className="badge-primary">AI</span>
                  <span className="badge-success">Active</span>
                  <span className="badge-info">New</span>
                </div>
                <div className="flex gap-3">
                  <button className="btn-primary btn-sm">Try Now</button>
                  <button className="btn-ghost btn-sm">Learn More</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="divider" />
        <footer className="text-center text-muted">
          <p>All Thrive AI Design System v1.0</p>
          <p className="text-sm mt-2">
            Built with Tailwind CSS &amp; Glassmorphism
          </p>
        </footer>
      </div>
    </div>
  );
}
