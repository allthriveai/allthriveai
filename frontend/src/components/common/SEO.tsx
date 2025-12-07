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
  title = 'All Thrive - Showcase, Learn & Play with AI',
  description = 'The community platform for AI creators. Automate your AI portfolio, learn something new with gamified challenges, and compete in Prompt Battles. Create with AI anywhere. Consolidate here. Thrive together.',
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

// Re-export presets from separate file for Fast Refresh compatibility
export { SEOPresets } from './seoPresets';
