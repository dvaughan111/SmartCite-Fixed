// SmartCite Content Script - Enhanced Academic Citation Generator
console.log('SmartCite content script loaded on:', window.location.href);

// Academic database selectors
const ACADEMIC_SELECTORS = {
  // Common academic metadata selectors
  title: [
    'meta[name="citation_title"]',
    'meta[property="og:title"]',
    'meta[name="DC.Title"]',
    'h1.article-title',
    '.title',
    'h1'
  ],
  authors: [
    'meta[name="citation_author"]',
    'meta[name="DC.Creator"]',
    'meta[property="article:author"]',
    '.author-list',
    '[class*="author"]'
  ],
  date: [
    'meta[name="citation_publication_date"]',
    'meta[name="DC.Date"]',
    'meta[property="article:published_time"]',
    '.publication-date',
    '.date'
  ],
  journal: [
    'meta[name="citation_journal_title"]',
    'meta[name="DC.Source"]',
    '.journal-title'
  ],
  doi: [
    'meta[name="citation_doi"]',
    'meta[name="DC.Identifier"]',
    '[data-doi]',
    'a[href*="doi.org"]'
  ]
};

function extractAcademicMetadata() {
  const metadata = {};
  
  // Extract using academic selectors
  Object.keys(ACADEMIC_SELECTORS).forEach(key => {
    for (const selector of ACADEMIC_SELECTORS[key]) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        if (elements[0].getAttribute('content')) {
          metadata[key] = elements[0].getAttribute('content');
          break;
        } else if (elements[0].textContent) {
          metadata[key] = elements[0].textContent.trim();
          break;
        }
      }
    }
  });
  
  // Fallback to general metadata
  if (!metadata.title) metadata.title = document.title;
  if (!metadata.authors) metadata.authors = 'Unknown Author';
  if (!metadata.date) {
    const yearMatch = document.body.innerText.match(/\b(19|20)\d{2}\b/);
    metadata.date = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
  }
  
  // Try to extract DOI from URL or page content
  if (!metadata.doi) {
    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
    const urlMatch = window.location.href.match(doiRegex);
    const pageMatch = document.body.innerText.match(doiRegex);
    metadata.doi = (urlMatch || pageMatch || [null])[0];
  }
  
  return metadata;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  if (request.action === 'ping') {
    sendResponse({ 
      status: 'ready', 
      timestamp: new Date().toISOString(),
      academicMetadata: extractAcademicMetadata() 
    });
    return true;
  }
  
  if (request.action === 'generateCitation') {
    console.log('Generating citation for format:', request.format);
    
    try {
      const format = request.format || 'mla';
      const metadata = extractAcademicMetadata();
      
      let citation;
      
      switch(format) {
        case 'apa':
          citation = generateAPACitation(metadata);
          break;
          
        case 'mla':
          citation = generateMLACitation(metadata);
          break;
          
        case 'chicago':
          citation = generateChicagoCitation(metadata);
          break;
          
        case 'ieee':
          citation = generateIEEECitation(metadata);
          break;
          
        default:
          citation = generateDefaultCitation(metadata);
      }
      
      console.log('Generated citation:', citation);
      
      sendResponse({
        citation: citation,
        success: true,
        format: format,
        metadata: metadata
      });
      
    } catch (error) {
      console.error('Citation generation error:', error);
      sendResponse({
        error: 'Failed to generate citation. Please try again.',
        success: false
      });
    }
    
    return true;
  }
});

// Citation generators
function generateAPACitation(meta) {
  const authors = meta.authors || 'Unknown Author';
  const year = meta.date ? meta.date.substring(0, 4) : new Date().getFullYear();
  const title = meta.title || document.title;
  const journal = meta.journal || document.domain;
  const doi = meta.doi ? ` https://doi.org/${meta.doi}` : '';
  
  if (journal.includes('.')) {
    // Journal article format
    return `${authors}. (${year}). ${title}. ${journal}.${doi}`;
  } else {
    // Website format
    return `${title}. (${year}, ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}). Retrieved from ${window.location.href}`;
  }
}

function generateMLACitation(meta) {
  const authors = meta.authors || 'Unknown Author';
  const title = meta.title || document.title;
  const journal = meta.journal || document.domain;
  const year = meta.date ? meta.date.substring(0, 4) : new Date().getFullYear();
  const url = window.location.href;
  
  if (journal.includes('.')) {
    return `"${title}." ${journal}, ${year}.`;
  } else {
    return `"${title}." ${journal}, ${year}, ${url}.`;
  }
}

function generateChicagoCitation(meta) {
  const authors = meta.authors || 'Unknown Author';
  const title = meta.title || document.title;
  const journal = meta.journal || document.domain;
  const year = meta.date ? meta.date.substring(0, 4) : new Date().getFullYear();
  const accessDate = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  if (journal.includes('.')) {
    return `${authors}. "${title}." ${journal} (${year}).`;
  } else {
    return `${authors}. "${title}." ${journal}. Last modified ${year}. Accessed ${accessDate}. ${window.location.href}`;
  }
}

function generateIEEECitation(meta) {
  const authors = meta.authors || 'A. Author';
  const title = meta.title || document.title;
  const journal = meta.journal || 'Website';
  const year = meta.date ? meta.date.substring(0, 4) : new Date().getFullYear();
  const doi = meta.doi || '';
  
  return `[1] ${authors}, "${title}," ${journal}, ${year}.${doi ? ' doi: ' + doi : ''}`;
}

function generateDefaultCitation(meta) {
  return `"${meta.title || document.title}." ${window.location.href}`;
}

// Test function for debugging
window.smartCiteTest = function() {
  return extractAcademicMetadata();
};

console.log('SmartCite enhanced content script ready');
