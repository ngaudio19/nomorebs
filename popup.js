document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText'); // Retain for potential dynamic updates

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

  // Button is now always enabled, text set in HTML. Instruction text also set in HTML.
  // No initial dynamic disabling/text change needed for analyzeBtn based on URL.
  analyzeBtn.disabled = false;
  analyzeBtn.title = "Attempts to analyze the main content of the current page (Beta). For specific text, please highlight and right-click.";


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
    analyzeBtn.disabled = false; // Button is generally always enabled now
  }

  function renderResults(analysisData) {
    hideLoadingStateRestoreButton();
    resultsDiv.style.display = 'block';

    if (analysisData.error) {
      displayError(analysisData.error);
    } else if (analysisData.llmResponse) {
      displayAnalysis(analysisData.llmResponse);
    } else {
      displayError("Received no data or an unexpected response from analysis.");
    }
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

  analyzeBtn.addEventListener('click', async () => { // Button now tries to analyze main content of ANY page
    showLoadingState(defaultLoadingMessage);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !tab.url.startsWith("chrome://")) { // Check if tab is accessible
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
          hideLoadingStateRestoreButton();
          configMessage.style.display = 'block';
          return;
        }
        
        let pageContentResponse;
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            pageContentResponse = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" }); // Action name kept for now
        } catch (scriptErr) {
            console.error("Error injecting or communicating with content script:", scriptErr);
            displayError(`Failed to get text from page: ${scriptErr.message}. Try selecting text and right-clicking.`);
            // hideLoadingStateRestoreButton(); // displayError calls it
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

  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
    hideLoadingStateRestoreButton();
  }

  function displayAnalysis(llmResponse) {
    overviewSection.innerHTML = '';
    naughtinessSection.style.display = 'block';
    tacticsSection.style.display = 'block';
    naughtinessRatingP.textContent = '';
    naughtinessJustificationP.textContent = '';
    tacticsContainer.innerHTML = '';
    naughtinessTitleH3.textContent = "Deceptiveness Score:"; // Default title
    tacticsTitleH3.textContent = "Key Manipulative Tactics / Observations:"; // Default title


    const overviewDiv = document.createElement('div');
    let summaryHtml = llmResponse.overall_assessment || "The AI offers no assessment. How mysterious!";
    summaryHtml = summaryHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    overviewDiv.innerHTML = summaryHtml;
    overviewSection.appendChild(overviewDiv);

    if (llmResponse.is_satire_or_humor) {
        const satireP = document.createElement('p');
        satireP.style.fontWeight = '600'; // Make "Comedy Assessment" part bold
        satireP.innerHTML = `<strong>Comedy Assessment:</strong> ${llmResponse.satire_explanation || "This piece appears to be using humor or satire!"}`;
        overviewSection.appendChild(satireP);
        naughtinessSection.style.display = 'none';
        tacticsTitleH3.textContent = (llmResponse.key_manipulative_tactics && llmResponse.key_manipulative_tactics.length > 0) ? "Satirical Devices / Tropes Highlighted:" : "Satirical Approach Noted";
    } else {
        naughtinessRatingP.textContent = llmResponse.deceptiveness_score !== undefined ? `${llmResponse.deceptiveness_score} / 10` : "Not Rated";
        naughtinessJustificationP.textContent = llmResponse.score_justification || "No justification provided.";
    }

    if (llmResponse.key_manipulative_tactics && llmResponse.key_manipulative_tactics.length > 0) {
      llmResponse.key_manipulative_tactics.forEach(tactic => {
        const tacticDiv = document.createElement('div');
        tacticDiv.classList.add('tactic-item');

        const quotePara = document.createElement('p');
        quotePara.classList.add('tactic-quote');
        quotePara.textContent = `"${tactic.tactic_quote || 'N/A'}"`;

        const explanationPara = document.createElement('p');
        explanationPara.classList.add('tactic-explanation');
        let explanationHtml = tactic.tactic_explanation || 'No explanation given.';
        explanationHtml = explanationHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        explanationPara.innerHTML = explanationHtml;
        
        tacticDiv.appendChild(quotePara);
        tacticDiv.appendChild(explanationPara);
        tacticsContainer.appendChild(tacticDiv);
      });
    } else {
      const noTacticsP = document.createElement('p');
      if (llmResponse.is_satire_or_humor) {
        noTacticsP.textContent = "The humor here seems to rely on overall wit rather than specific rhetorical devices we're highlighting.";
      } else {
          const rating = parseInt(llmResponse.deceptiveness_score);
          if (rating <=3 && llmResponse.overall_assessment && (llmResponse.overall_assessment.toLowerCase().includes("grace") || llmResponse.overall_assessment.toLowerCase().includes("hooray") || llmResponse.overall_assessment.toLowerCase().includes("straightforward") || llmResponse.overall_assessment.toLowerCase().includes("clear"))) {
            noTacticsP.textContent = "The AI's assessment suggests a clear text. No specific manipulative tactics from our checklist were flagged.";
          } else {
            noTacticsP.textContent = "No specific manipulative tactics from our checklist were highlighted for this text.";
          }
      }
      tacticsContainer.appendChild(noTacticsP);
    }
  }
});
