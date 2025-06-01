document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const modelNameInput = document.getElementById('modelName');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  // Define status styles for consistency
  const statusStyles = {
    success: { color: '#10B981', bgColor: '#F0FDF4', borderColor: '#A7F3D0' }, // Greenish
    warning: { color: '#D97706', bgColor: '#FFFBEB', borderColor: '#FDE68A' }, // Amberish
    error: { color: '#DC2626', bgColor: '#FEF2F2', borderColor: '#FECACA' }   // Redish
  };
  const defaultStatusStyle = { color: '#374151', bgColor: '#F9FAFB', borderColor: '#E5E7EB'};


  function setStatus(message, type = 'default') {
    statusEl.textContent = message;
    const style = statusStyles[type] || defaultStatusStyle;
    statusEl.style.color = style.color;
    statusEl.style.backgroundColor = style.bgColor;
    statusEl.style.borderColor = style.borderColor;
    statusEl.style.display = message ? 'block' : 'none';
  }


  chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.apiEndpoint) apiEndpointInput.value = result.apiEndpoint;
    if (result.modelName) modelNameInput.value = result.modelName;
  });

  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const apiEndpoint = apiEndpointInput.value.trim();
    const modelName = modelNameInput.value.trim();

    statusEl.textContent = ''; // Clear previous status
    statusEl.style.display = 'none';


    if (!apiKey) {
      setStatus('OpenAI API Key cannot be empty!', 'error');
      return;
    }
    
    let settingsToSave = { apiKey: apiKey };
    let messageType = 'success';
    let messageText = 'Settings saved!';

    if (!apiKey.startsWith('sk-')) {
        messageText = 'Warning: API Key might be invalid (usually starts with "sk-"). Settings saved anyway.';
        messageType = 'warning';
    }

    if (apiEndpoint) settingsToSave.apiEndpoint = apiEndpoint;
    else chrome.storage.local.remove('apiEndpoint');

    if (modelName) settingsToSave.modelName = modelName;
    else chrome.storage.local.remove('modelName');

    chrome.storage.local.set(settingsToSave, () => {
      setStatus(messageText, messageType);
      setTimeout(() => {
        setStatus('', 'default'); // Clear status
      }, 4000);
    });
  });
});
