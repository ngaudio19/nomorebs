//popup.js
document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText');

  const overviewSection = document.getElementById('overviewSection');
  const naughtinessSection = document.getElementById('naughtinessSection');
  const naughtinessTitleH3 = document.getElementById('naughtinessTitle');
  const naughtinessRatingP = document.getElementById('naughtinessRating');
  const naughtinessJustificationP = document.getElementById('naughtinessJustification');
  const tacticsSection = document.getElementById('tacticsSection');
  const tacticsTitleH3 = document.getElementById('tacticsTitle');
  const tacticsContainer = document.getElementById('tacticsContainer');

  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

  // Function to update button and instruction based on URL
  async function updateButtonAndInstruction() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab && tab.url ? tab.url : "";
      if (currentUrl && (currentUrl.includes("linkedin.com/feed") || currentUrl.includes("linkedin.com/posts") || currentUrl.includes("linkedin.com/pulse"))) {
        instructionTextP.textContent = "Select text & right-click to analyze, or click below to analyze the main LinkedIn post.";
        analyzeBtn.disabled = false;
        analyzeBtn.title = "Attempts to analyze the main content of the current LinkedIn post.";
      } else {
        instructionTextP.textContent = "To analyze, select text on any page, then right-click and choose 'TFDYJS: Analyze selection'.";
        analyzeBtn.disabled = true;
        analyzeBtn.title = "This button is for analyzing full page content (Beta). Use right-click for specific text.";
      }
    } catch (e) {
      console.error("Error querying tabs for URL:", e);
      instructionTextP.textContent = "Select text & right-click to analyze, or use button for page content.";
      analyzeBtn.disabled = true; // Default to disabled if tab check fails
    }
  }
  updateButtonAndInstruction();


  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  function showLoadingState(message) {
    resultsDiv.style.display = 'none';
    errorMessage.style.display = 'none';
    configMessage.style.display = 'none';
    loadingMessage.textContent = message || defaultLoadingMessage;
    loadingMessage.style.display = 'block';
    
    const currentAnalyzeBtnText = analyzeBtn.textContent;
    if (currentAnalyzeBtnText !== "Analyzing...") {
        analyzeBtn.setAttribute('data-original-text', currentAnalyzeBtnText);
    }
    analyzeBtn.textContent = "Analyzing...";
    analyzeBtn.disabled = true;
  }

  function hideLoadingStateRestoreButton() {
    loadingMessage.style.display = 'none';
    const originalText = analyzeBtn.getAttribute('data-original-text') || "Analyze Full Page (Beta)";
    analyzeBtn.textContent = originalText;
    updateButtonAndInstruction(); // Re-evaluate button state after loading
  }

  function renderResults(analysisData, clearStorage = true) {
    hideLoadingStateRestoreButton();
    resultsDiv.style.display = 'block';

    if (analysisData.error) {
      displayError(analysisData.error);
    } else if (analysisData.llmResponse) {
      displayAnalysis(analysisData.llmResponse);
    } else {
      displayError("Received no data or an unexpected response from analysis.");
    }
    if (clearStorage) {
        chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
    }
  }

  // Check storage for context menu triggered analysis on load
  async function checkForContextMenuAnalysisOnLoad() {
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      const oneMinute = 1 * 60 * 1000; // Only use recent results

      if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
        if (data.analysisTrigger === 'contextMenuLoading') {
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "").substring(0, 30)}..."`);
          // The storage.onChanged listener below will pick up the 'contextMenuDone'
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          console.log("Found completed context menu analysis in storage on load.");
          renderResults(data.lastAnalysisResults);
          // storage is cleared by renderResults calling the function that clears it
        }
      } else {
        // Clear stale data
        await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      }
    } catch (e) { console.error("Error checking for context menu analysis on load:", e); }
  }

  checkForContextMenuAnalysisOnLoad();

  // Listener for direct messages from background (e.g., when context menu analysis completes IF popup was already open)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextAnalysisComplete" && request.results) {
      console.log("Popup received contextAnalysisComplete direct message.");
      renderResults(request.results);
      // storage is cleared by renderResults
      return true; // Acknowledge message
    }
  });

  // Listener for storage changes (more reliable for context menu flow)
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.analysisTrigger && changes.analysisTrigger.newValue === 'contextMenuDone') {
        // To ensure we get the results that were set along with this trigger:
        const data = await chrome.storage.local.get(['lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.lastAnalysisResults && data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            console.log("Popup detected context menu analysis completion via storage change.");
            renderResults(data.lastAnalysisResults);
             // Storage is cleared by renderResults
        }
      } else if (changes.analysisTrigger && changes.analysisTrigger.newValue === 'contextMenuLoading') {
          const data = await chrome.storage.local.get(['selectedTextContent']);
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "").substring(0, 30)}..."`);
      }
    }
  });

  analyzeBtn.addEventListener('click', async () => {
    showLoadingState(defaultLoadingMessage);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !tab.url.startsWith("chrome://")) {
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
          hideLoadingStateRestoreButton();
          configMessage.style.display = 'block';
          return;
        }
        
        let pageContentResponse;
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            pageContentResponse = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" });
        } catch (scriptErr) {
            console.error("Error injecting or communicating with content script:", scriptErr);
            displayError(`Failed to get text from page: ${scriptErr.message}. Try selecting text and right-clicking.`);
            return;
        }

        if (pageContentResponse && pageContentResponse.text) {
          const analysisResults = await chrome.runtime.sendMessage({ 
            action: "analyzeWithLLM", 
            text: pageContentResponse.text 
          });
          renderResults(analysisResults, false); // Don't clear storage; this wasn't a context menu flow
        } else if (pageContentResponse && pageContentResponse.error) {
          displayError(pageContentResponse.error);
        } else {
          displayError("Could not extract main content from this page. Try selecting text and right-clicking.");
        }
      } else {
        displayError("Cannot analyze this page (e.g., internal Chrome page or no active tab).");
        hideLoadingStateRestoreButton();
      }
    } catch (error) {
      console.error("Error in analyzeBtn:", error);
      displayError(`An error occurred: ${error.message}.`);
    }
  });

  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  function displayAnalysis(llmResponse) {
    // ... (This function remains IDENTICAL to the one I provided in the response
    //      that started with "You're absolutely right to point this out! That output means Slippy...")
    //      It correctly parses Slippy's JSON structure.
    //      For brevity, I'
