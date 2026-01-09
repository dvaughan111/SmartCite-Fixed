document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup loaded');

  // SmartCite Content Script - Academic Citation Generator
console.log('SmartCite content script loaded on:', window.location.href);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('SmartCite received message:', request);
  
  // Handle ping request
  if (request.action === 'ping') {
    console.log('Sending ping response');
    sendResponse({ 
      status: 'ready', 
      timestamp: new Date().toISOString()
    });
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
        format: format,
        metadata: {
          title: title,
          url: url,
          domain: domain,
          date: currentYear.toString()
        }
      });
      
    } catch (error) {
      console.error('Citation generation error:', error);
      sendResponse({
        error: 'Failed to generate citation. Please try again.',
        success: false
      });
    }
    
    return true; // Keep message channel open
  }
});

console.log('SmartCite content script ready');
  // DOM Elements
  const citeButton = document.getElementById('citeButton');
  const formatSelect = document.getElementById('formatSelect');
  const resultDiv = document.getElementById('result');
  const usageCount = document.getElementById('count');
  const upgradeLink = document.getElementById('upgradeLink');
  const toggleManualEdit = document.getElementById('toggleManualEdit');
  const manualEditPanel = document.getElementById('manualEditPanel');
  const saveManualBtn = document.getElementById('saveManual');
  const cancelManualBtn = document.getElementById('cancelManual');
  
  // State
  let currentMetadata = {};
  let currentCitation = '';
  
  // ========== INITIALIZATION ==========
  
  // Load usage count
  chrome.storage.local.get(['citationCount'], function(result) {
    const count = result.citationCount || 0;
    usageCount.textContent = count;
    
    if (count >= 5) {
      citeButton.disabled = true;
      citeButton.textContent = 'Free Limit Reached';
      citeButton.style.background = '#9CA3AF';
    }
  });
  
  // ========== CONNECTIVITY CHECK ==========
  
  async function checkConnectivity() {
    return new Promise((resolve) => {
      // Quick check - try to load a small image
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // Use a reliable, lightweight resource
      img.src = 'https://www.google.com/favicon.ico?t=' + Date.now();
      
      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    });
  }
  
  // ========== PERMISSIONS & CONTENT SCRIPT ==========
  
  async function requestPageAccessAndInject(tabId) {
    try {
      console.log('Requesting optional permissions...');
      const granted = await chrome.permissions.request({
        origins: ['*://*/*']
      });
      
      if (!granted) {
        throw new Error('Permission denied. SmartCite needs access to page content to generate citations.');
      }
      
      console.log('Permissions granted, injecting content script...');
      
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Give it a moment to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Permission/injection error:', error);
      throw error;
    }
  }
  
  // ========== CITATION GENERATION ==========
  
  async function generateCitation() {
    console.log('Generate citation clicked');
    
    const format = formatSelect.value;
    
    // Show loading state
    resultDiv.innerHTML = '<div class="loading">Generating citation...</div>';
    citeButton.disabled = true;
    citeButton.textContent = 'Processing...';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // Check if we're on a valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        throw new Error('Cannot generate citations for browser pages');
      }
      
      // Check connectivity
      const isOnline = await checkConnectivity();
      
      let contentScriptReady = false;
      let metadata = {};
      
      // Try to ping existing content script first
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        contentScriptReady = true;
        metadata = pingResponse.academicMetadata || {};
        console.log('Content script already loaded with metadata:', metadata);
      } catch (error) {
        console.log('Content script not found, will inject...');
      }
      
      // If no content script, request permission and inject
      if (!contentScriptReady) {
        await requestPageAccessAndInject(tab.id);
        // Try ping again after injection
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        metadata = pingResponse.academicMetadata || {};
      }
      
      // Now send the citation request
      console.log('Sending citation request with metadata...');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'generateCitation', 
        format: format 
      });
      console.log('Response:', response);
      
      if (response && response.error) {
        throw new Error(response.error);
      } else if (response && response.citation) {
        // Store metadata and citation for manual editing
        currentMetadata = response.metadata || metadata;
        currentCitation = response.citation;
        
        // Increment usage count
        const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
        const newCount = currentCount + 1;
        await chrome.storage.local.set({ citationCount: newCount });
        usageCount.textContent = newCount;
        
        // Display results
        displayCitationResult(response.citation, response.metadata, isOnline);
        
        // Check if reached limit
        if (newCount >= 5) {
          citeButton.disabled = true;
          citeButton.textContent = 'Free Limit Reached';
          citeButton.style.background = '#9CA3AF';
        }
      } else {
        throw new Error('No response from page. Try refreshing.');
      }
    } catch (error) {
      console.error('Citation generation error:', error);
      
      // User-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('Permission denied')) {
        errorMessage = 'Permission required to read page content. Please allow access when prompted.';
      } else if (error.message.includes('Cannot establish connection')) {
        errorMessage = 'Could not connect to page. Try refreshing and clicking again.';
      } else if (error.message.includes('No response')) {
        errorMessage = 'Page not responding. Try reloading the page.';
      }
      
      resultDiv.innerHTML = `
        <div class="error">
          ${errorMessage}<br>
          <small>Make sure you're on a regular webpage.</small>
        </div>
      `;
    } finally {
      // Reset button state
      const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
      if (currentCount < 5) {
        citeButton.disabled = false;
        citeButton.textContent = '📚 Generate Citation';
      }
    }
  }
  
  // ========== DISPLAY FUNCTIONS ==========
  
  function displayCitationResult(citation, metadata, isOnline) {
    const metadataInfo = metadata && metadata.title ? 
      `<div class="metadata-info">
        📊 Detected: "${metadata.title.substring(0, 50)}${metadata.title.length > 50 ? '...' : ''}"
        ${metadata.authors ? `<br>👤 Authors: ${metadata.authors}` : ''}
        ${metadata.date ? `<br>📅 Date: ${metadata.date}` : ''}
        ${!isOnline ? '<br>⚡ Offline mode - using local data only' : ''}
      </div>` : '';
    
    resultDiv.innerHTML = `
      <div class="success">✓ Citation generated</div>
      ${metadataInfo}
      <textarea id="citationText" readonly>${citation}</textarea>
      <button class="copy-btn" id="copyButton">📋 Copy to Clipboard</button>
      <div class="export-buttons">
        <button id="exportCopy">Copy</button>
        <button id="exportDownload">Download .txt</button>
        <button id="exportPrint">Print</button>
      </div>
    `;
    
    // Populate manual edit fields if metadata exists
    if (metadata) {
      document.getElementById('editTitle').value = metadata.title || '';
      document.getElementById('editAuthors').value = metadata.authors || '';
      document.getElementById('editYear').value = metadata.date ? metadata.date.substring(0, 4) : '';
      document.getElementById('editJournal').value = metadata.journal || metadata.domain || '';
    }
    
    // Set up event listeners
    setupCopyButton();
    setupExportButtons(citation);
  }
  
  function setupCopyButton() {
    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
      copyButton.addEventListener('click', copyToClipboard);
    }
  }
  
  function setupExportButtons(citation) {
    // Copy button
    const exportCopyBtn = document.getElementById('exportCopy');
    if (exportCopyBtn) {
      exportCopyBtn.addEventListener('click', copyToClipboard);
    }
    
    // Download button
    const exportDownloadBtn = document.getElementById('exportDownload');
    if (exportDownloadBtn) {
      exportDownloadBtn.addEventListener('click', () => downloadCitation(citation));
    }
    
    // Print button
    const exportPrintBtn = document.getElementById('exportPrint');
    if (exportPrintBtn) {
      exportPrintBtn.addEventListener('click', () => printCitation(citation));
    }
  }
  
  function copyToClipboard() {
    const textarea = document.getElementById('citationText');
    if (textarea) {
      textarea.select();
      document.execCommand('copy');
      
      // Visual feedback
      const originalText = this.textContent;
      this.textContent = '✓ Copied!';
      this.style.background = '#10B981';
      
      setTimeout(() => {
        this.textContent = originalText;
        this.style.background = originalText.includes('Copy') ? '#3B82F6' : '#6B7280';
      }, 2000);
    }
  }
  
  function downloadCitation(citation) {
    const blob = new Blob([citation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function printCitation(citation) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>SmartCite Citation</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h2>SmartCite Citation</h2>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <pre>${citation}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
  
  // ========== MANUAL EDIT FEATURE ==========
  
  toggleManualEdit.addEventListener('click', function() {
    if (manualEditPanel.style.display === 'none') {
      manualEditPanel.style.display = 'block';
      this.textContent = '✖️ Close Editor';
    } else {
      manualEditPanel.style.display = 'none';
      this.textContent = '✏️ Edit Details Manually';
    }
  });
  
  cancelManualBtn.addEventListener('click', function() {
    manualEditPanel.style.display = 'none';
    toggleManualEdit.textContent = '✏️ Edit Details Manually';
  });
  
  saveManualBtn.addEventListener('click', function() {
    const manualData = {
      title: document.getElementById('editTitle').value || currentMetadata.title || 'Unknown Title',
      authors: document.getElementById('editAuthors').value || currentMetadata.authors || 'Unknown Author',
      date: document.getElementById('editYear').value || (currentMetadata.date ? currentMetadata.date.substring(0, 4) : new Date().getFullYear().toString()),
      journal: document.getElementById('editJournal').value || currentMetadata.journal || document.domain || 'Website'
    };
    
    const format = formatSelect.value;
    let citation;
    
    // Generate citation with manual data
    switch(format) {
      case 'apa':
        citation = `${manualData.authors}. (${manualData.date}). ${manualData.title}. ${manualData.journal}.`;
        break;
      case 'mla':
        citation = `${manualData.authors}. "${manualData.title}." ${manualData.journal}, ${manualData.date}.`;
        break;
      case 'chicago':
        citation = `${manualData.authors}. "${manualData.title}." ${manualData.journal} (${manualData.date}).`;
        break;
      case 'ieee':
        citation = `[1] ${manualData.authors}, "${manualData.title}," ${manualData.journal}, ${manualData.date}.`;
        break;
      default:
        citation = `${manualData.authors}. "${manualData.title}." ${manualData.journal} (${manualData.date}).`;
    }
    
    currentCitation = citation;
    
    resultDiv.innerHTML = `
      <div class="success">✓ Citation Updated (Manual)</div>
      <div class="metadata-info">Using manually edited details</div>
      <textarea id="citationText" readonly>${citation}</textarea>
      <button class="copy-btn" id="copyButton">📋 Copy to Clipboard</button>
      <div class="export-buttons">
        <button id="exportCopy">Copy</button>
        <button id="exportDownload">Download .txt</button>
        <button id="exportPrint">Print</button>
      </div>
    `;
    
    setupCopyButton();
    setupExportButtons(citation);
    
    manualEditPanel.style.display = 'none';
    toggleManualEdit.textContent = '✏️ Edit Details Manually';
  });
  
  // ========== UPGRADE LINK ==========
  
  if (upgradeLink) {
    upgradeLink.addEventListener('click', function(e) {
      e.preventDefault();
      resultDiv.innerHTML = `
        <div style="text-align: center;">
          <div style="font-weight: bold; color: #2563EB; margin-bottom: 10px;">✨ Premium Features</div>
          <div style="text-align: left; font-size: 13px; margin-bottom: 15px;">
            <div>✓ Unlimited citations</div>
            <div>✓ 9,000+ citation styles</div>
            <div>✓ Team collaboration</div>
            <div>✓ AI-powered suggestions</div>
            <div>✓ Export to Google Docs/Word</div>
            <div>✓ Bibliography management</div>
          </div>
          <div style="margin-top: 15px; font-size: 12px; color: #6B7280;">
            Coming soon!<br>
            <small>Join waitlist for early access</small>
          </div>
        </div>
      `;
    });
  }
  
  // ========== MAIN EVENT LISTENER ==========
  
  citeButton.addEventListener('click', generateCitation);
  
  console.log('SmartCite popup fully initialized');
});
