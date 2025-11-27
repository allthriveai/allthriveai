import { useEffect } from 'react';
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

/**
 * SEO Component - Dynamically updates meta tags for each page
 * Optimized for search engines and social media sharing
 */
export function SEO({
  title = 'AllThrive AI - AI Portfolio Platform with Gamified Learning & Discovery',
  description = 'Showcase your AI projects, discover innovative work, and level up your skills through interactive challenges. Build your AI portfolio, earn achievements, and connect with the community.',
  keywords = 'AI portfolio, machine learning projects, AI learning platform, gamified learning, AI community, project showcase, AI tools, deep learning, developer portfolio, coding challenges',
  image = 'https://allthrive.ai/og-image.jpg',
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const location = useLocation();
  const baseUrl = 'https://allthrive.ai';
  const currentUrl = url || `${baseUrl}${location.pathname}`;
  const fullTitle = title.includes('AllThrive') ? title : `${title} | AllThrive AI`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' },

      // Open Graph
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:url', content: currentUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'AllThrive AI' },

      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:url', content: currentUrl },
    ];

    metaTags.forEach(({ name, property, content }) => {
      const attribute = name ? 'name' : 'property';
      const value = name || property;

      if (!value) return;

      let element = document.querySelector(`meta[${attribute}="${value}"]`);

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    });

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = currentUrl;

    // Cleanup function
    return () => {
      // Don't remove meta tags on unmount, just let the next component update them
    };
  }, [fullTitle, description, keywords, image, currentUrl, type, noindex]);

  return null;
}

// Preset configurations for common pages
export const SEOPresets = {
  home: {
    title: 'AllThrive AI - AI Portfolio Platform with Gamified Learning & Discovery',
    description: 'Showcase your AI projects, discover innovative work, and level up your skills through interactive challenges. Build your AI portfolio, earn achievements, and connect with the community.',
    keywords: 'AI portfolio, machine learning projects, AI learning platform, gamified learning, AI community, project showcase',
  },
  about: {
    title: 'About AllThrive AI',
    description: 'Learn about AllThrive AI - the platform empowering AI practitioners, learners, and researchers to showcase projects, learn through gamification, and connect with the community.',
    keywords: 'about allthrive, AI platform, AI learning, AI community, mission',
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
    description: 'Your AllThrive AI dashboard - manage projects, track progress, and view achievements.',
    noindex: true,
  },
  profile: (username: string) => ({
    title: `${username} - AllThrive AI Profile`,
    description: `View ${username}'s AI project portfolio, achievements, and contributions on AllThrive AI.`,
    keywords: `${username}, AI portfolio, developer profile, AI projects`,
  }),
  project: (projectName: string) => ({
    title: projectName,
    description: `${projectName} - AI project showcase on AllThrive AI`,
    keywords: 'AI project, machine learning, project showcase',
    type: 'article',
  }),
};
