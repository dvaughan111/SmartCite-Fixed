document.addEventListener('DOMContentLoaded', function() {
  console.log('SmartCite popup loaded');
  
  // DOM Elements
  const citeButton = document.getElementById('citeButton');
  const formatSelect = document.getElementById('formatSelect');
  const resultDiv = document.getElementById('result');
  const usageCount = document.getElementById('count');
  const toggleManualEdit = document.getElementById('toggleManualEdit');
  const manualEditPanel = document.getElementById('manualEditPanel');
  const saveManualBtn = document.getElementById('saveManual');
  const cancelManualBtn = document.getElementById('cancelManual');
  
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
    const format = formatSelect.value;
    
    // Show loading
    resultDiv.innerHTML = '<div class="loading">Generating citation...</div>';
    citeButton.disabled = true;
    citeButton.textContent = 'Processing...';
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if valid page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
