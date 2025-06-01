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
  const naughtinessTitleH3 = document.getElementById('naughtinessTitle'); // For satire case
  const naughtinessRatingP = document.getElementById('naughtinessRating');
  const naughtinessJustificationP = document.getElementById('naughtinessJustification');
  const tacticsSection = document.getElementById('tacticsSection');
  const tacticsTitleH3 = document.getElementById('tacticsTitle'); // For satire case
  const tacticsContainer = document.getElementById('tacticsContainer');

  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

  // Update instruction text and button state based on current page
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
      analyzeBtn.title = "This button is for analyzing full LinkedIn posts. Use right-click for other text.";
    }
  } catch (e) {
    console.error("Error querying tabs for URL:", e);
    instructionTextP.textContent = "Select text & right-click to analyze, or use button for LinkedIn posts.";
    analyzeBtn.disabled = true; // Default to disabled if tab check fails
  }


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
    analyzeBtn.disabled = true; // Always disable during loading
  }

  function hideLoadingStateRestoreButton() {
    loadingMessage.style.display = 'none';
    const originalText = analyzeBtn.getAttribute('data-original-text') || "Analyze LinkedIn Post";
    analyzeBtn.textContent = originalText;
    // Re-evaluate disabled state based on current URL (important if user navigates while popup is open)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0] ? tabs[0].url : "";
        if (currentUrl && (currentUrl.includes("linkedin.com/feed") || currentUrl.includes("linkedin.com/posts") || currentUrl.includes("linkedin.com/pulse"))) {
            analyzeBtn.disabled = false;
        } else {
            analyzeBtn.disabled = true;
        }
    });
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
          showLoadingState(`💥 Analyzing: "${(data.selectedTextContent || "selected text").substring(0, 30)}..."`);
          // Background is already performing analysis, wait for "contextAnalysisComplete" message
          // or for trigger to become "contextMenuDone" on next check if message is missed.
        } else if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults) {
          renderResults(data.lastAnalysisResults);
          await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
        }
      } else {
        // Clear stale data
        await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      }
    } catch (e) { console.error("Error checking for context menu analysis:", e); }
  }

  // Initial check when popup opens
  checkForContextMenuAnalysis();

  // Listener for messages from background (e.g., when context menu analysis completes)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextAnalysisComplete" && request.results) {
      console.log("Popup received contextAnalysisComplete message.");
      renderResults(request.results);
      chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
      return true;
    }
  });

  // --- LinkedIn "Analyze Post" Button Logic ---
  analyzeBtn.addEventListener('click', async () => {
    showLoadingState(defaultLoadingMessage);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      // Button should only be clickable if already determined to be on LinkedIn via initial check
      const settings = await chrome.storage.local.get(['apiKey']);
      if (!settings.apiKey) {
        hideLoadingStateRestoreButton();
        configMessage.style.display = 'block';
        return;
      }
      
      let linkedInPostResponse;
      try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          linkedInPostResponse = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" });
      } catch (scriptErr) {
          console.error("Error injecting or communicating with content script for LinkedIn:", scriptErr);
          displayError(`Failed to get text from LinkedIn: ${scriptErr.message}. Try refreshing.`);
          // hideLoadingStateRestoreButton(); // displayError calls it
          return;
      }

      if (linkedInPostResponse && linkedInPostResponse.text) {
        const analysisResults = await chrome.runtime.sendMessage({ 
          action: "analyzeWithLLM", 
          text: linkedInPostResponse.text 
        });
        renderResults(analysisResults);
      } else if (linkedInPostResponse && linkedInPostResponse.error) {
        displayError(linkedInPostResponse.error);
      } else {
        displayError("Could not extract text from LinkedIn post. Ensure it's visible or try refreshing.");
      }
    } catch (error) {
      console.error("Error in analyzeBtn:", error);
      displayError(`An error occurred: ${error.message}.`);
    }
    // renderResults or displayError will call hideLoadingStateRestoreButton
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
    tacticsSection.style.display = 'block'; // Assume show by default
    naughtinessRatingP.textContent = '';
    naughtinessJustificationP.textContent = '';
    tacticsContainer.innerHTML = '';
    // Reset titles to default
    naughtinessTitleH3.textContent = "Deceptiveness Score:";
    tacticsTitleH3.textContent = "Key Manipulative Tactics / Observations:";

    const overviewDiv = document.createElement('div');
    let summaryHtml = llmResponse.overall_assessment || "The AI offers no assessment. How mysterious!";
    summaryHtml = summaryHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    overviewDiv.innerHTML = summaryHtml;
    overviewSection.appendChild(overviewDiv);

    if (llmResponse.is_satire_or_humor) {
        const satireP = document.createElement('p');
        satireP.innerHTML = `<strong>Comedy Assessment:</strong> ${llmResponse.satire_explanation || "This piece appears to be using humor or satire!"}`;
        overviewDiv.appendChild(satireP); // Add satire explanation to overview content
        naughtinessSection.style.display = 'none'; // Hide naughtiness score section for satire
        tacticsTitleH3.textContent = (llmResponse.key_manipulative_tactics && llmResponse.key_manipulative_tactics.length > 0) ? "Satirical Devices / Tropes Used:" : "Satirical Approach Noted";
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
        noTacticsP.textContent = "The comedian seems to rely on overall wit rather than specific listed tropes here!";
      } else {
          const rating = parseInt(llmResponse.deceptiveness_score);
          if (rating <=2 && llmResponse.overall_assessment && (llmResponse.overall_assessment.toLowerCase().includes("grace") || llmResponse.overall_assessment.toLowerCase().includes("hooray") || llmResponse.overall_assessment.toLowerCase().includes("straightforward") || llmResponse.overall_assessment.toLowerCase().includes("clear"))) {
            noTacticsP.textContent = "The AI's assessment suggests a clear text. No specific manipulative tactics from our checklist were flagged.";
          } else {
            noTacticsP.textContent = "No specific manipulative tactics from our checklist were highlighted for this text.";
          }
      }
      tacticsContainer.appendChild(noTacticsP);
    }
  }
});
