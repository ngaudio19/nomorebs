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
  const tacticsTitleH3 = document.getElementById('tacticsTitle'); // Make sure this ID is in your HTML
  const tacticsContainer = document.getElementById('tacticsContainer');

  // References for Slippy's specific output areas from HTML
  const slippyOpeningDiv = document.getElementById('slippyOpening');
  const assessmentTypeDiv = document.getElementById('assessmentType'); // Assuming this exists or is part of overview
  const assessmentExplanationDiv = document.getElementById('assessmentExplanation'); // Assuming this exists or is part of overview
  const probabilityScoreP = document.getElementById('probabilityScore');
  const probabilityConfidenceP = document.getElementById('probabilityConfidence');
  const keyPointsListUl = document.getElementById('keyPointsList');
  const slippyClosingDiv = document.getElementById('slippyClosing');


  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

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
    updateButtonAndInstruction();
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

  async function checkForContextMenuAnalysisOnLoad() {
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      const oneMinute = 1 * 60 * 1000;

      if (data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
        if (data.analysisTrigger === 'contextMenuLoading') {
          showLoadingState(`💥 Analyzing selected text: "${(data.selectedTextContent || "").substring(0, 30)}..."`);
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          console.log("Found completed context menu analysis in storage on load.");
          renderResults(data.lastAnalysisResults);
        }
      } else {
        await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      }
    } catch (e) { console.error("Error checking for context menu analysis on load:", e); }
  }

  checkForContextMenuAnalysisOnLoad();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextAnalysisComplete" && request.results) {
      console.log("Popup received contextAnalysisComplete direct message.");
      renderResults(request.results);
      return true;
    }
  });

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.analysisTrigger && changes.analysisTrigger.newValue === 'contextMenuDone') {
        const data = await chrome.storage.local.get(['lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.lastAnalysisResults && data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            console.log("Popup detected context menu analysis completion via storage change.");
            renderResults(data.lastAnalysisResults);
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
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  // --- This is the displayAnalysis function updated for Slippy's JSON output ---
  function displayAnalysis(llmResponse) {
    // Ensure all Slippy-specific divs are cleared and default states are set
    if (slippyOpeningDiv) slippyOpeningDiv.innerHTML = '';
    if (assessmentTypeDiv) assessmentTypeDiv.innerHTML = ''; // If you still have this distinct element
    if (assessmentExplanationDiv) assessmentExplanationDiv.innerHTML = ''; // If you still have this distinct element
    if (probabilityScoreP) probabilityScoreP.textContent = '';
    if (probabilityConfidenceP) probabilityConfidenceP.textContent = '';
    if (keyPointsListUl) keyPointsListUl.innerHTML = '';
    if (slippyClosingDiv) slippyClosingDiv.innerHTML = '';

    // Make sure main sections exist before trying to style them
    if (overviewSection) overviewSection.innerHTML = ''; // Clear old summary if it was here
    if (mainAssessmentSection) mainAssessmentSection.style.display = 'block';
    if (deceptionProbabilitySection) deceptionProbabilitySection.style.display = 'block';
    if (keyPointsSection) keyPointsSection.style.display = 'block';
    if (tacticsSection) tacticsSection.style.display = 'block'; // If you renamed keyPointsSection to tacticsSection in HTML
    if (naughtinessSection) naughtinessSection.style.display = 'block'; // If you are using this as deceptionProbabilitySection
    if (naughtinessTitleH3) naughtinessTitleH3.textContent = "Deception Probability Meter:"; // Default title
    if (tacticsTitleH3) tacticsTitleH3.textContent = "Slippy's Key Observations:"; // Default title


    // Slippy's Opening Remark
    if (slippyOpeningDiv && llmResponse.slippy_opening_remark) {
      slippyOpeningDiv.textContent = llmResponse.slippy_opening_remark;
      slippyOpeningDiv.style.display = 'block';
    } else if (slippyOpeningDiv) {
      slippyOpeningDiv.style.display = 'none';
    }

    // Main Assessment (Combined overview and explanation)
    const mainAssessmentContentDiv = assessmentExplanationDiv || overviewSection; // Use one primary div
    if (mainAssessmentContentDiv) {
        mainAssessmentContentDiv.innerHTML = ''; // Clear it first
        if (llmResponse.main_assessment && llmResponse.main_assessment.explanation) {
            let explanationHtml = llmResponse.main_assessment.explanation;
            explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
            mainAssessmentContentDiv.innerHTML = explanationHtml;

            if (llmResponse.is_satire_or_humor && llmResponse.satire_explanation) {
                const satireP = document.createElement('p');
                satireP.style.marginTop = '10px'; // Add some space
                satireP.innerHTML = `<strong>Comedy/Satire Assessment:</strong> ${llmResponse.satire_explanation}`;
                mainAssessmentContentDiv.appendChild(satireP);
            }
        } else {
            mainAssessmentContentDiv.innerHTML = "<p>Slippy ponders... but offers no detailed explanation. Curious!</p>";
        }
    }
    
    // Deception Probability (or hide if satire)
    if (deceptionProbabilitySection) { // Check if the section itself exists
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
                  `(Confidence: ${llmResponse.main_assessment.confidence_in_probability})` : "";
            }
        }
    }

    // Key Points for User
    if (keyPointsSection) { // Check if section exists
        if (llmResponse.key_points_for_user && llmResponse.key_points_for_user.length > 0) {
            keyPointsListUl.innerHTML = ''; // Clear previous points
            llmResponse.key_points_for_user.forEach(point => {
                const li = document.createElement('li');
                let pointHtml = point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                li.innerHTML = pointHtml;
                keyPointsListUl.appendChild(li);
            });
            keyPointsSection.style.display = 'block';
        } else {
            keyPointsListUl.innerHTML = ''; // Ensure it's empty
            const noPointsP = document.createElement('p');
            if (llmResponse.is_satire_or_humor) {
                noPointsP.textContent = "Slippy notes the general comedic style here.";
            } else {
                noPointsP.textContent = "Slippy didn't highlight specific key points for this one.";
            }
            keyPointsListUl.appendChild(noPointsP); // Append to UL to keep styling consistent if any on UL
            // keyPointsSection.style.display = 'none'; // Optionally hide if truly no points
        }
    }


    // Slippy's Closing Remark
    if (slippyClosingDiv && llmResponse.slippy_closing_remark) {
      slippyClosingDiv.textContent = llmResponse.slippy_closing_remark;
      slippyClosingDiv.style.display = 'block';
    } else if (slippyClosingDiv) {
      slippyClosingDiv.style.display = 'none';
    }
  } // End of displayAnalysis function
}); // End of DOMContentLoaded listener
