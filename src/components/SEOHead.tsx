import React, { useEffect } from 'react';
import { updatePageSchema, resetPageSchema } from '../lib/seoSchema';

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl: string;
  ogType?: string;
  ogImage?: string;
  structuredData?: any;
  noindex?: boolean;
}

export const DEFAULT_SEO: SEOProps = {
  title: 'InvoCentric | Free GST Billing App & Invoice Maker India',
  description: 'InvoCentric is a 100% free GST billing software & invoice maker without watermark. Create professional GST invoices, barcode billing, inventory & POS for small businesses.',
  canonicalUrl: 'https://invocentric.in/',
  ogType: 'website',
  ogImage: 'https://invocentric.in/logo.png',
  keywords: [
    'GST billing software',
    'free invoice maker',
    'invoice software India',
    'barcode generator',
    'pos billing software',
    'inventory management software',
    'small business billing app'
  ]
};

export const SEOHead: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://invocentric.in/logo.png',
  structuredData,
  noindex = false
}) => {
  useEffect(() => {
    // 1. Update Document Title
    document.title = title;

    // 2. Helper to set or create meta tag
    const setMeta = (nameAttr: 'name' | 'property', attrValue: string, contentValue: string) => {
      let el = document.querySelector(`meta[${nameAttr}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(nameAttr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentValue);
    };

    // 3. Update Standard Meta
    setMeta('name', 'description', description);
    if (keywords && keywords.length > 0) {
      setMeta('name', 'keywords', keywords.join(', '));
    }
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // 4. Update Canonical Tag
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // 5. Update Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:site_name', 'InvoCentric');
    setMeta('property', 'og:locale', 'en_IN');

    // 6. Update Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);

    // 7. Update Single Master Structured Data JSON-LD
    if (structuredData) {
      updatePageSchema(structuredData);
    }

    return () => {
      if (structuredData) {
        resetPageSchema();
      }
    };
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, structuredData, noindex]);

  return null;
};
