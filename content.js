// SmartCite Content Script - Enhanced for Webpages & Videos
console.log('SmartCite content script loaded on:', window.location.href);

// ========== METADATA EXTRACTION ==========

function extractVideoMetadata() {
  const url = window.location.href;
  const hostname = window.location.hostname;
  
  // YouTube detection and parsing
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    try {
      // YouTube metadata extraction
      const title = document.querySelector('meta[name="title"]')?.content ||
                    document.querySelector('meta[property="og:title"]')?.content ||
                    document.title.replace(' - YouTube', '');
      
      // Try multiple selectors for channel/author
      const uploader = document.querySelector('ytd-channel-name #text')?.textContent?.trim() ||
                       document.querySelector('ytd-video-owner-renderer #text')?.textContent?.trim() ||
                       document.querySelector('meta[name="author"]')?.content ||
                       'Unknown Channel';
      
      const dateElement = document.querySelector('meta[itemprop="datePublished"]')?.content ||
                         document.querySelector('yt-formatted-string[aria-label*="Published"]')?.textContent;
      
      const date = dateElement ? new Date(dateElement).getFullYear().toString() : 
                  new Date().getFullYear().toString();
      
      return {
        sourceType: 'video',
        title: title || 'Unknown Video',
        authors: uploader,
        date: date,
        site: 'YouTube',
        domain: 'youtube.com',
        url: url,
        isVideo: true
      };
    } catch (error) {
      console.error('YouTube metadata extraction failed:', error);
    }
  }
  
  // Vimeo detection
  if (hostname.includes('vimeo.com')) {
    try {
      const title = document.querySelector('meta[property="og:title"]')?.content ||
                    document.title.replace(' on Vimeo', '');
      
      const uploader = document.querySelector('meta[name="author"]')?.content ||
                      document.querySelector('.clip_info-user a')?.textContent?.trim() ||
                      'Unknown Creator';
      
      const dateElement = document.querySelector('meta[property="video:release_date"]')?.content;
      const date = dateElement ? new Date(dateElement).getFullYear().toString() : 
                  new Date().getFullYear().toString();
      
      return {
        sourceType: 'video',
        title: title || 'Unknown Video',
        authors: uploader,
        date: date,
        site: 'Vimeo',
        domain: 'vimeo.com',
        url: url,
        isVideo: true
      };
    } catch (error) {
      console.error('Vimeo metadata extraction failed:', error);
    }
  }
  
  return null;
}

function extractAcademicMetadata() {
  const metadata = {};
  const url = window.location.href;
  const domain = document.domain || window.location.hostname;
  
  // Common academic metadata selectors
  const selectors = {
    title: [
      'meta[name="citation_title"]',
      'meta[property="og:title"]',
      'meta[name="DC.Title"]',
      'meta[property="twitter:title"]',
      'h1.article-title',
      'h1.title',
      'h1',
      'title'
    ],
    authors: [
      'meta[name="citation_author"]',
      'meta[name="DC.Creator"]',
      'meta[property="article:author"]',
      '.author-list',
      '.authors',
      '[class*="author"]',
      'meta[name="author"]'
    ],
    date: [
      'meta[name="citation_publication_date"]',
      'meta[name="DC.Date"]',
      'meta[property="article:published_time"]',
      '.publication-date',
      '.date',
      'time[datetime]',
      'meta[name="date"]'
    ],
    journal: [
      'meta[name="citation_journal_title"]',
      'meta[name="DC.Source"]',
      '.journal-title',
      'meta[property="article:section"]'
    ],
    doi: [
      'meta[name="citation_doi"]',
      'meta[name="DC.Identifier"]',
      '[data-doi]',
      'a[href*="doi.org"]'
    ]
  };
  
  // Extract metadata using selectors
  Object.keys(selectors).forEach(key => {
    for (const selector of selectors[key]) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const element = elements[0];
          if (element.getAttribute('content')) {
            metadata[key] = element.getAttribute('content');
            break;
          } else if (element.textContent && element.textContent.trim()) {
            metadata[key] = element.textContent.trim();
            break;
          } else if (element.getAttribute('datetime')) {
            metadata[key] = element.getAttribute('datetime');
            break;
          }
        }
      } catch (error) {
        console.error(`Error extracting ${key} with selector ${selector}:`, error);
      }
    }
  });
  
  // Fallbacks
  if (!metadata.title || metadata.title === '') {
    metadata.title = document.title || 'Unknown Title';
  }
  
  if (!metadata.authors || metadata.authors === '') {
    metadata.authors = 'Unknown Author';
  }
  
  if (!metadata.date || metadata.date === '') {
    // Try to extract year from page text
    const yearMatch = document.body?.innerText?.match(/\b(19|20)\d{2}\b/);
    metadata.date = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
  }
  
  if (!metadata.journal || metadata.journal === '') {
    metadata.journal = domain || 'Website';
  }
  
  // Extract DOI from URL or text
  if (!metadata.doi || metadata.doi === '') {
    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
    const urlMatch = url.match(doiRegex);
    const pageMatch = document.body?.innerText?.match(doiRegex);
    metadata.doi = (urlMatch || pageMatch || [null])[0];
  }
  
  metadata.domain = domain;
  metadata.url = url;
  metadata.sourceType = 'webpage';
  
  return metadata;
}

function extractGeneralMetadata() {
  // First try video metadata
  const videoData = extractVideoMetadata();
  if (videoData) return videoData;
  
  // Then try academic metadata
  const academicData = extractAcademicMetadata();
  if (academicData.title && academicData.title !== 'Unknown Title') {
    return academicData;
  }
  
  // Fallback to basic page info
  return {
    sourceType: 'webpage',
    title: document.title || 'Unknown Title',
    authors: 'Unknown Author',
    date: new Date().getFullYear().toString(),
    site: document.domain || window.location.hostname,
    domain: document.domain || window.location.hostname,
    url: window.location.href
  };
}

// ========== CITATION GENERATORS ==========

function generateAPACitation(metadata) {
  const authors = metadata.authors || 'Unknown Author';
  const year = metadata.date ? metadata.date.substring(0, 4) : new Date().getFullYear().toString();
  const title = metadata.title || '
