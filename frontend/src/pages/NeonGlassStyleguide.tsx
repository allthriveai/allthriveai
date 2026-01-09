import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  BellIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  SparklesIcon,
  BoltIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { AchievementBadge } from '@/components/achievements/AchievementBadge';
import { AchievementGrid } from '@/components/achievements/AchievementGrid';

/**
 * NeonGlassStyleguide - Preview of the Neon Glass Design System
 *
 * This page showcases the new All Thrive AI aesthetic before site-wide rollout:
 * - Dark futuristic theme (#020617 background)
 * - Neon accents (cyan, teal, pink)
 * - Glassmorphism panels with backdrop blur
 * - Soft radial glows and neon borders
 */
export default function NeonGlassStyleguide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [inputValue, setInputValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans text-white selection:bg-cyan-neon/30">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-accent/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <header className="mb-16 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-neon text-xs font-medium mb-6 tracking-wider uppercase">
            <span className="luminous-dot animate-pulse" />
            Neon Glass Preview
          </div>

          <h1 className="mb-6">
            Neon <span className="text-gradient-cyan">Glass</span> Styleguide
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Preview the new design system before rolling out site-wide.
            Deep navy backgrounds, translucent glass panels, and electric cyan accents.
          </p>
        </header>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-12">
          <div className="glass-subtle p-1 inline-flex rounded-xl">
            {['overview', 'components', 'layouts', 'effects'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 capitalize ${
                  activeTab === tab
                    ? 'bg-cyan-500/20 text-cyan-bright shadow-neon border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-24">
{/* === THEME MODES === */}
          <section>
            <SectionHeader title="Theme Modes" />

            <div className="glass-panel p-8 mb-8">
              <div className="flex items-center gap-3 mb-6 p-4 rounded bg-cyan-500/10 border border-cyan-500/30">
                <span className="text-cyan-400 text-xl">💡</span>
                <div>
                  <p className="text-cyan-300 font-semibold">Light & Dark Theme Support</p>
                  <p className="text-slate-400 text-sm">Use Tailwind's <code className="text-cyan-bright">dark:</code> prefix for theme-aware styling.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Light Theme Preview */}
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <div className="p-3 bg-white/10 border-b border-white/10">
                    <span className="text-sm font-medium text-white">Light Theme</span>
                  </div>
                  <div className="p-6" style={{ background: '#f8fafc' }}>
                    <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm mb-4">
                      <p className="text-slate-900 font-medium mb-1">Card Title</p>
                      <p className="text-slate-600 text-sm">Secondary text uses slate-600</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded text-sm bg-cyan-500 text-white">Primary</button>
                      <button className="px-3 py-1.5 rounded text-sm bg-slate-100 text-slate-700 border border-slate-200">Secondary</button>
                    </div>
                  </div>
                </div>

                {/* Dark Theme Preview */}
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <div className="p-3 bg-white/10 border-b border-white/10">
                    <span className="text-sm font-medium text-white">Dark Theme (Default)</span>
                  </div>
                  <div className="p-6" style={{ background: '#020617' }}>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 mb-4">
                      <p className="text-white font-medium mb-1">Card Title</p>
                      <p className="text-slate-400 text-sm">Secondary text uses slate-400</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded text-sm bg-gradient-to-r from-cyan-500 to-green-500 text-slate-900">Primary</button>
                      <button className="px-3 py-1.5 rounded text-sm bg-white/5 text-white border border-white/10">Secondary</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Examples */}
              <div className="p-4 bg-white/5 rounded border border-white/10">
                <h4 className="text-sm font-semibold text-white mb-3">Theme-Aware Class Pattern</h4>
                <pre className="text-sm text-slate-300 overflow-x-auto font-mono">
{`/* Background Colors */
bg-white dark:bg-slate-900
bg-slate-50 dark:bg-slate-800
bg-slate-100 dark:bg-white/5

/* Text Colors */
text-slate-900 dark:text-white        /* Primary text */
text-slate-600 dark:text-slate-400    /* Secondary text */
text-slate-500 dark:text-slate-500    /* Muted text */

/* Borders */
border-slate-200 dark:border-white/10
border-slate-300 dark:border-white/20

/* Hover States */
hover:bg-slate-100 dark:hover:bg-white/5
hover:bg-slate-50 dark:hover:bg-white/[0.08]`}
                </pre>
              </div>

              {/* Implementation Notes */}
              <div className="mt-6 p-4 bg-white/5 rounded border border-white/10">
                <h4 className="text-sm font-semibold text-white mb-3">Implementation</h4>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li><strong className="text-cyan-bright">Config:</strong> <code>darkMode: 'class'</code> in tailwind.config.js</li>
                  <li><strong className="text-cyan-bright">Default:</strong> Dark theme (stored in localStorage)</li>
                  <li><strong className="text-cyan-bright">Toggle:</strong> <code>useTheme()</code> hook from <code>@/hooks/useTheme</code></li>
                  <li><strong className="text-cyan-bright">Storage:</strong> Preference saved to <code>localStorage.theme</code></li>
                </ul>
              </div>
            </div>
          </section>

          {/* === COLOR PALETTE === */}
          <section>
            <SectionHeader title="Color Palette" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <ColorSwatch name="Background" value="#020617" />
              <ColorSwatch name="Cyan" value="#0EA5E9" />
              <ColorSwatch name="Bright Teal" value="#22D3EE" />
              <ColorSwatch name="Neon Bright" value="#4ADEE7" />
              <ColorSwatch name="Pink Accent" value="#FB37FF" />
            </div>

            {/* Semantic Colors */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Semantic Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="text-center">
                <div className="h-20 rounded-xl mb-2 border border-white/10 flex flex-col overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: '#f0fdf4' }} />
                  <div className="flex-1" style={{ backgroundColor: '#10b981' }} />
                  <div className="flex-1" style={{ backgroundColor: '#064e3b' }} />
                </div>
                <p className="text-sm font-medium text-emerald-400">Success</p>
                <code className="text-xs text-slate-400">#10b981</code>
              </div>
              <div className="text-center">
                <div className="h-20 rounded-xl mb-2 border border-white/10 flex flex-col overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: '#fffbeb' }} />
                  <div className="flex-1" style={{ backgroundColor: '#f59e0b' }} />
                  <div className="flex-1" style={{ backgroundColor: '#78350f' }} />
                </div>
                <p className="text-sm font-medium text-amber-400">Warning</p>
                <code className="text-xs text-slate-400">#f59e0b</code>
              </div>
              <div className="text-center">
                <div className="h-20 rounded-xl mb-2 border border-white/10 flex flex-col overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: '#fef2f2' }} />
                  <div className="flex-1" style={{ backgroundColor: '#f43f5e' }} />
                  <div className="flex-1" style={{ backgroundColor: '#881337' }} />
                </div>
                <p className="text-sm font-medium text-rose-400">Error</p>
                <code className="text-xs text-slate-400">#f43f5e</code>
              </div>
              <div className="text-center">
                <div className="h-20 rounded-xl mb-2 border border-white/10 flex flex-col overflow-hidden">
                  <div className="flex-1" style={{ backgroundColor: '#f0f9ff' }} />
                  <div className="flex-1" style={{ backgroundColor: '#0ea5e9' }} />
                  <div className="flex-1" style={{ backgroundColor: '#0c4a6e' }} />
                </div>
                <p className="text-sm font-medium text-sky-400">Info</p>
                <code className="text-xs text-slate-400">#0ea5e9</code>
              </div>
            </div>

            <div className="glass-panel p-6">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Glass Fill Colors</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.05] border border-white/10">
                  <p className="text-xs text-slate-400">5% white</p>
                  <code className="text-xs text-cyan-bright">bg-white/5</code>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.08] border border-white/10">
                  <p className="text-xs text-slate-400">8% white (glass-fill)</p>
                  <code className="text-xs text-cyan-bright">rgba(255,255,255,0.08)</code>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.12] border border-white/10">
                  <p className="text-xs text-slate-400">12% white (glass-strong)</p>
                  <code className="text-xs text-cyan-bright">bg-white/12</code>
                </div>
              </div>
            </div>

            {/* Thrive Circle Tiers */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Thrive Circle Tiers</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <TierSwatch name="Seedling" color="#86efac" gradientFrom="#86efac" gradientTo="#22c55e" description="New members" />
              <TierSwatch name="Sprout" color="#4ade80" gradientFrom="#4ade80" gradientTo="#16a34a" description="Growing" />
              <TierSwatch name="Blossom" color="#f472b6" gradientFrom="#f472b6" gradientTo="#db2777" description="Flourishing" />
              <TierSwatch name="Bloom" color="#c084fc" gradientFrom="#c084fc" gradientTo="#9333ea" description="Thriving" />
              <TierSwatch name="Evergreen" color="#22d3ee" gradientFrom="#22d3ee" gradientTo="#0891b2" description="Legendary" />
            </div>

            {/* Category Colors (Jewel Tones) */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Category Colors (Jewel Tones)</h4>
            <p className="text-sm text-slate-400 mb-4">Rich gemstone colors for content categories. See <code className="text-cyan-bright">categoryColors.ts</code></p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <JewelSwatch name="Sapphire" hex="#0F52BA" category="Chatbots & Conversation" />
              <JewelSwatch name="Tanzanite" hex="#4B0082" category="AI Models & Research" />
              <JewelSwatch name="Amethyst" hex="#5a175d" category="Data & Analytics" />
              <JewelSwatch name="Rose Quartz" hex="#AA336A" category="Audio & Multimodal" />
              <JewelSwatch name="Emerald" hex="#046307" category="AI Agents" />
              <JewelSwatch name="Morganite" hex="#C46480" category="Design (UI)" />
              <JewelSwatch name="Jade" hex="#00A86B" category="Developer & Coding" />
              <JewelSwatch name="Ruby" hex="#9B111E" category="Games & Interactive" />
              <JewelSwatch name="Topaz" hex="#E27D12" category="Images & Video" />
              <JewelSwatch name="Peridot" hex="#5E8C31" category="Podcasts & Education" />
            </div>

            {/* Section/Concept Gradients */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Section Gradients (App Navigation)</h4>
            <p className="text-sm text-slate-400 mb-4">
              Wayfinding colors for app sections. Same gradient on pill → page header. See <code className="text-cyan-bright">sectionColors.ts</code>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <SectionSwatch name="Play" from="#8B5CF6" to="#7C3AED" description="Games & battles" />
              <SectionSwatch name="Learn" from="#F59E0B" to="#D97706" description="Tutorials & courses" />
              <SectionSwatch name="Explore" from="#0EA5E9" to="#0891B2" description="Discover (brand)" />
              <SectionSwatch name="Share" from="#10B981" to="#059669" description="Create & portfolio" />
              <SectionSwatch name="Connect" from="#EC4899" to="#DB2777" description="Community & social" />
              <SectionSwatch name="Challenge" from="#EF4444" to="#DC2626" description="Weekly challenges" />
            </div>

            {/* Achievement Rarity Colors */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Achievement Rarity</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <RaritySwatch name="Common" gradientFrom="#94a3b8" gradientTo="#64748b" />
              <RaritySwatch name="Rare" gradientFrom="#3b82f6" gradientTo="#2563eb" />
              <RaritySwatch name="Epic" gradientFrom="#a855f7" gradientTo="#9333ea" />
              <RaritySwatch name="Legendary" gradientFrom="#eab308" gradientTo="#ca8a04" />
            </div>

            {/* Activity Type Colors */}
            <h4 className="text-lg font-semibold text-white mb-4 mt-8">Activity Types</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <ActivitySwatch name="Quiz" color="#10b981" />
              <ActivitySwatch name="Project Create" color="#3b82f6" />
              <ActivitySwatch name="Project Update" color="#6366f1" />
              <ActivitySwatch name="Comment" color="#8b5cf6" />
              <ActivitySwatch name="Reaction" color="#ec4899" />
              <ActivitySwatch name="Daily Login" color="#f59e0b" />
              <ActivitySwatch name="Streak" color="#ef4444" />
              <ActivitySwatch name="Weekly Goal" color="#14b8a6" />
              <ActivitySwatch name="Side Quest" color="#a855f7" />
              <ActivitySwatch name="Event" color="#f97316" />
              <ActivitySwatch name="Referral" color="#06b6d4" />
            </div>
          </section>

          {/* === GLASS SURFACES === */}
          <section>
            <SectionHeader title="Glass Surfaces" color="pink" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass-subtle p-8 h-64 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-white">Subtle Glass</h3>
                  <p className="text-slate-400 text-sm">.glass-subtle</p>
                </div>
                <div className="text-slate-500 text-sm">
                  Low opacity background for secondary containers and subtle framing.
                </div>
              </div>

              <div className="glass-card h-64 flex flex-col justify-between relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-cyan-bright">Standard Card</h3>
                  <p className="text-slate-400 text-sm">.glass-card</p>
                </div>
                <div className="text-slate-400 text-sm">
                  The primary container with backdrop blur, inner borders, and hover glow effects.
                </div>
              </div>

              <div className="glass-card neon-border h-64 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-bright shadow-neon opacity-50" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-white">Neon Active</h3>
                  <p className="text-slate-400 text-sm">.glass-card .neon-border</p>
                </div>
                <div className="text-slate-400 text-sm">
                  High visibility state for active items, selections, or featured content.
                </div>
              </div>
            </div>
          </section>

          {/* === BUTTONS === */}
          <section>
            <SectionHeader title="Buttons" />

            <div className="glass-panel p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {/* Button Variants */}
                <div className="space-y-8">
                  <h3 className="text-xl text-slate-300 mb-6">Button Variants</h3>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Primary (Neon Gradient)</p>
                      <div className="flex flex-wrap gap-3 items-center">
                        <button className="btn-primary">
                          Primary Action
                        </button>
                        <button className="btn-primary shadow-neon-strong">
                          With Glow
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Secondary (Glass)</p>
                      <div className="flex flex-wrap gap-3">
                        <button className="btn-secondary">
                          Secondary
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Outline</p>
                      <div className="flex flex-wrap gap-3">
                        <button className="btn-outline">
                          Outline
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Ghost</p>
                      <div className="flex flex-wrap gap-3">
                        <button className="btn-ghost">
                          Ghost
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Button with Icons */}
                <div className="space-y-8">
                  <h3 className="text-xl text-slate-300 mb-6">With Icons</h3>

                  <div className="space-y-4">
                    <button className="btn-primary inline-flex items-center gap-2">
                      <PlusIcon className="w-5 h-5" />
                      Add Project
                    </button>

                    <button className="btn-secondary inline-flex items-center gap-2">
                      <MagnifyingGlassIcon className="w-5 h-5" />
                      Search
                    </button>

                    <button className="btn-outline inline-flex items-center gap-2">
                      View More
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>

                    <div className="flex gap-2 pt-4">
                      <p className="text-xs text-slate-500 mb-2">Icon Buttons:</p>
                    </div>
                    <div className="flex gap-3">
                      <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-bright/30 transition-all">
                        <BellIcon className="w-5 h-5 text-slate-400" />
                      </button>
                      <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-bright/30 transition-all">
                        <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
                      </button>
                      <button className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 shadow-neon">
                        <SparklesIcon className="w-5 h-5 text-cyan-bright" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === FORM INPUTS === */}
          <section>
            <SectionHeader title="Form Inputs" color="pink" />

            <div className="glass-panel p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-xl text-slate-300 mb-2">Glass Inputs</h3>

                  <div>
                    <label className="block text-xs font-medium text-cyan-bright mb-2 uppercase tracking-wider">
                      System Access Code
                    </label>
                    <input
                      type="text"
                      placeholder="ENTER CODE..."
                      className="input-glass"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      Encrypted Message
                    </label>
                    <textarea
                      placeholder="Type your secure message..."
                      rows={3}
                      className="input-glass resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                      Search with Icon
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        className="input-glass pl-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl text-slate-300 mb-2">Selection Controls</h3>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          checkboxChecked
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'border-white/30 group-hover:border-cyan-bright/50'
                        }`}
                        onClick={() => setCheckboxChecked(!checkboxChecked)}
                      >
                        {checkboxChecked && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-slate-300">Enable neon glow effects</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="w-5 h-5 rounded border-2 border-white/30 group-hover:border-cyan-bright/50 flex items-center justify-center transition-all" />
                      <span className="text-slate-300">Subscribe to updates</span>
                    </label>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
                      Interest Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['AI Tools', 'Design', 'Development', 'Gaming'].map((tag, i) => (
                        <button
                          key={tag}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            i === 0
                              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-bright'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:border-cyan-bright/30 hover:text-white'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === NAVIGATION PREVIEW === */}
          <section>
            <SectionHeader title="Navigation Preview" />

            {/* Mock Top Navigation - Matches actual TopNavigation.tsx */}
            <div className="glass-panel p-0 overflow-hidden mb-8">
              <div
                className="px-6 border-b border-white/10"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                }}
              >
                <div className="flex items-center justify-between h-16">
                  {/* Left Side - Logo + Nav */}
                  <div className="flex items-center gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                      <img
                        src="/all-thrvie-logo.png"
                        alt="All Thrive"
                        className="h-8 w-auto"
                      />
                    </div>

                    {/* Desktop Nav Items */}
                    <div className="hidden md:flex items-center gap-1">
                      {['Discover', 'Learn', 'Play', 'Connect'].map((item, i) => (
                        <button
                          key={item}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
                            i === 0
                              ? 'bg-teal-400/[0.08] text-teal-300 border-teal-400/40 shadow-lg shadow-teal-500/10'
                              : 'text-gray-100 border-transparent hover:bg-white/[0.08] hover:border-white/30'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Side - Actions */}
                  <div className="flex items-center gap-2">
                    {/* Search */}
                    <button className="p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300">
                      <MagnifyingGlassIcon className="w-5 h-5 text-gray-200" />
                    </button>

                    {/* Chat Button - Cyan/Green Gradient */}
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/20 text-slate-900"
                      style={{
                        background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                        boxShadow: '0 2px 8px rgba(34, 211, 238, 0.15)',
                      }}
                    >
                      <SparklesIcon className="w-4 h-4" />
                      <span>Chat</span>
                    </button>

                    {/* Theme Toggle */}
                    <button className="p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300">
                      <BoltIcon className="w-5 h-5 text-amber-300" />
                    </button>

                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-pink-accent flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mock Content Area */}
              <div className="p-8 bg-background">
                <p className="text-slate-500 text-center">Page content area</p>
              </div>
            </div>

            {/* Navigation Component Notes */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-semibold text-white mb-3">Navigation Implementation Notes</h4>
              <ul className="text-sm text-slate-400 space-y-2">
                <li><strong className="text-cyan-bright">Logo:</strong> Uses actual logo image, links to /home</li>
                <li><strong className="text-cyan-bright">Nav Items:</strong> Discover, Learn, Play, Connect — each with dropdown menus</li>
                <li><strong className="text-cyan-bright">Active State:</strong> Teal background with teal border and shadow</li>
                <li><strong className="text-cyan-bright">Chat Button:</strong> Cyan-to-green gradient, dark text, prominent CTA</li>
                <li><strong className="text-cyan-bright">Glass Effect:</strong> <code>backdrop-filter: blur(20px) saturate(180%)</code></li>
              </ul>
            </div>
          </section>

          {/* === CARDS & CONTENT === */}
          <section>
            <SectionHeader title="Cards & Content Blocks" color="pink" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Feature Card */}
              <div className="glass-card group cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:shadow-neon transition-all">
                  <RocketLaunchIcon className="w-6 h-6 text-cyan-bright" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-bright transition-colors">
                  Quick Launch
                </h4>
                <p className="text-slate-400 text-sm">
                  Start building your AI project in minutes with our guided templates.
                </p>
              </div>

              {/* Stats Card */}
              <div className="glass-card">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-slate-400">Total Projects</h4>
                  <ChartBarIcon className="w-5 h-5 text-cyan-bright" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">2,847</div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-emerald-400">+12.5%</span>
                  <span className="text-slate-500">from last month</span>
                </div>
              </div>

              {/* User Card */}
              <div className="glass-card">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-accent to-cyan-bright" />
                  <div>
                    <h4 className="font-semibold text-white">Sarah Chen</h4>
                    <p className="text-sm text-slate-400">AI Designer</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-bright text-xs">
                    Pro Member
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-400 text-xs">
                    42 Projects
                  </span>
                </div>
              </div>
            </div>

            {/* Chat Message Preview */}
            <div className="glass-panel p-6">
              <h4 className="text-sm font-medium text-slate-400 mb-4">Chat Interface Preview</h4>
              <div className="space-y-4">
                {/* Assistant Message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <SparklesIcon className="w-4 h-4 text-cyan-bright" />
                  </div>
                  <div className="glass-subtle p-4 rounded-2xl rounded-tl-sm max-w-md">
                    <p className="text-slate-300 text-sm">
                      Welcome! I'm here to help you build amazing AI projects. What would you like to create today?
                    </p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-4 rounded-2xl rounded-tr-sm max-w-md">
                    <p className="text-white text-sm font-medium">
                      I want to create an AI-powered design tool
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-accent to-cyan-bright flex-shrink-0" />
                </div>
              </div>

              {/* Input Bar */}
              <div className="mt-6 flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="input-glass pr-12"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors">
                    <ArrowRightIcon className="w-4 h-4 text-cyan-bright" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* === SPECIAL EFFECTS === */}
          <section>
            <SectionHeader title="Special Effects" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Glow Effects */}
              <div className="glass-panel p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-radial from-cyan-500/20 to-transparent opacity-50" />
                <div className="relative z-10">
                  <h4 className="text-lg font-semibold text-white mb-4">Radial Glow</h4>
                  <p className="text-slate-400 text-sm mb-4">
                    Ambient light effects behind important elements
                  </p>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 mx-auto shadow-neon-strong flex items-center justify-center">
                    <BoltIcon className="w-10 h-10 text-white" />
                  </div>
                </div>
              </div>

              {/* Circuit Lines */}
              <div className="glass-panel p-8 relative overflow-hidden">
                <div className="circuit-connector top-8" />
                <div className="circuit-connector top-16 opacity-50" />
                <div className="circuit-connector bottom-8 opacity-30" />

                <div className="relative z-10">
                  <h4 className="text-lg font-semibold text-white mb-4">Circuit Connectors</h4>
                  <p className="text-slate-400 text-sm mb-4">
                    Decorative lines suggesting connectivity
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="luminous-dot" />
                      <span className="text-cyan-bright text-sm">System Online</span>
                    </div>
                    <code className="text-xs text-slate-500 font-mono">STATUS: ACTIVE</code>
                  </div>
                </div>
              </div>

              {/* Neon Border */}
              <div className="glass-card neon-border">
                <h4 className="text-lg font-semibold text-white mb-4">Neon Border</h4>
                <p className="text-slate-400 text-sm">
                  Sharp cyan glow for active states and featured content.
                  Use <code className="text-cyan-bright">.neon-border</code> class.
                </p>
              </div>

              {/* Luminous Indicators */}
              <div className="glass-panel p-8">
                <h4 className="text-lg font-semibold text-white mb-4">Luminous Indicators</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="luminous-dot" />
                    <span className="text-slate-300 text-sm">Active connection</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                    <span className="text-slate-300 text-sm">Success state</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-pink-accent shadow-[0_0_10px_rgba(251,55,255,0.5)]" />
                    <span className="text-slate-300 text-sm">Alert indicator</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === ACHIEVEMENT BADGES === */}
          <section>
            <SectionHeader title="Achievement Badges" />

            <div className="space-y-8">
              {/* Individual Badges - Different States */}
              <div className="glass-panel p-8">
                <h4 className="text-lg font-semibold text-white mb-6">Badge States & Rarities</h4>

                {/* Unlocked Badges by Rarity */}
                <div className="mb-8">
                  <p className="text-sm text-slate-400 mb-4">Unlocked badges with different rarity levels:</p>
                  <div className="flex flex-wrap gap-6 items-end">
                    <AchievementBadge
                      achievement={{
                        id: 1,
                        key: 'first_project',
                        name: 'First Steps',
                        description: 'Create your first project',
                        icon: 'RocketLaunchIcon',
                        category: 'projects',
                        rarity: 'common',
                        points: 10,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 1,
                        earnedAt: new Date().toISOString(),
                        progress: 1,
                        total: 1,
                      }}
                      size="medium"
                    />

                    <AchievementBadge
                      achievement={{
                        id: 2,
                        key: 'battle_winner',
                        name: 'Battle Victor',
                        description: 'Win your first battle',
                        icon: 'TrophyIcon',
                        category: 'battles',
                        rarity: 'rare',
                        points: 25,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 2,
                        earnedAt: new Date().toISOString(),
                        progress: 1,
                        total: 1,
                      }}
                      size="medium"
                    />

                    <AchievementBadge
                      achievement={{
                        id: 3,
                        key: 'community_hero',
                        name: 'Community Hero',
                        description: 'Help 100 community members',
                        icon: 'UsersIcon',
                        category: 'community',
                        rarity: 'epic',
                        points: 50,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 3,
                        earnedAt: new Date().toISOString(),
                        progress: 100,
                        total: 100,
                      }}
                      size="medium"
                    />

                    <AchievementBadge
                      achievement={{
                        id: 4,
                        key: 'streak_master',
                        name: 'Streak Master',
                        description: 'Maintain a 365 day streak',
                        icon: 'FireIcon',
                        category: 'streaks',
                        rarity: 'legendary',
                        points: 100,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 4,
                        earnedAt: new Date().toISOString(),
                        progress: 365,
                        total: 365,
                      }}
                      size="medium"
                    />
                  </div>
                </div>

                {/* Locked Badges with Progress */}
                <div className="mb-8">
                  <p className="text-sm text-slate-400 mb-4">Locked badges showing progress:</p>
                  <div className="flex flex-wrap gap-6 items-end">
                    <AchievementBadge
                      achievement={{
                        id: 5,
                        key: 'project_master',
                        name: 'Project Master',
                        description: 'Create 10 projects',
                        icon: 'RocketLaunchIcon',
                        category: 'projects',
                        rarity: 'rare',
                        points: 30,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 5,
                        earnedAt: '',
                        progress: 7,
                        total: 10,
                      }}
                      size="medium"
                    />

                    <AchievementBadge
                      achievement={{
                        id: 6,
                        key: 'engagement_pro',
                        name: 'Engagement Pro',
                        description: 'Get 1000 likes on your content',
                        icon: 'HeartIcon',
                        category: 'engagement',
                        rarity: 'epic',
                        points: 75,
                        isSecret: false,
                      }}
                      userAchievement={{
                        id: 6,
                        earnedAt: '',
                        progress: 450,
                        total: 1000,
                      }}
                      size="medium"
                    />

                    <AchievementBadge
                      achievement={{
                        id: 7,
                        key: 'secret_achievement',
                        name: 'Secret Discovery',
                        description: 'Find the hidden easter egg',
                        icon: 'SparklesIcon',
                        category: 'engagement',
                        rarity: 'legendary',
                        points: 150,
                        isSecret: true,
                      }}
                      userAchievement={{
                        id: 7,
                        earnedAt: '',
                        progress: 0,
                        total: 1,
                      }}
                      size="medium"
                    />
                  </div>
                </div>

                {/* Different Sizes */}
                <div>
                  <p className="text-sm text-slate-400 mb-4">Badge sizes:</p>
                  <div className="flex flex-wrap gap-6 items-end">
                    <div className="text-center">
                      <AchievementBadge
                        achievement={{
                          id: 8,
                          key: 'small_badge',
                          name: 'Small',
                          description: 'Small badge size',
                          icon: 'StarIcon',
                          category: 'projects',
                          rarity: 'common',
                          points: 10,
                          isSecret: false,
                        }}
                        userAchievement={{
                          id: 8,
                          earnedAt: new Date().toISOString(),
                          progress: 1,
                          total: 1,
                        }}
                        size="small"
                      />
                      <p className="text-xs text-slate-500 mt-2">Small</p>
                    </div>

                    <div className="text-center">
                      <AchievementBadge
                        achievement={{
                          id: 9,
                          key: 'medium_badge',
                          name: 'Medium',
                          description: 'Medium badge size',
                          icon: 'TrophyIcon',
                          category: 'battles',
                          rarity: 'rare',
                          points: 25,
                          isSecret: false,
                        }}
                        userAchievement={{
                          id: 9,
                          earnedAt: new Date().toISOString(),
                          progress: 1,
                          total: 1,
                        }}
                        size="medium"
                      />
                      <p className="text-xs text-slate-500 mt-2">Medium (Default)</p>
                    </div>

                    <div className="text-center">
                      <AchievementBadge
                        achievement={{
                          id: 10,
                          key: 'large_badge',
                          name: 'Large',
                          description: 'Large badge size',
                          icon: 'FireIcon',
                          category: 'streaks',
                          rarity: 'legendary',
                          points: 100,
                          isSecret: false,
                        }}
                        userAchievement={{
                          id: 10,
                          earnedAt: new Date().toISOString(),
                          progress: 1,
                          total: 1,
                        }}
                        size="large"
                      />
                      <p className="text-xs text-slate-500 mt-2">Large</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievement Grid Component */}
              <div className="glass-panel p-8">
                <h4 className="text-lg font-semibold text-white mb-6">Achievement Grid Component</h4>
                <p className="text-sm text-slate-400 mb-6">
                  Full grid with category filtering, progress tracking, and modal details on click.
                </p>

                <AchievementGrid
                  achievements={[
                    {
                      id: 1,
                      key: 'first_project',
                      name: 'First Steps',
                      description: 'Create your first project',
                      icon: 'RocketLaunchIcon',
                      category: 'projects',
                      rarity: 'common',
                      points: 10,
                      isSecret: false,
                    },
                    {
                      id: 2,
                      key: 'project_master',
                      name: 'Project Master',
                      description: 'Create 10 projects',
                      icon: 'RocketLaunchIcon',
                      category: 'projects',
                      rarity: 'rare',
                      points: 30,
                      isSecret: false,
                    },
                    {
                      id: 3,
                      key: 'battle_winner',
                      name: 'Battle Victor',
                      description: 'Win your first battle',
                      icon: 'TrophyIcon',
                      category: 'battles',
                      rarity: 'rare',
                      points: 25,
                      isSecret: false,
                    },
                    {
                      id: 4,
                      key: 'battle_legend',
                      name: 'Battle Legend',
                      description: 'Win 100 battles',
                      icon: 'TrophyIcon',
                      category: 'battles',
                      rarity: 'legendary',
                      points: 200,
                      isSecret: false,
                    },
                    {
                      id: 5,
                      key: 'community_helper',
                      name: 'Community Helper',
                      description: 'Welcome 10 new members',
                      icon: 'UsersIcon',
                      category: 'community',
                      rarity: 'common',
                      points: 15,
                      isSecret: false,
                    },
                    {
                      id: 6,
                      key: 'community_hero',
                      name: 'Community Hero',
                      description: 'Help 100 community members',
                      icon: 'UsersIcon',
                      category: 'community',
                      rarity: 'epic',
                      points: 50,
                      isSecret: false,
                    },
                    {
                      id: 7,
                      key: 'engagement_starter',
                      name: 'Engagement Starter',
                      description: 'Get 10 likes on your content',
                      icon: 'HeartIcon',
                      category: 'engagement',
                      rarity: 'common',
                      points: 5,
                      isSecret: false,
                    },
                    {
                      id: 8,
                      key: 'engagement_pro',
                      name: 'Engagement Pro',
                      description: 'Get 1000 likes on your content',
                      icon: 'ChatBubbleBottomCenterIcon',
                      category: 'engagement',
                      rarity: 'epic',
                      points: 75,
                      isSecret: false,
                    },
                    {
                      id: 9,
                      key: 'streak_starter',
                      name: 'Streak Starter',
                      description: 'Maintain a 7 day streak',
                      icon: 'FireIcon',
                      category: 'streaks',
                      rarity: 'common',
                      points: 10,
                      isSecret: false,
                    },
                    {
                      id: 10,
                      key: 'streak_master',
                      name: 'Streak Master',
                      description: 'Maintain a 365 day streak',
                      icon: 'FireIcon',
                      category: 'streaks',
                      rarity: 'legendary',
                      points: 100,
                      isSecret: false,
                    },
                  ]}
                  userAchievements={{
                    1: { id: 1, earnedAt: new Date().toISOString(), progress: 1, total: 1 },
                    3: { id: 3, earnedAt: new Date().toISOString(), progress: 1, total: 1 },
                    5: { id: 5, earnedAt: new Date().toISOString(), progress: 10, total: 10 },
                    7: { id: 7, earnedAt: new Date().toISOString(), progress: 50, total: 10 },
                    9: { id: 9, earnedAt: new Date().toISOString(), progress: 7, total: 7 },
                    2: { id: 2, earnedAt: '', progress: 7, total: 10 },
                    4: { id: 4, earnedAt: '', progress: 23, total: 100 },
                    6: { id: 6, earnedAt: '', progress: 65, total: 100 },
                    8: { id: 8, earnedAt: '', progress: 450, total: 1000 },
                    10: { id: 10, earnedAt: '', progress: 89, total: 365 },
                  }}
                  title="Achievement Showcase"
                  showFilters={true}
                />
              </div>

              {/* Category Colors Reference */}
              <div className="glass-panel p-8">
                <h4 className="text-lg font-semibold text-white mb-6">Achievement Category Colors</h4>
                <p className="text-sm text-slate-400 mb-6">
                  Each achievement category uses jewel-tone colors from the design system:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="h-20 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      <RocketLaunchIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-sm font-medium text-emerald-400">Projects</p>
                    <p className="text-xs text-slate-500 mb-1">jade</p>
                    <code className="text-xs text-slate-400">#10b981</code>
                    <br />
                    <code className="text-xs text-slate-400">#059669</code>
                  </div>

                  <div className="text-center">
                    <div className="h-20 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                      <TrophyIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-sm font-medium text-red-400">Battles</p>
                    <p className="text-xs text-slate-500 mb-1">ruby</p>
                    <code className="text-xs text-slate-400">#ef4444</code>
                    <br />
                    <code className="text-xs text-slate-400">#dc2626</code>
                  </div>

                  <div className="text-center">
                    <div className="h-20 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)' }}>
                      <UsersIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-sm font-medium text-pink-400">Community</p>
                    <p className="text-xs text-slate-500 mb-1">rose-quartz</p>
                    <code className="text-xs text-slate-400">#f472b6</code>
                    <br />
                    <code className="text-xs text-slate-400">#ec4899</code>
                  </div>

                  <div className="text-center">
                    <div className="h-20 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                      <HeartIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-sm font-medium text-blue-400">Engagement</p>
                    <p className="text-xs text-slate-500 mb-1">sapphire</p>
                    <code className="text-xs text-slate-400">#3b82f6</code>
                    <br />
                    <code className="text-xs text-slate-400">#2563eb</code>
                  </div>

                  <div className="text-center">
                    <div className="h-20 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <FireIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-sm font-medium text-amber-400">Streaks</p>
                    <p className="text-xs text-slate-500 mb-1">topaz</p>
                    <code className="text-xs text-slate-400">#f59e0b</code>
                    <br />
                    <code className="text-xs text-slate-400">#d97706</code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === BORDER RADIUS === */}
          <section>
            <SectionHeader title="Border Radius" />

            <div className="glass-panel p-8 mb-8">
              <div className="flex items-center gap-3 mb-6 p-4 rounded bg-amber-500/10 border border-amber-500/30">
                <span className="text-amber-400 text-xl">⚠️</span>
                <div>
                  <p className="text-amber-300 font-semibold">Standard Border Radius: 4px</p>
                  <p className="text-slate-400 text-sm">Use <code className="text-cyan-bright">rounded</code> (4px) as the default for all interactive elements.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="h-20 bg-white/10 border border-white/20 mb-3 flex items-center justify-center" style={{ borderRadius: '4px' }}>
                    <span className="text-cyan-bright text-sm font-mono">4px</span>
                  </div>
                  <p className="text-sm font-medium text-white">Default (rounded)</p>
                  <code className="text-xs text-slate-400">rounded / rounded-sm</code>
                  <p className="text-xs text-emerald-400 mt-1">✓ Use this</p>
                </div>

                <div className="text-center">
                  <div className="h-20 bg-white/10 border border-white/20 mb-3 flex items-center justify-center rounded-lg">
                    <span className="text-slate-400 text-sm font-mono">8px</span>
                  </div>
                  <p className="text-sm font-medium text-slate-400">Medium (rounded-lg)</p>
                  <code className="text-xs text-slate-500">Only for cards/panels</code>
                  <p className="text-xs text-amber-400 mt-1">⚠ Sparingly</p>
                </div>

                <div className="text-center">
                  <div className="h-20 bg-white/10 border border-white/20 mb-3 flex items-center justify-center rounded-xl">
                    <span className="text-slate-500 text-sm font-mono">12px</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Large (rounded-xl)</p>
                  <code className="text-xs text-slate-500">Feature cards only</code>
                  <p className="text-xs text-rose-400 mt-1">✗ Avoid</p>
                </div>

                <div className="text-center">
                  <div className="h-20 bg-white/10 border border-white/20 mb-3 flex items-center justify-center rounded-full">
                    <span className="text-slate-500 text-sm font-mono">full</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Full (rounded-full)</p>
                  <code className="text-xs text-slate-500">Pills, avatars, dots</code>
                  <p className="text-xs text-slate-400 mt-1">Context-specific</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-white/5 rounded border border-white/10">
                <h4 className="text-sm font-semibold text-white mb-3">When to use each:</h4>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li><code className="text-cyan-bright">rounded (4px)</code> — Buttons, inputs, tags, chips, small cards, form controls</li>
                  <li><code className="text-cyan-bright">rounded-lg (8px)</code> — Glass panels, modal dialogs, dropdown menus</li>
                  <li><code className="text-cyan-bright">rounded-xl (12px)</code> — Hero cards, feature showcases (rare)</li>
                  <li><code className="text-cyan-bright">rounded-full</code> — Avatars, status dots, pill badges, icon buttons</li>
                </ul>
              </div>
            </div>
          </section>

          {/* === CODE REFERENCE === */}
          <section>
            <SectionHeader title="Code Reference" color="pink" />

            <div className="glass-panel p-8">
              <pre className="text-sm text-slate-300 overflow-x-auto font-mono">
{`/* Glass Surfaces */
.glass-panel     /* Main containers */
.glass-card      /* Interactive cards with hover */
.glass-subtle    /* Secondary containers */

/* Buttons */
.btn-primary     /* Cyan gradient, dark text */
.btn-secondary   /* Glass background, white text */
.btn-outline     /* Cyan border, transparent bg */
.btn-ghost       /* No bg, subtle hover */

/* Inputs */
.input-glass     /* Dark glass input with neon focus */

/* Effects */
.neon-border     /* Cyan glow border */
.shadow-neon     /* Neon box shadow */
.luminous-dot    /* Glowing indicator */
.circuit-connector /* Decorative line */
.text-gradient-cyan /* Cyan text gradient */

/* Border Radius (IMPORTANT) */
rounded          /* 4px - DEFAULT for most elements */
rounded-lg       /* 8px - Panels and containers */
rounded-xl       /* 12px - Feature cards (rare) */
rounded-full     /* Pills, avatars, dots */

/* Colors (Tailwind) */
bg-background    /* #020617 */
text-cyan-bright /* #22D3EE */
text-cyan-neon   /* #4ADEE7 */
text-pink-accent /* #FB37FF */`}
              </pre>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-24 text-center text-slate-500 text-sm">
          <p>Neon Glass Design System &mdash; All Thrive AI</p>
          <p className="mt-2">
            <a href="/styleguide" className="text-cyan-bright hover:underline">Original Styleguide</a>
            {' · '}
            <a href="/explore" className="text-cyan-bright hover:underline">Explore</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

/* Helper Components */

function SectionHeader({ title, color = 'cyan' }: { title: string; color?: 'cyan' | 'pink' }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <h2 className="text-3xl font-bold">{title}</h2>
      <div className={`h-[1px] flex-1 bg-gradient-to-r ${
        color === 'pink' ? 'from-pink-500/50' : 'from-cyan-500/50'
      } to-transparent opacity-30`} />
    </div>
  );
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="text-center">
      <div
        className="h-20 rounded-xl mb-2 border border-white/10"
        style={{ backgroundColor: value }}
      />
      <p className="text-sm font-medium text-white">{name}</p>
      <code className="text-xs text-slate-400">{value}</code>
    </div>
  );
}

function TierSwatch({ name, color, gradientFrom, gradientTo, description }: {
  name: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div
        className="h-16 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        <span className="text-white text-xs font-bold drop-shadow-md">{name}</span>
      </div>
      <p className="text-sm font-medium" style={{ color }}>{name}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}


function RaritySwatch({ name, gradientFrom, gradientTo }: {
  name: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="text-center">
      <div
        className="h-14 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
      >
        <span className="text-white text-sm font-bold drop-shadow-md">{name}</span>
      </div>
      <code className="text-xs text-slate-400">{gradientFrom}</code>
    </div>
  );
}

function ActivitySwatch({ name, color }: { name: string; color: string }) {
  return (
    <div className="text-center">
      <div
        className="h-8 w-8 rounded-full mx-auto mb-1 border border-white/10"
        style={{ backgroundColor: color }}
      />
      <p className="text-xs text-slate-400 truncate">{name}</p>
    </div>
  );
}

function JewelSwatch({ name, hex, category }: { name: string; hex: string; category: string }) {
  return (
    <div className="text-center">
      <div
        className="h-16 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
        style={{ backgroundColor: hex }}
      >
        <span className="text-white text-xs font-bold drop-shadow-md">{name}</span>
      </div>
      <p className="text-sm font-medium" style={{ color: hex }}>{name}</p>
      <p className="text-xs text-slate-500 truncate">{category}</p>
      <code className="text-xs text-slate-400">{hex}</code>
    </div>
  );
}

function SectionSwatch({ name, from, to, description }: {
  name: string;
  from: string;
  to: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div
        className="h-16 rounded-xl mb-2 border border-white/10 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        <span className="text-white text-sm font-bold drop-shadow-md">{name}</span>
      </div>
      <p className="text-sm font-medium" style={{ color: from }}>{name}</p>
      <p className="text-xs text-slate-500">{description}</p>
      <code className="text-xs text-slate-400">{from} → {to}</code>
    </div>
  );
}
