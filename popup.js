document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText');

  const slippyOpeningDiv = document.getElementById('slippyOpening');
  const mainAssessmentSection = document.getElementById('mainAssessmentSection'); // Parent for explanation
  const assessmentExplanationDiv = document.getElementById('assessmentExplanation');
  const deceptionProbabilitySection = document.getElementById('deceptionProbabilitySection');
  const probabilityScoreP = document.getElementById('probabilityScore');
  const probabilityConfidenceP = document.getElementById('probabilityConfidence');
  const keyPointsSection = document.getElementById('keyPointsSection');
  const tacticsTitleH3 = document.getElementById('tacticsTitle'); // Used for satire case
  const keyPointsListUl = document.getElementById('keyPointsList');
  const slippyClosingDiv = document.getElementById('slippyClosing');

  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

  async function updateButtonAndInstruction() { /* ... (same as before) ... */ 
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab && tab.url ? tab.url : "";
      if (currentUrl && (currentUrl.includes("linkedin.com/feed") || currentUrl.includes("linkedin.com/posts") || currentUrl.includes("linkedin.com/pulse"))) {
        instructionTextP.textContent = "Select text & right-click to analyze, or click below to analyze the main LinkedIn post.";
        analyzeBtn.disabled = false;
        analyzeBtn.title = "Attempts to analyze the main content of the current LinkedIn post.";
      } else {
        instructionTextP.textContent = "To analyze, select text on any page, then right-click and choose 'TFDYJS: Analyze selection'.";
        analyzeBtn.disabled = true; // Still disable if not on LinkedIn for this specific button
        analyzeBtn.title = "This button is for analyzing full LinkedIn posts. Use right-click for other text.";
        // If you want it always enabled for "Analyze Full Page (Beta)":
        // analyzeBtn.disabled = false;
        // analyzeBtn.title = "Attempts to analyze the main content of this page (Beta).";
        // instructionTextP.textContent = "Select text & right-click, or use button below for full page (Beta).";
      }
    } catch (e) {
      console.error("Error querying tabs for URL:", e);
      instructionTextP.textContent = "Select text & right-click to analyze.";
      analyzeBtn.disabled = true; 
    }
  }
  updateButtonAndInstruction();


  if (openOptionsLink) { /* ... (same as before) ... */ 
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  function showLoadingState(message) { /* ... (same as before) ... */
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

  function hideLoadingStateRestoreButton() { /* ... (same as before) ... */
    loadingMessage.style.display = 'none';
    const originalText = analyzeBtn.getAttribute('data-original-text') || analyzeBtn.id === "analyzeBtn" ? "Analyze Full Page (Beta)" : "Analyze"; // Default based on ID if needed
    analyzeBtn.textContent = originalText;
    updateButtonAndInstruction();
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
    if (wasFromContextMenu) {
        chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
    }
  }

  // Check storage for context menu triggered analysis ONCE on load
  async function checkForContextMenuAnalysisOnLoad() {
    console.log("TFDYJS Popup: Checking for context menu analysis on load...");
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      const oneMinute = 1 * 60 * 1000;

      if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
        if (data.analysisTrigger === 'contextMenuLoading') {
          console.log("TFDYJS Popup: Found 'contextMenuLoading' trigger in storage.");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
          // The storage.onChanged listener below will pick up the 'contextMenuDone'
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          console.log("TFDYJS Popup: Found 'contextMenuDone' and results in storage on load.");
          renderResults(data.lastAnalysisResults, true);
        } else if (data.analysisTrigger) {
            console.log("TFDYJS Popup: Found trigger in unknown state or old data:", data.analysisTrigger)
        }
      } else {
        console.log("TFDYJS Popup: No recent context menu analysis trigger found in storage or data is stale.");
        // Clear any potentially stale data
        await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      }
    } catch (e) { console.error("TFDYJS Popup: Error in checkForContextMenuAnalysisOnLoad:", e); }
  }

  checkForContextMenuAnalysisOnLoad();

  // Listener for storage changes (more reliable for context menu flow)
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.analysisTrigger) {
      console.log("TFDYJS Popup: Storage change detected for analysisTrigger:", changes.analysisTrigger.newValue);
      if (changes.analysisTrigger.newValue === 'contextMenuDone') {
        const data = await chrome.storage.local.get(['lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.lastAnalysisResults && data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            console.log("TFDYJS Popup: Rendering results from storage change (contextMenuDone).");
            renderResults(data.lastAnalysisResults, true);
        } else {
            console.warn("TFDYJS Popup: 'contextMenuDone' trigger but results are stale or missing.");
        }
      } else if (changes.analysisTrigger.newValue === 'contextMenuLoading') {
          const data = await chrome.storage.local.get(['selectedTextContent']);
          console.log("TFDYJS Popup: Showing loading state from storage change (contextMenuLoading).");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
      }
    }
  });

  // "Analyze Full Page (Beta)" Button Logic
  analyzeBtn.addEventListener('click', async () => {
    showLoadingState(defaultLoadingMessage); // Uses default short message
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
            console.error("Error injecting/communicating with content script:", scriptErr);
            displayError(`Failed to get text from page: ${scriptErr.message}. Try selecting text & right-clicking.`);
            return;
        }

        if (pageContentResponse && pageContentResponse.text) {
          const analysisResults = await chrome.runtime.sendMessage({ 
            action: "analyzeWithLLM", 
            text: pageContentResponse.text 
          });
          renderResults(analysisResults, false); // False: this flow doesn't use the contextMenu storage triggers
        } else if (pageContentResponse && pageContentResponse.error) {
          displayError(pageContentResponse.error);
        } else {
          displayError("Could not extract main content. Try selecting text & right-clicking.");
        }
      } else {
        displayError("Cannot analyze this page (e.g., internal Chrome pages or no active tab).");
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
    // Clear previous dynamic content
    if (slippyOpeningDiv) slippyOpeningDiv.innerHTML = '';
    if (assessmentExplanationDiv) assessmentExplanationDiv.innerHTML = '';
    if (probabilityScoreP) probabilityScoreP.textContent = '';
    if (probabilityConfidenceP) probabilityConfidenceP.textContent = '';
    if (keyPointsListUl) keyPointsListUl.innerHTML = '';
    if (slippyClosingDiv) slippyClosingDiv.innerHTML = '';

    // Default visibility & titles (might be changed by satire logic)
    if (mainAssessmentSection) mainAssessmentSection.style.display = 'block';
    if (deceptionProbabilitySection) deceptionProbabilitySection.style.display = 'block';
    if (keyPointsSection) keyPointsSection.style.display = 'block';
    if (tacticsTitleH3) tacticsTitleH3.textContent = "Slippy's Key Observations:";


    // Slippy's Opening Remark
    if (slippyOpeningDiv && llmResponse.slippy_opening_remark) {
      slippyOpeningDiv.textContent = llmResponse.slippy_opening_remark;
      slippyOpeningDiv.style.display = 'block';
    } else if (slippyOpeningDiv) {
      slippyOpeningDiv.style.display = 'none';
    }

    // Main Assessment Explanation (goes into assessmentExplanationDiv)
    if (assessmentExplanationDiv) {
        let explanationHtml = llmResponse.main_assessment?.explanation || "Slippy seems to be lost in thought... no detailed explanation found.";
        explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        assessmentExplanationDiv.innerHTML = explanationHtml;

        if (llmResponse.is_satire_or_humor && llmResponse.satire_explanation) {
            const satireP = document.createElement('p');
            satireP.style.marginTop = '10px';
            satireP.innerHTML = `<strong>Slippy's Comedy Radar:</strong> ${llmResponse.satire_explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}`;
            assessmentExplanationDiv.appendChild(satireP); // Append satire note to the main explanation area
        }
    }
    
    // Deception Probability (or hide if satire)
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

    // Key Points for User
    if (keyPointsSection) {
        if (llmResponse.key_points_for_user && llmResponse.key_points_for_user.length > 0) {
            keyPointsListUl.innerHTML = ''; // Clear previous points
            llmResponse.key_points_for_user.forEach(point => {
                const li = document.createElement('li');
                let pointHtml = point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                li.innerHTML = pointHtml; // Already has owl from CSS ::before
                keyPointsListUl.appendChild(li);
            });
            keyPointsSection.style.display = 'block';
            if (tacticsTitleH3 && llmResponse.is_satire_or_humor) {
                tacticsTitleH3.textContent = "Slippy's Satirical Snippets:";
            } else if (tacticsTitleH3) {
                tacticsTitleH3.textContent = "Slippy's Key Observations:";
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
             // keyPointsSection.style.display = 'none'; // Keep section visible to show the message
        }
    }


    // Slippy's Closing Remark
    if (slippyClosingDiv && llmResponse.slippy_closing_remark) {
      slippyClosingDiv.textContent = llmResponse.slippy_closing_remark;
      slippyClosingDiv.style.display = 'block';
    } else if (slippyClosingDiv) {
      slippyClosingDiv.style.display = 'none';
    }
  } // End of displaySlippyAnalysis
}); // End of DOMContentLoaded
