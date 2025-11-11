export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom">
        <h1 className="mb-2">AllThrive AI Style Guide</h1>
        <p className="text-muted mb-12">Design system and component library</p>

        {/* Colors */}
        <section className="mb-16">
          <h2 className="mb-6">Brand Colors</h2>

          <h3 className="mb-4">Primary (Purple)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="text-center">
              <div className="h-20 bg-brand-primary-100 rounded-lg mb-2"></div>
              <p className="text-sm">100</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-primary-300 rounded-lg mb-2"></div>
              <p className="text-sm">300</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-primary-500 rounded-lg mb-2"></div>
              <p className="text-sm font-bold">500 (Main)</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-primary-700 rounded-lg mb-2"></div>
              <p className="text-sm">700</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-primary-900 rounded-lg mb-2"></div>
              <p className="text-sm">900</p>
            </div>
          </div>

          <h3 className="mb-4">Secondary (Blue)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="text-center">
              <div className="h-20 bg-brand-secondary-100 rounded-lg mb-2"></div>
              <p className="text-sm">100</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-secondary-300 rounded-lg mb-2"></div>
              <p className="text-sm">300</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-secondary-500 rounded-lg mb-2"></div>
              <p className="text-sm font-bold">500 (Main)</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-secondary-700 rounded-lg mb-2"></div>
              <p className="text-sm">700</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-brand-secondary-900 rounded-lg mb-2"></div>
              <p className="text-sm">900</p>
            </div>
          </div>

          <h3 className="mb-4">Semantic Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="h-20 bg-success rounded-lg mb-2"></div>
              <p className="text-sm">Success</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-warning rounded-lg mb-2"></div>
              <p className="text-sm">Warning</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-error rounded-lg mb-2"></div>
              <p className="text-sm">Error</p>
            </div>
            <div className="text-center">
              <div className="h-20 bg-info rounded-lg mb-2"></div>
              <p className="text-sm">Info</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className="mb-6">Typography</h2>
          <div className="space-y-4 card">
            <h1>Heading 1 - The quick brown fox</h1>
            <h2>Heading 2 - The quick brown fox</h2>
            <h3>Heading 3 - The quick brown fox</h3>
            <h4>Heading 4 - The quick brown fox</h4>
            <h5>Heading 5 - The quick brown fox</h5>
            <h6>Heading 6 - The quick brown fox</h6>
            <p className="text-lg">Large paragraph text - The quick brown fox jumps over the lazy dog.</p>
            <p>Regular paragraph text - The quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-muted">Small muted text - The quick brown fox jumps over the lazy dog.</p>
            <p className="text-gradient text-3xl font-bold">Gradient Text Effect</p>
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-16">
          <h2 className="mb-6">Buttons</h2>
          <div className="card space-y-6">
            <div>
              <h4 className="mb-4">Primary Buttons</h4>
              <div className="flex flex-wrap gap-4">
                <button className="btn-primary btn-sm">Small Primary</button>
                <button className="btn-primary">Regular Primary</button>
                <button className="btn-primary btn-lg">Large Primary</button>
              </div>
            </div>

            <div>
              <h4 className="mb-4">Secondary Buttons</h4>
              <div className="flex flex-wrap gap-4">
                <button className="btn-secondary btn-sm">Small Secondary</button>
                <button className="btn-secondary">Regular Secondary</button>
                <button className="btn-secondary btn-lg">Large Secondary</button>
              </div>
            </div>

            <div>
              <h4 className="mb-4">Outline Buttons</h4>
              <div className="flex flex-wrap gap-4">
                <button className="btn-outline btn-sm">Small Outline</button>
                <button className="btn-outline">Regular Outline</button>
                <button className="btn-outline btn-lg">Large Outline</button>
              </div>
            </div>

            <div>
              <h4 className="mb-4">Ghost Buttons</h4>
              <div className="flex flex-wrap gap-4">
                <button className="btn-ghost btn-sm">Small Ghost</button>
                <button className="btn-ghost">Regular Ghost</button>
                <button className="btn-ghost btn-lg">Large Ghost</button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Inputs */}
        <section className="mb-16">
          <h2 className="mb-6">Form Inputs</h2>
          <div className="card max-w-md space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Regular Input</label>
              <input type="text" className="input" placeholder="Enter text..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Input with Error</label>
              <input type="text" className="input input-error" placeholder="Invalid input..." />
              <p className="text-error text-sm mt-1">This field is required</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Disabled Input</label>
              <input type="text" className="input opacity-50 cursor-not-allowed" placeholder="Disabled..." disabled />
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="mb-16">
          <h2 className="mb-6">Cards</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h4 className="mb-2">Standard Card</h4>
              <p className="text-muted">This is a standard card component with shadow and border.</p>
            </div>
            <div className="card-hover">
              <h4 className="mb-2">Hoverable Card</h4>
              <p className="text-muted">This card has a hover effect with lift animation.</p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-16">
          <h2 className="mb-6">Badges</h2>
          <div className="card">
            <div className="flex flex-wrap gap-4">
              <span className="badge-primary">Primary Badge</span>
              <span className="badge-success">Success Badge</span>
              <span className="badge-warning">Warning Badge</span>
              <span className="badge-error">Error Badge</span>
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="mb-16">
          <h2 className="mb-6">Links</h2>
          <div className="card">
            <p>
              This is a paragraph with a <a href="#" className="link">standard link</a> that has hover effects.
            </p>
          </div>
        </section>

        {/* Shadows */}
        <section className="mb-16">
          <h2 className="mb-6">Shadows</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-lg shadow-brand">
              <h4>Brand Shadow</h4>
              <p className="text-muted">Teal-tinted shadow</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-brand-lg">
              <h4>Brand Shadow Large</h4>
              <p className="text-muted">Larger teal-tinted shadow</p>
            </div>
          </div>
        </section>

        {/* Usage Examples */}
        <section>
          <h2 className="mb-6">Usage in Code</h2>
          <div className="card bg-gray-900 text-gray-100 font-mono text-sm overflow-x-auto">
            <pre>{`// Button Examples
<button className="btn-primary">Click me</button>
<button className="btn-outline btn-sm">Small Outline</button>

// Card Example
<div className="card-hover">
  <h3>Card Title</h3>
  <p className="text-muted">Card content</p>
</div>

// Input Example
<input type="text" className="input" />

// Badge Example
<span className="badge-success">Active</span>

// Custom Colors
<div className="bg-brand-primary-500 text-white">
  Primary colored div
</div>`}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
