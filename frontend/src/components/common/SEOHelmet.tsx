/**
 * SEO Component - Production-ready meta tag management
 *
 * Uses react-helmet-async for proper memory management and SSR support.
 * Fixes memory leak issues from direct DOM manipulation.
 *
 * Installation required:
 * npm install react-helmet-async
 */

import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
}

// Get base URL from environment
const getBaseUrl = (): string => {
  // Use environment variable if available
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }

  // Fallback: construct from window location
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
    return `${protocol}//${hostname}${portSuffix}`;
  }

  // Final fallback for SSR
  return 'https://allthrive.ai';
};

/**
 * SEO Component - Dynamically updates meta tags for each page
 * Optimized for search engines, social media, and LLM discoverability
 */
export function SEO({
  title = 'All Thrive - The AI Network Collective',
  description = 'Share what you offer. Ask for what you need. The AI Network Collective.',
  keywords = 'AI collective, AI network, AI community, share AI work, ask for help, AI builders, AI collaboration, offers, asks, AI marketplace',
  image = `${getBaseUrl()}/og-image.jpg`,
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const location = useLocation();
  const baseUrl = getBaseUrl();
  const currentUrl = url || `${baseUrl}${location.pathname}`;
  const fullTitle = title.includes('All Thrive') ? title : `${title} | All Thrive AI`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />

      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content="All Thrive AI" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="All Thrive AI - AI Portfolio Platform" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content="All Thrive AI - AI Portfolio Platform" />
    </Helmet>
  );
}

// Preset configurations for common pages
export const SEOPresets = {
  home: {
    title: 'All Thrive - The AI Network Collective',
    description: 'Share what you offer. Ask for what you need. The AI Network Collective.',
    keywords: 'AI collective, AI network, AI community, share AI work, ask for help, AI builders, AI collaboration, offers, asks',
  },
  about: {
    title: 'About All Thrive',
    description: 'The AI Network Collective - Share what you offer. Ask for what you need.',
    keywords: 'about allthrive, AI collective, AI network, AI community, offers, asks',
  },
  explore: {
    title: 'Explore AI Projects',
    description: 'Discover innovative AI projects from the community. Browse machine learning models, deep learning experiments, NLP projects, computer vision applications, and more.',
    keywords: 'AI projects, machine learning projects, discover AI, AI portfolio examples, ML projects',
  },
  learn: {
    title: 'Learn AI & Machine Learning',
    description: 'Level up your AI skills through gamified learning challenges. Interactive courses, coding exercises, and achievements in deep learning, NLP, computer vision, and more.',
    keywords: 'learn AI, machine learning courses, AI challenges, gamified learning, coding exercises, AI education',
  },
  tools: {
    title: 'AI Tools Directory',
    description: 'Browse the comprehensive directory of AI tools, frameworks, and libraries. Find the right tools for your ML projects with reviews and comparisons.',
    keywords: 'AI tools, machine learning frameworks, ML libraries, AI tool directory, developer tools',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your All Thrive AI dashboard - manage projects, track progress, and view achievements.',
    noindex: true,
  },
  profile: (username: string) => ({
    title: `${username} - All Thrive AI Profile`,
    description: `View ${username}'s AI project portfolio, achievements, and contributions on All Thrive AI.`,
    keywords: `${username}, AI portfolio, developer profile, AI projects`,
  }),
  project: (projectName: string) => ({
    title: projectName,
    description: `${projectName} - AI project showcase on All Thrive AI`,
    keywords: 'AI project, machine learning, project showcase',
    type: 'article',
  }),
};

export default SEO;
