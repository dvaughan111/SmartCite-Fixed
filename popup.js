document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup initialized');
  
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
  let currentTab = null;
  let currentMetadata = {};
  
  // ========== INITIALIZATION ==========
  
  // Load usage count
  chrome.storage.local.get(['citationCount'], function(result) {
    const count = result.citationCount || 0;
    usageCount.textContent = count;
    
    if (count >= 10) {
      citeButton.disabled = true;
      citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
      citeButton.style.background = '#9CA3AF';
    }
  });
  
  // ========== PERMISSIONS & CONTENT SCRIPT ==========
  
  async function ensurePermissionsAndScript() {
    try {
      // Request optional permissions first
      const granted = await chrome.permissions.request({
        origins: ['*://*/*']
      });
      
      if (!granted) {
        throw new Error('Permission to read page content is required.');
      }
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tab;
      
      // Check if it's a valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        throw new Error('Please navigate to a regular webpage or video.');
      }
      
      // Inject content script dynamically (more reliable than manifest)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
        
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Test connection
        const ping = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        console.log('Content script responded:', ping);
        
        return true;
      } catch (injectError) {
        console.error('Failed to inject script:', injectError);
        throw new Error('Cannot access this page. Try refreshing or use manual edit.');
      }
    } catch (error) {
      console.error('Permission/script error:', error);
      throw error;
    }
  }
  
  // ========== CITATION GENERATION ==========
  
  async function generateCitation() {
    console.log('Starting citation generation...');
    
    const format = formatSelect.value;
    
    // Show loading state
    resultDiv.innerHTML = `
      <div class="loading">
        <div>🔄 Generating citation...</div>
        <div style="font-size: 11px; margin-top: 8px; color: #9CA3AF;">
          Requesting page permissions
        </div>
      </div>
    `;
    
    citeButton.disabled = true;
    citeButton.innerHTML = '<span>⏳</span><span>Processing...</span>';
    
    try {
      // Ensure permissions and content script
      await ensurePermissionsAndScript();
      
      // Generate citation through content script
      console.log('Requesting citation from content script...');
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'generateCitation',
        format: format,
        url: currentTab.url
      });
      
      console.log('Citation response:', response);
      
      if (response && response.success && response.citation) {
        // Update usage count
        const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
        const newCount = currentCount + 1;
        await chrome.storage.local.set({ citationCount: newCount });
        usageCount.textContent = newCount;
        
        // Store metadata for manual editing
        currentMetadata = response.metadata || {};
        
        // Display result
        displayCitationResult(response.citation, response.metadata);
        
        // Check daily limit
        if (newCount >= 10) {
          citeButton.disabled = true;
          citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
          citeButton.style.background = '#9CA3AF';
        }
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        throw new Error('Failed to generate citation. Try manual edit.');
      }
    } catch (error) {
      console.error('Citation generation failed:', error);
      
      let errorMessage = error.message;
      let showManualOption = true;
      
      if (error.message.includes('Permission')) {
        errorMessage = 'Permission required. Please allow access to page content.';
      } else if (error.message.includes('Cannot access')) {
        errorMessage = 'Cannot access this page type. Try refreshing or use manual edit.';
      } else if (error.message.includes('chrome://')) {
        errorMessage = 'Cannot cite browser pages. Navigate to a website.';
        showManualOption = false;
      }
      
      resultDiv.innerHTML = `
        <div class="error">
          <strong>❌ ${errorMessage}</strong>
          ${showManualOption ? `
            <div style="margin-top: 15px; padding: 10px; background: #EFF6FF; border-radius: 6px;">
              <strong>Alternative:</strong> Use "Edit Details Manually" below
            </div>
          ` : ''}
        </div>
      `;
    } finally {
      // Reset button if under limit
      const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
      if (currentCount < 10) {
        citeButton.disabled = false;
        citeButton.innerHTML = '<span>📚</span><span>Generate Citation</span>';
      }
    }
  }
  
  // ========== DISPLAY FUNCTIONS ==========
  
  function displayCitationResult(citation, metadata) {
    const sourceType = metadata?.sourceType || 'webpage';
    const isVideo = sourceType === 'video';
    
    const metadataInfo = metadata && metadata.title ? `
      <div class="metadata-info">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <strong>📊 Detected Source:</strong> 
            <span class="source-type">${isVideo ? 'VIDEO' : 'ARTICLE'}</span>
            ${isVideo ? '<span class="video-indicator">🎬</span>' : ''}
          </div>
          <div style="font-size: 11px; color: #6B7280;">
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style="margin-top: 8px;">
          <strong>Title:</strong> ${metadata.title.substring(0, 80)}${metadata.title.length > 80 ? '...' : ''}
        </div>
        ${metadata.authors ? `<div><strong>Author(s):</strong> ${metadata.authors}</div>` : ''}
        ${metadata.date ? `<div><strong>Date:</strong> ${metadata.date}</div>` : ''}
        ${metadata.site ? `<div><strong>Site:</strong> ${metadata.site}</div>` : ''}
      </div>
    ` : '';
    
    resultDiv.innerHTML = `
      <div class="success">
        <span>✅</span>
        <span>Citation Generated Successfully!</span>
      </div>
      ${metadataInfo}
      <textarea id="citationText" readonly>${citation}</textarea>
      <button class="copy-btn" id="copyButton">
        <span>📋</span>
        <span>Copy to Clipboard</span>
      </button>
      <div class="export-buttons">
        <button id="exportCopy">Copy</button>
        <button id="exportDownload">Download .txt</button>
        <button id="exportNew">New Citation</button>
      </div>
    `;
    
    // Populate manual edit fields
    if (metadata) {
      document.getElementById('editTitle').value = metadata.title || '';
      document.getElementById('editAuthors').value = metadata.authors || '';
      document.getElementById('editYear').value = metadata.date ? 
        (metadata.date.length > 4 ? metadata.date.substring(0, 4) : metadata.date) : 
        new Date().getFullYear().toString();
      document.getElementById('editJournal').value = metadata.site || metadata.journal || 
        (metadata.domain ? metadata.domain : 'Website');
    }
    
    // Set up event listeners
    setupCopyButton();
    setupExportButtons(citation);
  }
  
  function setupCopyButton() {
    const copyButton = document.getElementById('copyButton');
    const exportCopyBtn = document.getElementById('exportCopy');
    
    const copyHandler = function() {
      const textarea = document.getElementById('citationText');
      textarea.select();
      document.execCommand('copy');
      
      const originalHTML = this.innerHTML;
      this.innerHTML = '<span>✅</span><span>Copied!</span>';
      this.style.background = '#10B981';
      
      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.background = '#3B82F6';
      }, 2000);
    };
    
    if (copyButton) copyButton.addEventListener('click', copyHandler);
    if (exportCopyBtn) exportCopyBtn.addEventListener('click', copyHandler);
  }
  
  function setupExportButtons(citation) {
    // Download button
    const exportDownloadBtn = document.getElementById('exportDownload');
    if (exportDownloadBtn) {
      exportDownloadBtn.addEventListener('click', function() {
        const blob = new Blob([citation], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartcite-citation-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.innerHTML = '✅ Downloaded';
        this.style.background = '#10B981';
        setTimeout(() => {
          this.innerHTML = 'Download .txt';
          this.style.background = '#6B7280';
        }, 2000);
      });
    }
    
    // New Citation button
    const exportNewBtn = document.getElementById('exportNew');
    if (exportNewBtn) {
      exportNewBtn.addEventListener('click', function() {
        resultDiv.innerHTML = `
          <div class="tips">
            <h5>💡 Ready for new citation</h5>
            • Click "Generate Citation" above<br>
            • Or use "Edit Details Manually"
          </div>
        `;
      });
    }
  }
  
  // ========== MANUAL EDIT FEATURE ==========
  
  toggleManualEdit.addEventListener('click', function() {
    if (manualEditPanel.style.display === 'none' || manualEditPanel.style.display === '') {
      manualEditPanel.style.display = 'block';
      this.innerHTML = '<span>✖️</span><span>Close Editor</span>';
      this.style.background = '#F3F4F6';
    } else {
      manualEditPanel.style.display = 'none';
      this.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
      this.style.background = 'white';
    }
  });
  
  cancelManualBtn.addEventListener('click', function() {
    manualEditPanel.style.display = 'none';
    toggleManualEdit.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
    toggleManualEdit.style.background = 'white';
  });
  
  saveManualBtn.addEventListener('click', async function() {
    const title = document.getElementById('editTitle').value.trim();
    if (!title) {
      alert('Please enter a title');
      return;
    }
    
    const authors = document.getElementById('editAuthors').value.trim() || 'Unknown Author';
    const year = document.getElementById('editYear').value.trim() || new Date().getFullYear().toString();
    const journal = document.getElementById('editJournal').value.trim() || 'Website';
    const format = formatSelect.value;
    
    let citation;
    const currentUrl = currentTab ? currentTab.url : 'https://example.com';
    
    switch(format) {
      case 'apa':
        citation = `${authors}. (${year}). ${title}. ${journal}. Retrieved from ${currentUrl}`;
        break;
      case 'mla':
        citation = `${authors}. "${title}." ${journal}, ${year}, ${currentUrl}.`;
        break;
      case 'chicago':
        const accessDate = new Date().toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        citation = `${authors}. "${title}." ${journal}. Accessed ${accessDate}. ${currentUrl}`;
        break;
      case 'ieee':
        citation = `[1] ${authors}, "${title}," ${journal}, ${year}. Available: ${currentUrl}`;
        break;
      case 'harvard':
        citation = `${authors} (${year}) '${title}', ${journal}. Available at: ${currentUrl} (Accessed: ${new Date().toLocaleDateString('en-GB')})`;
        break;
      case 'ama':
        citation = `${authors}. ${title}. ${journal}. ${year}. Available at: ${currentUrl}. Accessed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;
        break;
      default:
        citation = `${authors}. "${title}." ${journal} (${year}). ${currentUrl}`;
    }
    
    // Update usage count for manual citations too
    const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
    const newCount = currentCount + 1;
    await chrome.storage.local.set({ citationCount: newCount });
    usageCount.textContent = newCount;
    
    // Display manual citation
    resultDiv.innerHTML = `
      <div class="success">
        <span>✅</span>
        <span>Manual Citation Created</span>
      </div>
      <div class="metadata-info">
        <strong>📝 Manual Entry</strong>
        <div style="margin-top: 8px;">
          <strong>Title:</strong> ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}
        </div>
        <div><strong>Author(s):</strong> ${authors}</div>
        <div><strong>Year:</strong> ${year}</div>
        <div><strong>Source:</strong> ${journal}</div>
      </div>
      <textarea id="citationText" readonly>${citation}</textarea>
      <button class="copy-btn" id="copyButton">
        <span>📋</span>
        <span>Copy to Clipboard</span>
      </button>
    `;
    
    setupCopyButton();
    
    // Close panel and update button
    manualEditPanel.style.display = 'none';
    toggleManualEdit.innerHTML = '<span>✏️</span><span>Edit Details Manually</span>';
    toggleManualEdit.style.background = 'white';
    
    // Check daily limit
    if (newCount >= 10) {
      citeButton.disabled = true;
      citeButton.innerHTML = '<span>⛔</span><span>Daily Limit Reached</span>';
      citeButton.style.background = '#9CA3AF';
    }
  });
  
  // ========== UPGRADE LINK ==========
  
  if (upgradeLink) {
    upgradeLink.addEventListener('click', function(e) {
      e.preventDefault();
      resultDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 24px; color: #8B5CF6; margin-bottom: 15px;">✨</div>
          <div style="font-weight: bold; color: #2563EB; margin-bottom: 15px; font-size: 18px;">
            SmartCite Premium
          </div>
          <div style="text-align: left; font-size: 14px; margin-bottom: 20px; line-height: 1.8;">
            <div>✅ <strong>Unlimited</strong> daily citations</div>
            <div>✅ <strong>9,000+</strong> citation styles (IEEE, APA, MLA, etc.)</div>
            <div>✅ <strong>AI-powered</strong> metadata detection</div>
            <div>✅ <strong>Export</strong> to Google Docs & Word</div>
            <div>✅ <strong>Bibliography</strong> manager</div>
            <div>✅ <strong>Team</strong> collaboration features</div>
          </div>
          <div style="padding: 15px; background: #F0F9FF; border-radius: 8px; font-size: 13px; color: #1E40AF;">
            <strong>Launching Soon!</strong><br>
            Join waitlist for early access & 50% discount
          </div>
        </div>
      `;
    });
  }
  
  // ========== MAIN EVENT LISTENER ==========
  
  citeButton.addEventListener('click', generateCitation);
  
  console.log('SmartCite popup ready');
});
