document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup loaded');
  
  const citeButton = document.getElementById('citeButton');
  const formatSelect = document.getElementById('formatSelect');
  const resultDiv = document.getElementById('result');
  const usageCount = document.getElementById('count');
  
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
  
  // Generate Citation Button
  citeButton.addEventListener('click', async function() {
    console.log('Generate citation clicked');
    
    const format = formatSelect.value;
    
    // Show loading
    resultDiv.innerHTML = '<div class="loading">Generating citation...</div>';
    citeButton.disabled = true;
    citeButton.textContent = 'Processing...';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab URL:', tab.url);
      
      // Check if valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        throw new Error('Cannot generate citations for browser pages. Please navigate to a regular website.');
      }
      
      // Check if content script is loaded
      let contentScriptReady = false;
      try {
        // Try to send a message to content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        console.log('Content script ping response:', response);
        contentScriptReady = true;
      } catch (error) {
        console.log('Content script not responding, it may need to be injected');
        // Content script should be loaded automatically via manifest
        // If not, wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          console.log('Content script responded after wait:', response);
          contentScriptReady = true;
        } catch (error2) {
          console.log('Content script still not responding');
        }
      }
      
      if (!contentScriptReady) {
        throw new Error('SmartCite cannot read this page. Try refreshing the page and clicking again.');
      }
      
      // Generate citation
      console.log('Sending citation request...');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'generateCitation', 
        format: format 
      });
      console.log('Citation response:', response);
      
      if (response && response.citation) {
        // Update usage count
        const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
        const newCount = currentCount + 1;
        await chrome.storage.local.set({ citationCount: newCount });
        usageCount.textContent = newCount;
        
        // Display citation
        displayCitation(response.citation, response.metadata);
        
        // Check limit
        if (newCount >= 5) {
          citeButton.disabled = true;
          citeButton.textContent = 'Free Limit Reached';
          citeButton.style.background = '#9CA3AF';
        }
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        throw new Error('No citation generated. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = error.message;
      
      if (error.message.includes('Cannot establish connection')) {
        errorMessage = 'SmartCite cannot access this page. Try refreshing the page first, then click Generate Citation again.';
      } else if (error.message.includes('chrome://') || error.message.includes('edge://')) {
        errorMessage = 'Cannot generate citations for browser pages. Please navigate to a regular website.';
      }
      
      resultDiv.innerHTML = `
        <div class="error">
          ${errorMessage}
          <br><br>
          <small>Common fixes:</small><br>
          <small>• Refresh the page</small><br>
          <small>• Click the extension icon again</small><br>
          <small>• Try a different website</small>
        </div>
      `;
    } finally {
      const currentCount = (await chrome.storage.local.get(['citationCount'])).citationCount || 0;
      if (currentCount < 5) {
        citeButton.disabled = false;
        citeButton.textContent = '📚 Generate Citation';
      }
    }
  });
  
  function displayCitation(citation, metadata) {
    const metadataInfo = metadata && metadata.title ? 
      `<div class="metadata-info">
        📊 Detected: "${metadata.title.substring(0, 50)}${metadata.title.length > 50 ? '...' : ''}"
        ${metadata.authors ? `<br>👤 Authors: ${metadata.authors}` : ''}
        ${metadata.date ? `<br>📅 Date: ${metadata.date}` : ''}
      </div>` : '';
    
    resultDiv.innerHTML = `
      <div class="success">✓ Citation generated</div>
      ${metadataInfo}
      <textarea id="citationText" readonly>${citation}</textarea>
      <button class="copy-btn" id="copyButton">📋 Copy to Clipboard</button>
    `;
    
    // Set up copy button
    document.getElementById('copyButton').addEventListener('click', function() {
      const textarea = document.getElementById('citationText');
      textarea.select();
      document.execCommand('copy');
      this.textContent = '✓ Copied!';
      this.style.background = '#10B981';
      setTimeout(() => {
        this.textContent = '📋 Copy to Clipboard';
        this.style.background = '#3B82F6';
      }, 2000);
    });
  }
  
  // Manual Edit Feature (simplified)
  const toggleManualEdit = document.getElementById('toggleManualEdit');
  const manualEditPanel = document.getElementById('manualEditPanel');
  const saveManualBtn = document.getElementById('saveManual');
  const cancelManualBtn = document.getElementById('cancelManual');
  
  if (toggleManualEdit) {
    toggleManualEdit.addEventListener('click', function() {
      if (manualEditPanel.style.display === 'none' || manualEditPanel.style.display === '') {
        manualEditPanel.style.display = 'block';
        this.textContent = '✖️ Close Editor';
      } else {
        manualEditPanel.style.display = 'none';
        this.textContent = '✏️ Edit Details Manually';
      }
    });
  }
  
  if (cancelManualBtn) {
    cancelManualBtn.addEventListener('click', function() {
      manualEditPanel.style.display = 'none';
      if (toggleManualEdit) toggleManualEdit.textContent = '✏️ Edit Details Manually';
    });
  }
  
  if (saveManualBtn) {
    saveManualBtn.addEventListener('click', function() {
      const title = document.getElementById('editTitle').value || 'Unknown Title';
      const authors = document.getElementById('editAuthors').value || 'Unknown Author';
      const year = document.getElementById('editYear').value || new Date().getFullYear();
      const journal = document.getElementById('editJournal').value || 'Website';
      const format = formatSelect.value;
      
      let citation;
      switch(format) {
        case 'apa':
          citation = `${authors}. (${year}). ${title}. ${journal}.`;
          break;
        case 'mla':
          citation = `${authors}. "${title}." ${journal}, ${year}.`;
          break;
        case 'chicago':
          citation = `${authors}. "${title}." ${journal} (${year}).`;
          break;
        default:
          citation = `${authors}. "${title}." ${journal} (${year}).`;
      }
      
      resultDiv.innerHTML = `
        <div class="success">✓ Citation Updated (Manual)</div>
        <div class="metadata-info">Using manually edited details</div>
        <textarea id="citationText" readonly>${citation}</textarea>
        <button class="copy-btn" id="copyButton">📋 Copy to Clipboard</button>
      `;
      
      manualEditPanel.style.display = 'none';
      if (toggleManualEdit) toggleManualEdit.textContent = '✏️ Edit Details Manually';
    });
  }
  
  // Upgrade link
  const upgradeLink = document.getElementById('upgradeLink');
  if (upgradeLink) {
    upgradeLink.addEventListener('click', function(e) {
      e.preventDefault();
      resultDiv.innerHTML = `
        <div style="text-align: center;">
          <div style="font-weight: bold; color: #2563EB; margin-bottom: 10px;">✨ Premium Features</div>
          <div style="text-align: left; font-size: 13px;">
            <div>• Unlimited citations</div>
            <div>• 9,000+ citation styles</div>
            <div>• Team collaboration</div>
          </div>
        </div>
      `;
    });
  }
});
