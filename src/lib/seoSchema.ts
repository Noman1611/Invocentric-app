/**
 * Centralized SEO JSON-LD Schema Manager for InvoCentric.
 * 
 * Guarantees that EXACTLY ONE <script type="application/ld+json"> tag exists in the DOM at any time.
 * Prevents "Review has multiple aggregate ratings" Google Search Console errors.
 */

export const DEFAULT_HOME_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://invocentric.in/#website",
      "url": "https://invocentric.in/",
      "name": "InvoCentric",
      "alternateName": [
        "InvoCentric Billing",
        "InvoCentric App",
        "InvoCentric Invoice Maker"
      ],
      "description": "InvoCentric is a Free GST Billing Software and Invoice Maker web application. (Note: Not to be confused with IT staffing firms like Innovcentric LLC).",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://invocentric.in/?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://invocentric.in/#software",
      "name": "InvoCentric",
      "operatingSystem": "All (Web, Android, iOS, Windows, Mac)",
      "applicationCategory": "BusinessApplication, AccountingApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "INR"
      },
      "description": "Free GST Billing & Invoicing software application with Live Camera Barcode Scanner, PDF Invoice Sharing, and Offline Khata Book Ledger for retail shops and small businesses.",
      "featureList": [
        "GST & Non-GST Invoice Generation with CGST/SGST/IGST calculation",
        "Direct Mobile Camera Barcode Scanning for items",
        "Offline-ready Vyapar Khata ledger log & Bahi-Khata books",
        "Immediate PDF invoice download and quick WhatsApp sharing",
        "Thermal Printer support (2-inch and 3-inch bluetooth & USB)",
        "Daily Cash Book & profit/loss bookkeeping ledger",
        "Automatic offline local storage backup & security"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "1280"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://invocentric.in/#organization",
      "name": "InvoCentric",
      "url": "https://invocentric.in/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://invocentric.in/logo.png",
        "width": "512",
        "height": "512"
      },
      "sameAs": [
        "https://github.com/InvoCentric"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "nomanshaikh1999@gmail.com"
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://invocentric.in/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does InvoCentric offer a free plan? (क्या InvoCentric में फ्री प्लान उपलब्ध है?)",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! InvoCentric offers a Free Plan with no credit card required, allowing you to create invoices, manage up to 30 customers and 50 items, and use offline storage. A Pro Plan is available at ₹199/month for unlimited items, cloud sync, and advanced features."
          }
        },
        {
          "@type": "Question",
          "name": "How do I print GST bills offline to a thermal printer?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "You can connect any standard thermal printer (2-inch or 3-inch bluetooth/USB receipt printers) or standard laser printers directly from your web browser or phone. InvoCentric generates perfectly formatted thermal bills."
          }
        },
        {
          "@type": "Question",
          "name": "Can I scan product barcodes using my mobile camera?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! InvoCentric features a fully integrated mobile camera barcode scanner. Simply open the app on your phone, point the camera at any product barcode, and it will automatically find the item and add it to the bill instantly."
          }
        },
        {
          "@type": "Question",
          "name": "Does InvoCentric work offline without internet? (क्या यह ऑफलाइन बिना इंटरनेट के काम करता है?)",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! InvoCentric is designed offline-first, saving sales, invoices, and customer records locally in your browser storage so you can work without an internet connection. Pro users can also enable cloud backup and multi-device sync."
          }
        },
        {
          "@type": "Question",
          "name": "Can I manage customer credit (Bahi Khata/Udhar Ledger) in InvoCentric?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. It has a built-in Customer Ledger and Statement Generator (Khata Book). You can track credit (Udhaar) and payments (Jama) for each customer, generate professional PDF ledgers, and share client statements on WhatsApp."
          }
        }
      ]
    }
  ]
};

const MASTER_SCRIPT_ID = 'invo-schema-jsonld';

/**
 * Updates the single application/ld+json script tag in the DOM with the provided schema.
 * Purges all duplicate script tags to ensure 100% compliance with Google Structured Data standards.
 */
export function updatePageSchema(schemaData: any): void {
  if (typeof document === 'undefined') return;

  // 1. Locate the master schema script tag
  let master = document.getElementById(MASTER_SCRIPT_ID) as HTMLScriptElement | null;
  if (!master) {
    master = document.querySelector('script[type="application/ld+json"]');
    if (master) {
      master.id = MASTER_SCRIPT_ID;
    }
  }

  // 2. Remove ALL other script[type="application/ld+json"] tags from document to eliminate duplicates
  const allJsonLd = document.querySelectorAll('script[type="application/ld+json"]');
  allJsonLd.forEach(tag => {
    if (tag !== master) {
      tag.remove();
    }
  });

  // 3. If master didn't exist, create it
  if (!master) {
    master = document.createElement('script');
    master.id = MASTER_SCRIPT_ID;
    master.type = 'application/ld+json';
    document.head.appendChild(master);
  }

  // 4. Update the content
  try {
    master.textContent = JSON.stringify(schemaData || DEFAULT_HOME_SCHEMA);
  } catch (e) {
    console.error('Error stringifying structured schema data:', e);
  }
}

/**
 * Resets the single JSON-LD script back to the default homepage schema.
 */
export function resetPageSchema(): void {
  updatePageSchema(DEFAULT_HOME_SCHEMA);
}
