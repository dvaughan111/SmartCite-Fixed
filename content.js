// SmartCite Content Script - Academic Citation Generator
console.log('SmartCite content script loaded on:', window.location.href);

// SmartCite Content Script - Academic Citation Generator
console.log('SmartCite content script loaded on:', window.location.href);

// ===== ADD LEGAL CITATION FUNCTIONS HERE =====

// Function to detect if page is a legal statute
function isLegalStatutePage(url, title) {
  const legalPatterns = [
    /RCW/i,
    /revised.*code.*washington/i,
    /app\.leg\.wa\.gov\/RCW/i,
    /cite=\d+\.\d+\.\d+/i,
    /title \d+/i,
    /chapter \d+/i,
    /section \d+/i
  ];
  
  return legalPatterns.some(pattern => 
    pattern.test(url) || pattern.test(title)
  );
}

// Specialized legal citation generator
function generateLegalCitation(format, url, title) {
  // Extract statute information
  const statuteMatch = url.match(/cite=(\d+\.\d+\.\d+)/);
  if (!statuteMatch) return null;
  
  const statute = statuteMatch[1]; // e.g., "59.18.030"
  
  switch(format) {
    case 'bluebook':
      // Bluebook format for legal filings (NO URL)
      return `WASH. REV. CODE § ${statute} (2024).`;
      
    case 'bluebook_url':
      // Bluebook with URL (for research only)
      const visitedDate = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      return `WASH. REV. CODE § ${statute} (2024), ${url} (last visited ${visitedDate}).`;
      
    case 'legal_short':
      // Short form for legal documents
      return `RCW ${statute}`;
      
    default:
      return null;
  }
}

// ===== EXISTING MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing code ...
  
  // Inside your generateCitation logic, add:
  if (isLegalStatutePage(url, title)) {
    const legalCitation = generateLegalCitation(format, url, title);
    if (legalCitation) {
      sendResponse({
        citation: legalCitation,
        success: true,
        format: format,
        isLegal: true
      });
      return true;
    }
  }
  
  // ... rest of existing citation logic ...
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  // Handle ping request (for checking if script is loaded)
  if (request.action === 'ping') {
    sendResponse({ status: 'ready', timestamp: new Date().toISOString() });
    return true;
  }
  
  if (request.action === 'generateCitation') {
    console.log('Generating citation for format:', request.format);
    
    try {
      const format = request.format || 'mla';
      const title = document.title || 'Unknown Title';
      const url = window.location.href;
      const currentYear = new Date().getFullYear();
      const domain = document.domain || 'Website';
      
      let citation;
      
      switch(format) {
        case 'apa':
          citation = `${title}. (${currentYear}). Retrieved from ${url}`;
          break;
          
        case 'mla':
          citation = `"${title}." ${domain}, ${currentYear}, ${url}.`;
          break;
          
        case 'chicago':
          const accessDate = new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
          citation = `"${title}." ${domain}. Accessed ${accessDate}. ${url}`;
          break;
          
        default:
          citation = `"${title}." ${url}`;
      }
      
      console.log('Generated citation:', citation);
      
      sendResponse({
        citation: citation,
        success: true,
        format: format
      });
      
    } catch (error) {
      console.error('Citation generation error:', error);
      sendResponse({
        error: 'Failed to generate citation. Please try again.',
        success: false
      });
    }
    
    return true; // Keep message channel open for async response
  }
});

// Test function for debugging
window.smartCiteTest = function() {
  return {
    title: document.title,
    url: window.location.href,
    domain: document.domain,
    ready: true,
    timestamp: new Date().toISOString()
  };
};

console.log('SmartCite content script ready');
