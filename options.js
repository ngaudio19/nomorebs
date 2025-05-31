document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const modelNameInput = document.getElementById('modelName');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.apiEndpoint) {
      apiEndpointInput.value = result.apiEndpoint;
    }
    if (result.modelName) {
      modelNameInput.value = result.modelName;
    }
  });

  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const apiEndpoint = apiEndpointInput.value.trim(); // Allow empty to use default
    const modelName = modelNameInput.value.trim();   // Allow empty to use default

    if (!apiKey) {
      statusEl.textContent = 'OpenAI API Key cannot be empty!';
      statusEl.style.color = 'red';
      statusEl.style.backgroundColor = '#ffebee';
      statusEl.style.border = '1px solid #e57373';
      return;
    }
    // Basic check for sk- format, but don't be too strict as formats can change
    if (!apiKey.startsWith('sk-')) {
        statusEl.textContent = 'Warning: API Key does not look like a standard OpenAI key (should start with "sk-"). Please double check.';
        statusEl.style.color = '#c25400';
        statusEl.style.backgroundColor = '#fff3e0';
        statusEl.style.border = '1px solid #ffcc80';
        // Allow saving anyway, user might have specific reasons or key types
    }


    chrome.storage.local.set({
        apiKey: apiKey, // Always save the API key
        // Only save endpoint and model if they are not empty, otherwise allow fallback to default in background.js
        ...(apiEndpoint && { apiEndpoint: apiEndpoint }),
        ...(modelName && { modelName: modelName })
    }, () => {
      statusEl.textContent = 'Settings saved! You may need to reload the extension if host permissions were just added/changed in manifest.json.';
      statusEl.style.color = 'green';
      statusEl.style.backgroundColor = '#e8f5e9';
      statusEl.style.border = '1px solid #a5d6a7';

      // If only API key was set and others were blank, clear them from storage
      // so the defaults in background.js are definitely used.
      if (!apiEndpoint) chrome.storage.local.remove('apiEndpoint');
      if (!modelName) chrome.storage.local.remove('modelName');

      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.style.backgroundColor = 'transparent';
        statusEl.style.border = 'none';
      }, 4000);
    });
  });
});
