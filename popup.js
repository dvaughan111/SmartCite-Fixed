document.addEventListener('DOMContentLoaded', async function() {
  console.log('SmartCite popup loaded');
  
  const welcomeScreen = document.getElementById('welcomeScreen');
  const mainScreen = document.getElementById('mainScreen');
  const grantPermissionBtn = document.getElementById('grantPermissionBtn');
  
  // Check if we already have permissions
  async function checkPermissions() {
    try {
      const hasPermission = await chrome.permissions.contains({
        origins: ['*://*/*']
      });
      
      if (hasPermission) {
        // Already have permission, show main screen
        welcomeScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        initializeMainApp();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }
  
  // Initialize main app (your existing code)
  function initializeMainApp() {
    // YOUR EXISTING POPUP.JS CODE GOES HERE
    // Move all your existing code from DOMContentLoaded into this function
    const citeButton = document.getElementById('citeButton');
    const formatSelect = document.getElementById('formatSelect');
    const resultDiv = document.getElementById('result');
    const usageCount = document.getElementById('count');
    const upgradeLink = document.getElementById('upgradeLink');
    
    // ... rest of your existing code ...
  }
  
  // Grant permission button click
  grantPermissionBtn.addEventListener('click', async function() {
    grantPermissionBtn.disabled = true;
    grantPermissionBtn.textContent = 'Requesting permission...';
    
    try {
      // Request optional permissions
      const granted = await chrome.permissions.request({
        origins: ['*://*/*']
      });
      
      if (granted) {
        // Permission granted, show main app
        welcomeScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        initializeMainApp();
      } else {
        // User denied, show message
        grantPermissionBtn.textContent = 'Permission Required';
        grantPermissionBtn.style.background = '#DC2626';
        setTimeout(() => {
          grantPermissionBtn.disabled = false;
          grantPermissionBtn.textContent = '✅ Grant Permission & Continue';
          grantPermissionBtn.style.background = '#10B981';
        }, 2000);
        
        resultDiv.innerHTML = `
          <div class="error">
            Permission is required to generate citations.<br>
            <small>You can still use the extension with manual entry.</small>
          </div>
        `;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      grantPermissionBtn.disabled = false;
      grantPermissionBtn.textContent = '✅ Grant Permission & Continue';
    }
  });
  
  // Check permissions on load
  await checkPermissions();
});
