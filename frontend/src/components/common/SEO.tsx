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
  title = 'All Thrive AI - Explore AI Together',
  description = 'Find trending AI projects, automate your portfolio, and grow your skills.',
  keywords = 'AI creations, AI portfolio, AI projects, Midjourney, Replit, Claude, AI showcase, AI community, AI builders, AI tools, cross-platform AI',
  image = 'https://allthrive.ai/og-image.jpg',
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const location = useLocation();
  const baseUrl = 'https://allthrive.ai';
  const currentUrl = url || `${baseUrl}${location.pathname}`;
  const fullTitle = title.includes('All Thrive') ? title : `${title} | All Thrive AI`;

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
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: fullTitle },
      { property: 'og:url', content: currentUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'All Thrive AI' },

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
    title: 'All Thrive AI - Explore AI Together',
    description: 'Find trending AI projects, automate your portfolio, and grow your skills.',
    keywords: 'AI portfolio, AI projects, AI feed, AI discovery, trending AI, AI learning, AI showcase, AI community, AI builders, automate portfolio, explore AI',
  },
  about: {
    title: 'About All Thrive AI',
    description: 'All Thrive AI is where AI creators showcase work from any tool - from Midjourney art to Replit apps to Claude agents. Discover, share, and connect with builders.',
    keywords: 'about allthrive, AI platform, AI creators, AI community, cross-platform AI, AI showcase',
  },
  explore: {
    title: 'Explore AI Creations',
    description: 'Discover AI-generated images, apps, agents, and more from the community. Browse creations made with Midjourney, Replit, Claude, and every AI tool.',
    keywords: 'explore AI, AI creations, AI projects, Midjourney gallery, Replit projects, AI showcase, discover AI',
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
