document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText');

  // New element references for Slippy's output
  const slippyOpeningDiv = document.getElementById('slippyOpening');
  const assessmentTypeDiv = document.getElementById('assessmentType');
  const assessmentExplanationDiv = document.getElementById('assessmentExplanation');
  const probabilityScoreP = document.getElementById('probabilityScore');
  const probabilityConfidenceP = document.getElementById('probabilityConfidence');
  const keyPointsListUl = document.getElementById('keyPointsList');
  const slippyClosingDiv = document.getElementById('slippyClosing');

  // Sections to show/hide
  const mainAssessmentSection = document.getElementById('mainAssessmentSection');
  const deceptionProbabilitySection = document.getElementById('deceptionProbabilitySection');
  const keyPointsSection = document.getElementById('keyPointsSection');


  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

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
    analyzeBtn.disabled = true;
  }

  if (openOptionsLink) { /* ... (existing logic) ... */ }

  function showLoadingState(message) { /* ... (existing logic) ... */ }
  function hideLoadingStateRestoreButton() { /* ... (existing logic) ... */ }
  function renderResults(analysisData) { /* ... (existing logic) ... */ }
  async function checkForContextMenuAnalysis() { /* ... (existing logic) ... */ }

  checkForContextMenuAnalysis();
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { /* ... (existing logic) ... */ });
  analyzeBtn.addEventListener('click', async () => { /* ... (existing logic, ensure it calls showLoadingState and renderResults appropriately) ... */ });


  // --- Main function to update: displayAnalysis for Slippy ---
  function displayAnalysis(llmResponse) {
    // Clear previous results
    slippyOpeningDiv.innerHTML = '';
    assessmentTypeDiv.innerHTML = '';
    assessmentExplanationDiv.innerHTML = '';
    probabilityScoreP.textContent = '';
    probabilityConfidenceP.textContent = '';
    keyPointsListUl.innerHTML = '';
    slippyClosingDiv.innerHTML = '';

    // Default visibility
    mainAssessmentSection.style.display = 'block';
    deceptionProbabilitySection.style.display = 'block';
    keyPointsSection.style.display = 'block';

    // Slippy's Opening Remark
    if (llmResponse.slippy_opening_remark) {
      slippyOpeningDiv.textContent = llmResponse.slippy_opening_remark;
      slippyOpeningDiv.style.display = 'block';
    } else {
      slippyOpeningDiv.style.display = 'none';
    }

    // Main Assessment
    if (llmResponse.main_assessment) {
      const assessment = llmResponse.main_assessment;
      if (assessment.analysis_type) {
        assessmentTypeDiv.textContent = assessment.analysis_type;
      }
      let explanationHtml = assessment.explanation || "Slippy ponders... but offers no detailed explanation. Curious!";
      explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
      assessmentExplanationDiv.innerHTML = explanationHtml;

      if (llmResponse.is_satire_or_humor) {
        deceptionProbabilitySection.style.display = 'none'; // Hide deception score for satire
        // assessmentTypeDiv can state "Satire/Humor Analysis" as set by LLM
      } else {
        probabilityScoreP.textContent = assessment.deception_probability_percentage !== undefined ?
          `${assessment.deception_probability_percentage}%` : "Not Rated";
        probabilityConfidenceP.textContent = assessment.confidence_in_probability ?
          `(Confidence: ${assessment.confidence_in_probability})` : "";
      }
    } else {
      assessmentExplanationDiv.textContent = "Slippy's main assessment is missing. Perhaps he's napping?";
      deceptionProbabilitySection.style.display = 'none';
    }

    // Key Points for User
    if (llmResponse.key_points_for_user && llmResponse.key_points_for_user.length > 0) {
      llmResponse.key_points_for_user.forEach(point => {
        const li = document.createElement('li');
        // Basic Markdown for points as well
        let pointHtml = point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        li.innerHTML = pointHtml;
        keyPointsListUl.appendChild(li);
      });
      keyPointsSection.style.display = 'block';
    } else {
      keyPointsSection.style.display = 'none'; // Hide section if no key points
    }

    // Slippy's Closing Remark
    if (llmResponse.slippy_closing_remark) {
      slippyClosingDiv.textContent = llmResponse.slippy_closing_remark;
      slippyClosingDiv.style.display = 'block';
    } else {
      slippyClosingDiv.style.display = 'none';
    }
  }

  // --- Helper functions (showLoadingState, hideLoadingStateRestoreButton, displayError, renderResults) ---
  // Ensure these are defined correctly as in your previous complete popup.js file.
  // For brevity, I'm re-listing just displayError and the structure of the others.

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
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0] && tabs[0].url ? tabs[0].url : "";
        if (currentUrl && (currentUrl.includes("linkedin.com/feed") || currentUrl.includes("linkedin.com/posts") || currentUrl.includes("linkedin.com/pulse"))) {
            // This specific button logic might be phased out or changed if the button is fully generic
            // For now, it's still trying to be LinkedIn specific if on LinkedIn.
             analyzeBtn.disabled = false; // Enable if on LinkedIn
        } else {
            analyzeBtn.disabled = false; // Now always enabled as "Analyze Full Page"
        }
    });
  }
  
  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  // renderResults was defined earlier and calls displayAnalysis or displayError
  // Ensure analyzeBtn event listener and context menu checks are complete as in previous full code.
  // The main parts are above. The event listeners for analyzeBtn and chrome.runtime.onMessage
  // should call renderResults.

    // Duplicating the full event listeners and helper functions from the previous version for clarity
    // as they were complete:
    if (openOptionsLink) {
        openOptionsLink.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
        });
      }
    
      async function checkForContextMenuAnalysis() {
        try {
          const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
          const oneMinute = 1 * 60 * 1000;
    
          if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            if (data.analysisTrigger === 'contextMenuLoading') {
              showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "").substring(0, 30)}..."`);
            } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
              renderResults(data.lastAnalysisResults);
              await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
            }
          } else {
            await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
          }
        } catch (e) { console.error("Error checking for context menu analysis:", e); }
      }
    
      checkForContextMenuAnalysis();
    
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "contextAnalysisComplete" && request.results) {
          renderResults(request.results);
          chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
          return true;
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
              renderResults(analysisResults);
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
});
