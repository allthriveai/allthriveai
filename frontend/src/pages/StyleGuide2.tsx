import React from 'react';

const NeonCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-glass-dark backdrop-blur-[16px] border border-brand-neon-teal/20 shadow-hyper-glass rounded-xl p-6 relative overflow-hidden group ${className}`}>
    <div className="absolute inset-0 bg-holo-surface opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

const HoloButton = ({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' }) => {
  const baseClass = "px-6 py-3 rounded-lg font-bold transition-all duration-300 relative overflow-hidden group";
  const variants = {
    primary: "text-brand-dark bg-brand-neon-teal hover:shadow-neon-box hover:scale-105",
    secondary: "text-brand-neon-cyan border border-brand-neon-cyan hover:shadow-neon-box hover:bg-brand-neon-cyan/10"
  };

  return (
    <button className={`${baseClass} ${variants[variant]}`}>
       <span className="relative z-10">{children}</span>
       {variant === 'primary' && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />}
    </button>
  );
};

const ColorSwatch = ({ color, name, hex }: { color: string; name: string; hex: string }) => (
  <div className="flex flex-col gap-2">
    <div className={`h-24 w-full rounded-lg shadow-lg ${color}`} />
    <div>
      <p className="font-bold text-white">{name}</p>
      <p className="text-sm text-gray-400">{hex}</p>
    </div>
  </div>
);

export const StyleGuide2 = () => {
  return (
    <div className="min-h-screen bg-brand-void text-white p-8 md:p-16 font-sans selection:bg-brand-neon-teal selection:text-brand-dark">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto space-y-20">
        <section className="relative">
           <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-neon-teal/20 rounded-full blur-[100px] animate-blob" />
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-neon-purple/20 rounded-full blur-[80px] animate-blob" style={{ animationDelay: '2s' }} />

           <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-brand-neon-teal to-brand-neon-cyan" style={{ textShadow: '0 0 40px rgba(0, 255, 163, 0.3)' }}>
             NEON THRIVE
           </h1>
           <p className="text-2xl text-gray-300 max-w-2xl border-l-4 border-brand-neon-green pl-6">
             Style Guide 2.0: Merging the organic growth of All Thrive with high-tech cyberpunk aesthetics.
           </p>
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-4xl font-bold mb-10 flex items-center gap-4">
            <span className="w-2 h-12 bg-brand-neon-teal shadow-neon-box" />
            Neon Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <ColorSwatch color="bg-brand-neon-teal" name="Neon Teal" hex="#00FFA3" />
            <ColorSwatch color="bg-brand-neon-cyan" name="Cyber Cyan" hex="#00F0FF" />
            <ColorSwatch color="bg-brand-neon-green" name="Bio Green" hex="#39FF14" />
            <ColorSwatch color="bg-brand-neon-purple" name="Electric Purple" hex="#BC13FE" />
          </div>
        </section>

        {/* Components */}
        <section>
           <h2 className="text-4xl font-bold mb-10 flex items-center gap-4">
            <span className="w-2 h-12 bg-brand-neon-purple shadow-neon-box" />
            Hyper-Glass Components
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <NeonCard>
              <h3 className="text-2xl font-bold text-brand-neon-teal mb-4" style={{ textShadow: '0 0 10px rgba(0, 255, 163, 0.5)' }}>Thriving Community</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Connect with AI agents and peers in a high-fidelity environment.
                Our glassmorphism engine ensures maximum readability while maintaining aesthetic supremacy.
              </p>
              <div className="flex gap-4">
                <HoloButton variant="primary">Join Network</HoloButton>
                <HoloButton variant="secondary">Learn More</HoloButton>
              </div>
            </NeonCard>

            <NeonCard className="border-brand-neon-purple/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">System Status</h3>
                <span className="flex items-center gap-2 text-brand-neon-green text-sm font-mono">
                  <span className="w-2 h-2 bg-brand-neon-green rounded-full animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Neural Link', val: '98%' },
                  { label: 'Vector Database', val: '100%' },
                  { label: 'Thrive Index', val: '4.2k' }
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{item.label}</span>
                      <span className="text-brand-neon-cyan font-mono">{item.val}</span>
                    </div>
                    <div className="h-1 bg-brand-obsidian rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-neon-teal to-brand-neon-cyan w-full animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </NeonCard>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StyleGuide2;
