export default function StyleGuidePage() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-gradient mb-2">All Thrive AI Style Guide</h1>
          <p className="text-muted mb-4">Design system with glassmorphism and brand gradients</p>
          <p className="text-sm text-muted">Global border radius: 4px</p>
        </div>

        {/* 1. FOUNDATION - Colors */}
        <section className="mb-16">
          <h2 className="mb-8">Foundation</h2>

          <h3 className="mb-4">Core Brand Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            <div className="text-center">
              <div className="h-24 rounded mb-2 border border-slate-200 bg-brand-light"></div>
              <p className="text-sm font-semibold">Light</p>
              <code className="text-xs text-muted">#F2F5FA</code>
            </div>
            <div className="text-center">
              <div className="h-24 bg-brand-teal rounded mb-2"></div>
              <p className="text-sm font-semibold">Teal</p>
              <code className="text-xs text-muted">#3bd4cb</code>
            </div>
            <div className="text-center">
              <div className="h-24 bg-brand-cyan rounded mb-2"></div>
              <p className="text-sm font-semibold">Cyan</p>
              <code className="text-xs text-muted">#39bdd6</code>
            </div>
            <div className="text-center">
              <div className="h-24 bg-brand-blue rounded mb-2"></div>
              <p className="text-sm font-semibold">Blue</p>
              <code className="text-xs text-muted">#4991e5</code>
            </div>
            <div className="text-center">
              <div className="h-24 bg-brand-dark rounded mb-2 border border-slate-700"></div>
              <p className="text-sm font-semibold">Dark</p>
              <code className="text-xs text-muted">#080b12</code>
            </div>
          </div>

          <h3 className="mb-4">Glassmorphism</h3>
          <p className="text-sm text-muted mb-6">Frosted glass effect with backdrop blur and transparency - the defining visual style of the site</p>

          <div className="space-y-6 mb-12">
            <div>
              <h4 className="text-sm font-semibold mb-3">Light Mode</h4>
              <div className="bg-gradient-to-br from-slate-200 via-slate-300 to-slate-200 p-8 rounded">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/50 backdrop-blur-glass-sm border border-white/20 shadow-glass-sm p-6 rounded">
                    <h5 className="font-semibold mb-2 text-slate-900">Subtle</h5>
                    <p className="text-slate-600 text-sm mb-2">50% opacity, 8px blur</p>
                    <code className="text-xs text-slate-700">glass-subtle</code>
                  </div>
                  <div className="bg-white/70 backdrop-blur-glass border border-white/30 shadow-glass p-6 rounded">
                    <h5 className="font-semibold mb-2 text-slate-900">Standard</h5>
                    <p className="text-slate-600 text-sm mb-2">70% opacity, 12px blur</p>
                    <code className="text-xs text-slate-700">glass</code>
                  </div>
                  <div className="glass-strong border border-white/20 shadow-glass-lg p-6 rounded">
                    <h5 className="font-semibold mb-2 text-slate-900">Strong</h5>
                    <p className="text-slate-600 text-sm mb-2">70% opacity, 40px blur</p>
                    <code className="text-xs text-slate-700">glass-strong</code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Dark Mode</h4>
              <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-700 p-8 rounded">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-black/30 backdrop-blur-glass-sm border border-white/10 shadow-glass p-6 rounded">
                    <h5 className="font-semibold mb-2 text-white">Subtle</h5>
                    <p className="text-slate-300 text-sm mb-2">30% black, 8px blur</p>
                    <code className="text-xs text-slate-200">glass-subtle</code>
                  </div>
                  <div className="bg-black/40 backdrop-blur-glass border border-white/15 shadow-glass-lg p-6 rounded">
                    <h5 className="font-semibold mb-2 text-white">Standard</h5>
                    <p className="text-slate-300 text-sm mb-2">40% black, 12px blur</p>
                    <code className="text-xs text-slate-200">glass</code>
                  </div>
                  <div className="bg-black/50 backdrop-blur-glass-lg border border-white/20 shadow-glass-xl p-6 rounded">
                    <h5 className="font-semibold mb-2 text-white">Strong</h5>
                    <p className="text-slate-300 text-sm mb-2">50% black, 16px blur</p>
                    <code className="text-xs text-slate-200">glass-strong</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h3 className="mb-4">Color Scales</h3>
          <div className="space-y-6 mb-12">
            <div>
              <h4 className="text-sm font-semibold mb-3">Primary (Teal/Cyan)</h4>
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center">
                  <div className="h-16 bg-primary-100 rounded mb-1"></div>
                  <p className="text-xs">100</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-primary-300 rounded mb-1"></div>
                  <p className="text-xs">300</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-primary-500 rounded mb-1"></div>
                  <p className="text-xs font-bold">500</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-primary-700 rounded mb-1"></div>
                  <p className="text-xs">700</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-primary-900 rounded mb-1"></div>
                  <p className="text-xs">900</p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Accent (Blue)</h4>
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center">
                  <div className="h-16 bg-accent-100 rounded mb-1"></div>
                  <p className="text-xs">100</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-accent-300 rounded mb-1"></div>
                  <p className="text-xs">300</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-accent-400 rounded mb-1"></div>
                  <p className="text-xs font-bold">400</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-accent-600 rounded mb-1"></div>
                  <p className="text-xs">600</p>
                </div>
                <div className="text-center">
                  <div className="h-16 bg-accent-800 rounded mb-1"></div>
                  <p className="text-xs">800</p>
                </div>
              </div>
            </div>
          </div>

          <h3 className="mb-4">Semantic Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="h-20 bg-success-500 rounded mb-2"></div>
              <p className="text-sm">Success</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-warning-500 rounded mb-2"></div>
              <p className="text-sm">Warning</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-error-500 rounded mb-2"></div>
              <p className="text-sm">Error</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-info-500 rounded mb-2"></div>
              <p className="text-sm">Info</p>
            </div>
          </div>
        </section>

        {/* 2. VISUAL DESIGN */}
        <section className="mb-16">
          <h2 className="mb-8">Visual Design</h2>

          <h3 className="mb-4">Brand Gradients</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            <div className="glass p-6 rounded">
              <div className="h-24 bg-gradient-primary rounded mb-3 flex items-center justify-center">
                <p className="text-white font-bold">Primary Gradient</p>
              </div>
              <p className="text-sm text-muted mb-1">Teal to Cyan</p>
              <code className="text-xs">bg-gradient-primary</code>
            </div>
            <div className="glass p-6 rounded">
              <div className="h-24 bg-gradient-to-r from-primary-500 to-accent-500 rounded mb-3 flex items-center justify-center">
                <p className="text-white font-bold">Teal to Blue</p>
              </div>
              <p className="text-sm text-muted mb-1">Primary to Accent</p>
              <code className="text-xs">from-primary-500 to-accent-500</code>
            </div>
            <div className="glass p-6 rounded">
              <div className="h-24 bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700 rounded mb-3 flex items-center justify-center">
                <p className="text-white font-bold">Midnight to Light</p>
              </div>
              <p className="text-sm text-muted mb-1">Deep navy to lighter slate</p>
              <code className="text-xs">from-slate-950 via-slate-800 to-slate-700</code>
            </div>
            <div className="glass p-6 rounded">
              <div className="h-24 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-600 rounded mb-3 flex items-center justify-center">
                <p className="text-white font-bold">Deep Navy Fade</p>
              </div>
              <p className="text-sm text-muted mb-1">Navy to blue-gray</p>
              <code className="text-xs">from-slate-900 via-slate-700 to-slate-600</code>
            </div>
          </div>

        </section>

        {/* 3. TYPOGRAPHY */}
        <section className="mb-16">
          <h2 className="mb-8">Typography</h2>
          <div className="space-y-6 card">
            <div>
              <h1 className="mb-2">Heading 1</h1>
              <code className="text-xs text-muted">text-5xl md:text-6xl lg:text-7xl</code>
            </div>
            <div>
              <h2 className="mb-2">Heading 2</h2>
              <code className="text-xs text-muted">text-4xl md:text-5xl</code>
            </div>
            <div>
              <h3 className="mb-2">Heading 3</h3>
              <code className="text-xs text-muted">text-2xl md:text-3xl</code>
            </div>
            <div>
              <p className="text-lg mb-2">Large body text - The quick brown fox jumps over the lazy dog.</p>
              <code className="text-xs text-muted">text-lg</code>
            </div>
            <div>
              <p className="mb-2">Regular body text - The quick brown fox jumps over the lazy dog.</p>
              <code className="text-xs text-muted">text-base</code>
            </div>
            <div>
              <p className="text-sm text-muted mb-2">Small muted text - The quick brown fox jumps over the lazy dog.</p>
              <code className="text-xs text-muted">text-sm text-muted</code>
            </div>
            <div>
              <p className="text-gradient text-3xl font-bold mb-2">Gradient Text</p>
              <code className="text-xs text-muted">text-gradient</code>
            </div>
          </div>
        </section>

        {/* 4. COMPONENTS */}
        <section className="mb-16">
          <h2 className="mb-8">Components</h2>

          <div className="space-y-12">
            {/* Buttons */}
            <div>
              <h3 className="mb-4">Buttons</h3>
              <div className="glass p-8 rounded space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3">Primary (Liquid Glass)</h4>
                  <p className="text-xs text-muted mb-3">Gradient with glassmorphism, backdrop blur, hover scale</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <button className="btn-primary btn-sm">Small</button>
                    <button className="btn-primary">Regular</button>
                    <button className="btn-primary btn-lg">Large</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3">Secondary (Glass)</h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-secondary btn-sm">Small</button>
                    <button className="btn-secondary">Regular</button>
                    <button className="btn-secondary btn-lg">Large</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3">Outline</h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-outline btn-sm">Small</button>
                    <button className="btn-outline">Regular</button>
                    <button className="btn-outline btn-lg">Large</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3">Ghost</h4>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-ghost btn-sm">Small</button>
                    <button className="btn-ghost">Regular</button>
                    <button className="btn-ghost btn-lg">Large</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Inputs */}
            <div>
              <h3 className="mb-4">Form Inputs</h3>
              <div className="glass-strong p-8 rounded max-w-md space-y-4">
                <div>
                  <label className="label">Regular Input</label>
                  <input type="text" className="input" placeholder="Enter text..." />
                </div>
                <div>
                  <label className="label">Input with Error</label>
                  <input type="text" className="input input-error" placeholder="Invalid input..." />
                  <p className="text-sm mt-1 text-error-500">This field is required</p>
                </div>
                <div>
                  <label className="label">Disabled Input</label>
                  <input type="text" className="input opacity-50 cursor-not-allowed" placeholder="Disabled..." disabled />
                </div>
              </div>
            </div>

            {/* Cards */}
            <div>
              <h3 className="mb-4">Cards</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="glass-subtle p-6 rounded">
                  <h4 className="mb-2">Subtle Glass</h4>
                  <p className="text-muted text-sm">Light glass for backgrounds</p>
                </div>
                <div className="glass p-6 rounded">
                  <h4 className="mb-2">Standard Glass</h4>
                  <p className="text-muted text-sm">Default card style</p>
                </div>
                <div className="card-hover">
                  <h4 className="mb-2">Hoverable</h4>
                  <p className="text-muted text-sm">Hover for lift effect</p>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h3 className="mb-4">Badges</h3>
              <div className="glass p-6 rounded">
                <div className="flex flex-wrap gap-3">
                  <span className="badge-primary">Primary</span>
                  <span className="badge inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-100 dark:bg-success-950 text-success-700 dark:text-success-300">Success</span>
                  <span className="badge inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-warning-100 dark:bg-warning-950 text-warning-700 dark:text-warning-300">Warning</span>
                  <span className="badge inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-error-100 dark:bg-error-950 text-error-700 dark:text-error-300">Error</span>
                  <span className="badge inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-info-100 dark:bg-info-950 text-info-700 dark:text-info-300">Info</span>
                </div>
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="mb-4">Links</h3>
              <div className="card">
                <p>This is a paragraph with a <a href="#" className="link">standard link</a> that has hover effects.</p>
              </div>
            </div>

            {/* Shadows */}
            <div>
              <h3 className="mb-4">Shadows</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-strong p-8 rounded shadow-brand">
                  <h4 className="mb-2">Brand Shadow</h4>
                  <p className="text-muted text-sm mb-1">Teal-tinted shadow</p>
                  <code className="text-xs">shadow-brand</code>
                </div>
                <div className="glass-strong p-8 rounded shadow-brand-lg">
                  <h4 className="mb-2">Brand Shadow Large</h4>
                  <p className="text-muted text-sm mb-1">Enhanced teal glow</p>
                  <code className="text-xs">shadow-brand-lg</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. CODE EXAMPLES */}
        <section>
          <h2 className="mb-8">Code Examples</h2>
          <div className="glass-strong p-8 rounded font-mono text-sm overflow-x-auto">
            <pre className="text-slate-800 dark:text-slate-200">{`// Buttons
<button className="btn-primary">Primary Action</button>
<button className="btn-secondary">Secondary</button>
<button className="btn-outline">Outline</button>

// Glassmorphism Cards
<div className="glass p-6 rounded">Standard glass card</div>
<div className="glass-subtle p-6 rounded">Subtle glass</div>
<div className="glass-strong p-6 rounded">Strong glass</div>

// Brand Gradient
<div className="bg-gradient-primary p-8 rounded">
  <p className="text-white">Primary gradient</p>
</div>

// Gradient Text
<h1 className="text-gradient">All Thrive AI</h1>

// Brand Colors
<div className="bg-primary-500">Teal</div>
<div className="bg-accent-400">Blue</div>
<div className="bg-brand-light">Light background</div>

// Form Inputs
<input type="text" className="input" placeholder="Text" />
<input type="text" className="input input-error" />

// Badges
<span className="badge-primary">Primary</span>`}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
