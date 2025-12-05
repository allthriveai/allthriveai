import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { AboutContent } from '@/components/about/AboutContent';
import { analytics } from '@/utils/analytics';

export default function AboutPage() {
  useEffect(() => {
    analytics.aboutPageViewed();
  }, []);

  return (
    <DashboardLayout>
      <SEO {...SEOPresets.about} />
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Banner */}
          <div className="relative w-full h-48 bg-gradient-to-br from-cyan-500/20 via-background to-pink-accent/10 flex items-center justify-center overflow-hidden rounded-2xl mb-8">
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
            <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[80px]" />
            <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] rounded-full bg-pink-accent/10 blur-[60px]" />
            <div className="relative text-center z-10">
              <div className="text-6xl mb-3">🌟</div>
              <p className="text-3xl font-bold text-white">All Thrive AI</p>
              <p className="text-lg text-cyan-bright">Where creators thrive together</p>
            </div>
          </div>

          {/* Content */}
          <AboutContent />
        </div>
      </div>
    </DashboardLayout>
  );
}
