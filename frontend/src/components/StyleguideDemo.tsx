import { useState } from 'react';

/**
 * StyleguideDemo Component - Neon Glass Edition
 *
 * Showcase for the new AllThrive AI aesthetic:
 * - Dark futuristic theme
 * - Neon lights (teal, cyan, electric blue, pink)
 * - Glassmorphism panels
 * - Soft radial glows
 */
export default function StyleguideDemo() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans text-white selection:bg-cyan-neon/30">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">

        {/* Header Section */}
        <header className="mb-16 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-neon text-xs font-medium mb-6 tracking-wider uppercase">
            <span className="luminous-dot animate-pulse" />
            Design System v2.0
          </div>

          <h1 className="mb-6">
            Neon <span className="text-gradient-cyan">Glass</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A futuristic UI language featuring deep navy gradients, translucent glass panels,
            and electric cyan accents.
          </p>
        </header>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-12">
          <div className="glass-subtle p-1 inline-flex rounded-xl">
            {['overview', 'components', 'typography', 'colors'].map((tab) => (
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

          {/* === GLASS PANELS SECTION === */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold">Glass Surfaces</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent opacity-30" />
            </div>

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

          {/* === INTERACTIVE ELEMENTS === */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold">Interactive</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-pink-500/50 to-transparent opacity-30" />
            </div>

            <div className="glass-panel p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {/* Buttons */}
                <div className="space-y-8">
                  <h3 className="text-xl text-slate-300 mb-6">Buttons</h3>
                  <div className="flex flex-wrap gap-4 items-center">
                    <button className="btn-primary">
                      Primary Action
                    </button>
                    <button className="btn-secondary">
                      Secondary
                    </button>
                    <button className="btn-outline">
                      Outline
                    </button>
                    <button className="btn-ghost">
                      Ghost
                    </button>
                  </div>

                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Primary Glow</span>
                      <button className="btn-primary shadow-neon-strong">Glowing</button>
                    </div>
                  </div>
                </div>

                {/* Form Elements */}
                <div className="space-y-6">
                  <h3 className="text-xl text-slate-300 mb-2">Inputs</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-cyan-bright mb-2 uppercase tracking-wider">System Access Code</label>
                      <input type="text" placeholder="ENTER CODE..." className="input-glass" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Encrypted Message</label>
                      <textarea placeholder="Type your secure message..." rows={3} className="input-glass resize-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === TYPOGRAPHY & ACCENTS === */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold">Typography & Accents</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent opacity-30" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-card relative">
                <h1 className="mb-4">Display Heading</h1>
                <h2 className="text-white mb-2">Section Title</h2>
                <p className="text-slate-400 leading-relaxed mb-6">
                  Body text should be legible with high contrast. We use <span className="text-cyan-bright">Inter</span> for maximum readability.
                  Accents like the <span className="text-gradient-cyan font-bold">gradient text</span> add futuristic flair.
                </p>

                <div className="flex gap-4 mt-8">
                  <div className="bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 rounded-lg text-cyan-bright text-sm font-mono">
                    font-mono
                  </div>
                  <div className="bg-pink-500/10 border border-pink-500/30 px-4 py-2 rounded-lg text-pink-400 text-sm font-mono">
                    accent-pink
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Circuit Effect */}
                <div className="glass-panel p-8 relative overflow-hidden">
                  <div className="circuit-connector top-8" />
                  <div className="circuit-connector top-24 opacity-50" />
                  <div className="circuit-connector bottom-8 opacity-30" />

                  <div className="relative z-10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="luminous-dot" />
                      <span className="text-cyan-bright font-medium">System Online</span>
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      STATUS: OPERATIONAL
                    </div>
                  </div>
                </div>

                {/* Glow Effects */}
                <div className="glass-panel p-8 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-radial from-cyan-500/20 to-transparent opacity-50" />
                  <div className="relative z-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 mx-auto mb-4 shadow-neon flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-bold">Energy Core</h3>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
