document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText');

  const slippyOpeningDiv = document.getElementById('slippyOpening');
  const mainAssessmentSection = document.getElementById('mainAssessmentSection');
  const assessmentExplanationDiv = document.getElementById('assessmentExplanation');
  const deceptionProbabilitySection = document.getElementById('deceptionProbabilitySection');
  const probabilityScoreP = document.getElementById('probabilityScore');
  const probabilityConfidenceP = document.getElementById('probabilityConfidence');
  const keyPointsSection = document.getElementById('keyPointsSection');
  const tacticsTitleH3 = document.getElementById('tacticsTitle');
  const keyPointsListUl = document.getElementById('keyPointsList');
  const slippyClosingDiv = document.getElementById('slippyClosing');

  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

  async function updateButtonAndInstruction() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab && tab.url ? tab.url : "";
      // The "Analyze Full Page (Beta)" button is now always enabled,
      // instruction focuses on context menu.
      instructionTextP.textContent = "To analyze, select text on any page, then right-click and choose 'TFDYJS: Analyze selection'.";
      analyzeBtn.disabled = false; 
      analyzeBtn.title = "Attempts to analyze the main content of this page (Beta). For specific text, please highlight and right-click.";

    } catch (e) {
      console.error("Error querying tabs for URL:", e);
      instructionTextP.textContent = "Select text & right-click to analyze.";
      analyzeBtn.disabled = true; 
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
    updateButtonAndInstruction(); // Re-evaluates if button should be disabled (e.g. if we bring back LinkedIn specific logic)
                                  // For now, it will mostly just re-enable it.
  }

  function renderResults(analysisData, wasFromContextMenu = false) {
    console.log("TFDYJS Popup: Attempting to render results:", analysisData);
    hideLoadingStateRestoreButton();
    resultsDiv.style.display = 'block';

    if (analysisData.error) {
      displayError(analysisData.error);
    } else if (analysisData.llmResponse) {
      displaySlippyAnalysis(analysisData.llmResponse);
    } else {
      displayError("Slippy's analysis seems to be missing or in an unexpected format.");
    }
    if (wasFromContextMenu) { // Only clear storage if it was a context menu flow that set these specific triggers
        chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
    }
  }

  async function checkForContextMenuAnalysisOnLoad() {
    console.log("TFDYJS Popup: Checking for context menu analysis on load...");
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      const oneMinute = 1 * 60 * 1000;

      if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
        if (data.analysisTrigger === 'contextMenuLoading') {
          console.log("TFDYJS Popup: Found 'contextMenuLoading' trigger in storage.");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          console.log("TFDYJS Popup: Found 'contextMenuDone' and results in storage on load.");
          renderResults(data.lastAnalysisResults, true); // True because this is context menu flow
        }
      } else {
        if (data.analysisTrigger || data.lastAnalysisResults) { // If any old trigger/results exist
            console.log("TFDYJS Popup: Clearing stale context menu analysis data from storage.");
            await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
        }
      }
    } catch (e) { console.error("TFDYJS Popup: Error in checkForContextMenuAnalysisOnLoad:", e); }
  }

  checkForContextMenuAnalysisOnLoad();

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.analysisTrigger) {
      console.log("TFDYJS Popup: Storage change detected for analysisTrigger:", changes.analysisTrigger.newValue);
      if (changes.analysisTrigger.newValue === 'contextMenuDone') {
        const data = await chrome.storage.local.get(['lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.lastAnalysisResults && data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            console.log("TFDYJS Popup: Rendering results from storage change (contextMenuDone).");
            renderResults(data.lastAnalysisResults, true); // True because this is context menu flow
        } else {
            console.warn("TFDYJS Popup: 'contextMenuDone' trigger but results are stale or missing from storage.");
        }
      } else if (changes.analysisTrigger.newValue === 'contextMenuLoading') {
          const data = await chrome.storage.local.get(['selectedTextContent']);
          console.log("TFDYJS Popup: Showing loading state from storage change (contextMenuLoading).");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
      }
    }
  });
  
  // This direct message listener is a fallback; storage.onChanged is primary for context menu
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextAnalysisComplete" && request.results) {
      console.log("TFDYJS Popup: Received contextAnalysisComplete direct message (less common).");
      renderResults(request.results, true); // True because this is context menu flow
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
            displayError(`Failed to get text from page: ${scriptErr.message}. Try selecting text & right-clicking.`);
            return;
        }

        if (pageContentResponse && pageContentResponse.text) {
          const analysisResults = await chrome.runtime.sendMessage({ 
            action: "analyzeWithLLM", 
            text: pageContentResponse.text 
          });
          renderResults(analysisResults, false); 
        } else if (pageContentResponse && pageContentResponse.error) {
          displayError(pageContentResponse.error);
        } else {
          displayError("Could not extract main content. Try selecting text and right-clicking.");
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
    console.error("TFDYJS Popup: Displaying error -", message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  function displaySlippyAnalysis(llmResponse) {
    console.log("TFDYJS Popup: Displaying Slippy's analysis:", llmResponse);

    if (slippyOpeningDiv) slippyOpeningDiv.innerHTML = '';
    if (assessmentExplanationDiv) assessmentExplanationDiv.innerHTML = '';
    if (probabilityScoreP) probabilityScoreP.textContent = '';
    if (probabilityConfidenceP) probabilityConfidenceP.textContent = '';
    if (keyPointsListUl) keyPointsListUl.innerHTML = '';
    if (slippyClosingDiv) slippyClosingDiv.innerHTML = '';

    if (mainAssessmentSection) mainAssessmentSection.style.display = 'block';
    if (deceptionProbabilitySection) deceptionProbabilitySection.style.display = 'block';
    if (keyPointsSection) keyPointsSection.style.display = 'block';
    // if (tacticsTitleH3) tacticsTitleH3.textContent = "Slippy's Key Observations:"; // Reset in case of satire

    if (slippyOpeningDiv && llmResponse.slippy_opening_remark) {
      slippyOpeningDiv.textContent = llmResponse.slippy_opening_remark;
      slippyOpeningDiv.style.display = 'block';
    } else if (slippyOpeningDiv) {
      slippyOpeningDiv.style.display = 'none';
    }

    if (assessmentExplanationDiv) {
        let explanationHtml = "";
        if (llmResponse.is_satire_or_humor && llmResponse.satire_explanation) {
            explanationHtml += `<p><strong>Slippy's Comedy Radar Activated!</strong><br>${llmResponse.satire_explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
        }
        explanationHtml += llmResponse.main_assessment?.explanation || "Slippy seems to be lost in thought... no detailed explanation found.";
        explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        assessmentExplanationDiv.innerHTML = explanationHtml;
    }
    
    if (deceptionProbabilitySection) {
        if (llmResponse.is_satire_or_humor) {
            deceptionProbabilitySection.style.display = 'none';
        } else {
            deceptionProbabilitySection.style.display = 'block';
            if (probabilityScoreP) {
                probabilityScoreP.textContent = llmResponse.main_assessment?.deception_probability_percentage !== undefined ?
                  `${llmResponse.main_assessment.deception_probability_percentage}%` : "Not Rated";
            }
            if (probabilityConfidenceP) {
                probabilityConfidenceP.textContent = llmResponse.main_assessment?.confidence_in_probability ?
                  `(Slippy's Confidence: ${llmResponse.main_assessment.confidence_in_probability})` : "";
            }
        }
    }

    if (keyPointsSection && keyPointsListUl) {
        if (llmResponse.key_points_for_user && llmResponse.key_points_for_user.length > 0) {
            keyPointsListUl.innerHTML = ''; 
            llmResponse.key_points_for_user.forEach(point => {
                const li = document.createElement('li');
                let pointHtml = point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                li.innerHTML = pointHtml;
                keyPointsListUl.appendChild(li);
            });
            keyPointsSection.style.display = 'block';
            if (tacticsTitleH3) { // Ensure tacticsTitleH3 is defined
                tacticsTitleH3.textContent = llmResponse.is_satire_or_humor ? "Slippy's Satirical Snippets:" : "Slippy's Key Observations:";
            }
        } else {
            keyPointsListUl.innerHTML = '';
            const noPointsP = document.createElement('p');
            if (llmResponse.is_satire_or_humor) {
                noPointsP.textContent = "Slippy observes the general comedic style here.";
            } else {
                noPointsP.textContent = "Slippy didn't have specific key points to hoot about for this one.";
            }
            keyPointsListUl.appendChild(noPointsP);
        }
    }


    if (slippyClosingDiv && llmResponse.slippy_closing_remark) {
      slippyClosingDiv.textContent = llmResponse.slippy_closing_remark;
      slippyClosingDiv.style.display = 'block';
    } else if (slippyClosingDiv) {
      slippyClosingDiv.style.display = 'none';
    }
  } 
});
