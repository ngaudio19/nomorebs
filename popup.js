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
  const slippyConfidenceDiv = document.getElementById('slippyConfidence');
  const confidenceEggsSpan = document.getElementById('confidenceEggs');
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
      // Instruction text is static in HTML, button always enabled
      instructionTextP.textContent = "To analyze, select text on any page, then right-click and choose 'TF You Just Say?'.";
      analyzeBtn.textContent = "Analyze Full Page (Beta)";
      analyzeBtn.disabled = false;
      analyzeBtn.title = "Attempts to analyze the main content of this page (Beta). For specific text, please highlight and right-click.";
    } catch (e) {
      console.error("Error setting up initial button/instruction state:", e);
      instructionTextP.textContent = "Select text & right-click to analyze.";
      analyzeBtn.textContent = "Analyze Full Page (Beta)";
      analyzeBtn.disabled = false;
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
    analyzeBtn.disabled = false;
  }

  function renderResults(analysisData, wasFromContextMenu = false) {
    console.log("TFYJS Popup: Attempting to render results:", analysisData);
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

  async function checkForContextMenuAnalysisOnLoad() {
    console.log("TFYJS Popup: Checking for context menu analysis on load...");
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      const oneMinute = 1 * 60 * 1000;
      if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
        if (data.analysisTrigger === 'contextMenuLoading') {
          console.log("TFYJS Popup: Found 'contextMenuLoading' trigger in storage.");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          console.log("TFDYJS Popup: Found 'contextMenuDone' and results in storage on load.");
          renderResults(data.lastAnalysisResults, true);
        }
      } else {
        if (data.analysisTrigger || data.lastAnalysisResults) {
            console.log("TFYJS Popup: Clearing stale context menu analysis data from storage.");
            await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
        }
      }
    } catch (e) { console.error("TFYJS Popup: Error in checkForContextMenuAnalysisOnLoad:", e); }
  }
  checkForContextMenuAnalysisOnLoad();

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.analysisTrigger) {
      console.log("TFYJS Popup: Storage change detected for analysisTrigger:", changes.analysisTrigger.newValue);
      if (changes.analysisTrigger.newValue === 'contextMenuDone') {
        const data = await chrome.storage.local.get(['lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.lastAnalysisResults && data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            console.log("TFYJS Popup: Rendering results from storage change (contextMenuDone).");
            renderResults(data.lastAnalysisResults, true);
        } else {
            console.warn("TFYJS Popup: 'contextMenuDone' trigger but results are stale or missing from storage.");
        }
      } else if (changes.analysisTrigger.newValue === 'contextMenuLoading') {
          const data = await chrome.storage.local.get(['selectedTextContent']);
          console.log("TFYJS Popup: Showing loading state from storage change (contextMenuLoading).");
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "selection").substring(0, 30)}..."`);
      }
    }
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextAnalysisComplete" && request.results) {
      console.log("TFYJS Popup: Received contextAnalysisComplete direct message (less common).");
      renderResults(request.results, true);
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
          const analysisResults = await chrome.runtime.sendMessage({ action: "analyzeWithLLM", text: pageContentResponse.text });
          renderResults(analysisResults, false); 
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
    console.error("TFYJS Popup: Displaying error -", message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  function displaySlippyAnalysis(llmResponse) {
    console.log("TFYJS Popup: Displaying Slippy's analysis:", llmResponse);

    if (slippyOpeningDiv) slippyOpeningDiv.innerHTML = '';
    if (assessmentExplanationDiv) assessmentExplanationDiv.innerHTML = '';
    if (probabilityScoreP) probabilityScoreP.textContent = '';
    if (confidenceEggsSpan) confidenceEggsSpan.innerHTML = '';
    if (keyPointsListUl) keyPointsListUl.innerHTML = '';
    if (slippyClosingDiv) slippyClosingDiv.innerHTML = '';

    if (mainAssessmentSection) mainAssessmentSection.style.display = 'block';
    if (deceptionProbabilitySection) deceptionProbabilitySection.style.display = 'block';
    if (keyPointsSection) keyPointsSection.style.display = 'block';
    // Titles are now set in HTML or dynamically below for satire

    if (slippyOpeningDiv && llmResponse.slippy_opening_remark) {
      slippyOpeningDiv.textContent = llmResponse.slippy_opening_remark;
      slippyOpeningDiv.style.display = 'block';
    } else if (slippyOpeningDiv) {
      slippyOpeningDiv.style.display = 'none';
    }

    if (assessmentExplanationDiv) {
        let explanationHtml = "";
        if (llmResponse.is_satire_or_humor && llmResponse.satire_explanation) {
            explanationHtml += `<p style="font-weight: bold; color: var(--primary-orange);">Slippy's Comedy Radar Activated!</p><p>${llmResponse.satire_explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</p><hr style="border-color: var(--section-border-color); margin: 10px 0;">`;
        }
        explanationHtml += llmResponse.main_assessment?.explanation || "Slippy seems to be lost in thought... no detailed explanation found.";
        explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        assessmentExplanationDiv.innerHTML = explanationHtml;
    }
    
    if (deceptionProbabilitySection) {
        if (llmResponse.is_satire_or_humor || llmResponse.main_assessment?.deception_probability_percentage === undefined) {
            deceptionProbabilitySection.style.display = 'none';
        } else {
            deceptionProbabilitySection.style.display = 'block';
            if (probabilityScoreP) {
                probabilityScoreP.textContent = `${llmResponse.main_assessment.deception_probability_percentage}%`;
            }
            if (confidenceEggsSpan && slippyConfidenceDiv && llmResponse.main_assessment?.confidence_in_assessment_eggs !== undefined) {
                const eggCount = parseInt(llmResponse.main_assessment.confidence_in_assessment_eggs);
                if (eggCount >= 1 && eggCount <= 5) {
                    confidenceEggsSpan.innerHTML = '🥚'.repeat(eggCount);
                } else {
                    confidenceEggsSpan.innerHTML = 'N/A';
                }
                slippyConfidenceDiv.style.display = 'flex'; // Ensure parent is visible
            } else if (slippyConfidenceDiv) {
                 slippyConfidenceDiv.style.display = 'none'; // Hide if no egg data
            }
        }
    }

    if (keyPointsSection && keyPointsListUl) {
        // Set title for key points / tactics
        if (tacticsTitleH3) {
            if (llmResponse.is_satire_or_humor) {
                tacticsTitleH3.textContent = "Slippy's Satirical Snippets:";
            } else {
                tacticsTitleH3.textContent = "WTF Slippy Saw:"; // New default title
            }
        }

        if (llmResponse.key_points_for_user && llmResponse.key_points_for_user.length > 0) {
            keyPointsListUl.innerHTML = ''; 
            llmResponse.key_points_for_user.forEach(point => {
                const li = document.createElement('li');
                let pointHtml = point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                li.innerHTML = pointHtml;
                keyPointsListUl.appendChild(li);
            });
            keyPointsSection.style.display = 'block';
        } else {
            keyPointsListUl.innerHTML = '';
            const noPointsP = document.createElement('p');
            if (llmResponse.is_satire_or_humor) {
                noPointsP.textContent = "Slippy notes the general comedic style here, rather than specific extracted tropes.";
            } else {
                noPointsP.textContent = "Slippy didn't have specific tactical observations to hoot about for this one.";
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
