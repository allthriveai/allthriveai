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

// Get base URL from environment or window location
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
    return `${protocol}//${hostname}${portSuffix}`;
  }
  return 'https://allthrive.ai';
};

/**
 * SEO Component - Dynamically updates meta tags for each page
 * Optimized for search engines and social media sharing
 */
export function SEO({
  title = 'All Thrive - Gamified AI Portfolio Platform',
  description = 'The gamified AI portfolio platform for creators. Build your AI portfolio, compete in Prompt Battles, earn achievements, and level up your skills.',
  keywords = 'AI creations, AI portfolio, AI projects, Midjourney, Replit, Claude, AI showcase, AI community, AI builders, AI tools, cross-platform AI',
  image,
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const location = useLocation();
  const baseUrl = getBaseUrl();
  const defaultImage = `${baseUrl}/og-image.jpg`;
  const currentUrl = url || `${baseUrl}${location.pathname}`;
  const fullTitle = title.includes('All Thrive') ? title : `${title} | All Thrive AI`;
  const ogImage = image || defaultImage;

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
      { property: 'og:image', content: ogImage },
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
      { name: 'twitter:image', content: ogImage },
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

// Re-export presets from separate file for Fast Refresh compatibility
export { SEOPresets } from './seoPresets';
