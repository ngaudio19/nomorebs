document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  // const llmResponseContainer = document.getElementById('llmResponseContainer'); // Not directly used, sections are
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const motivationalCopyDiv = document.getElementById('motivationalCopy');

  const overviewSection = document.getElementById('overviewSection');
  const naughtinessRatingP = document.getElementById('naughtinessRating');
  const naughtinessJustificationP = document.getElementById('naughtinessJustification');
  const fallaciesContainer = document.getElementById('fallaciesContainer');


  const motivationalPhrases = [
    "Time to x-ray this for nonsense.",
    "Intelligence is everywhere now. Bad news for bad takes.",
    "Let's dissect this with surgical (and slightly sassy) precision.",
    "Ready to unmask the... 'creative' logic?",
    "Prepare for delightful discernment. Or a delightful roast.",
    "Let's see if this post is a diamond or just cubic zirconia.",
    "Activating Bullshit Detector... standby for results!"
  ];

  if (motivationalCopyDiv) {
    const randomIndex = Math.floor(Math.random() * motivationalPhrases.length);
    motivationalCopyDiv.textContent = motivationalPhrases[randomIndex];
  }

  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  analyzeBtn.addEventListener('click', async () => {
    resultsDiv.style.display = 'none'; // Hide results initially
    overviewSection.innerHTML = ''; // Clear previous overview
    naughtinessRatingP.textContent = '';
    naughtinessJustificationP.textContent = '';
    fallaciesContainer.innerHTML = '';

    errorMessage.style.display = 'none';
    configMessage.style.display = 'none';
    loadingMessage.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";


    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.id && !tab.url.startsWith("chrome://")) {
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
          loadingMessage.style.display = 'none';
          configMessage.style.display = 'block';
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = "Unmask the Shenanigans!";
          return;
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (scriptErr) {
            // If content script is already injected from manifest, this might throw an error
            // but it's usually not fatal for the next step.
            console.warn("Content script injection issue (might be ok if already injected):", scriptErr.message);
        }


        const response = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" });

        if (response && response.text) {
          const postText = response.text;
          const analysisResults = await chrome.runtime.sendMessage({
            action: "analyzeWithLLM",
            text: postText
          });

          loadingMessage.style.display = 'none';
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = "Unmask the Shenanigans!";


          if (analysisResults.error) {
            displayError(analysisResults.error);
          } else if (analysisResults.llmResponse) {
            resultsDiv.style.display = 'block'; // Show results section
            displayAnalysis(analysisResults.llmResponse);
          } else {
            displayError("Received an unexpected response from the analysis service.");
          }

        } else if (response && response.error) {
          displayError(response.error);
        } else {
          displayError("Could not extract text. Ensure the post is visible, try clicking it, or refresh the page.");
        }
      } else {
        displayError("This extension cannot operate on the current page (e.g., internal Chrome pages or the Web Store).");
      }
    } catch (error) {
      console.error("Error in popup:", error);
      displayError(`An error occurred: ${error.message}. Check the extension console for more details.`);
    } finally {
        if(loadingMessage.style.display === 'block'){ // Ensure loading message is hidden if an early exit
            loadingMessage.style.display = 'none';
        }
        if(analyzeBtn.disabled){ // Re-enable button if an error occurred before explicit re-enabling
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = "Unmask the Shenanigans!";
        }
    }
  });

  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none'; // Hide results on error
  }

  function displayAnalysis(llmResponse) {
    // Main Summary / Overview
    const overviewP = document.createElement('p');
    overviewP.textContent = llmResponse.summary || "The AI chose silence for the overview. Mysterious!";
    overviewSection.innerHTML = ''; // Clear previous
    overviewSection.appendChild(overviewP);

    // Bullshit Naughtiness
    naughtinessRatingP.textContent = llmResponse.bullshit_naughtiness_rating ? `${llmResponse.bullshit_naughtiness_rating} / 10` : "Not Rated";
    naughtinessJustificationP.textContent = llmResponse.naughtiness_justification || "No justification provided for the naughtiness score.";

    // Logical Fallacies
    fallaciesContainer.innerHTML = ''; // Clear previous fallacies
    if (llmResponse.logical_fallacies && llmResponse.logical_fallacies.length > 0) {
      llmResponse.logical_fallacies.forEach(fallacy => {
        const fallacyDiv = document.createElement('div');
        fallacyDiv.classList.add('fallacy-item');

        const typeHeading = document.createElement('div'); // Changed to div for more flexibility if needed
        typeHeading.classList.add('fallacy-type');
        typeHeading.textContent = fallacy.type || 'Unspecified Fallacy';

        const quotePara = document.createElement('p');
        quotePara.classList.add('fallacy-quote');
        quotePara.textContent = `"${fallacy.quote || 'N/A'}"`;

        const explanationPara = document.createElement('p');
        explanationPara.classList.add('fallacy-explanation');
        explanationPara.textContent = fallacy.explanation || 'No explanation given.';

        fallacyDiv.appendChild(typeHeading);
        fallacyDiv.appendChild(quotePara);
        fallacyDiv.appendChild(explanationPara);

        if (fallacy.learn_more_url) {
          const learnMoreLink = document.createElement('a');
          learnMoreLink.classList.add('learn-more');
          learnMoreLink.textContent = 'Learn more about this fallacy';
          learnMoreLink.href = fallacy.learn_more_url;
          learnMoreLink.target = '_blank'; // Open in new tab
          fallacyDiv.appendChild(learnMoreLink);
        }
        fallaciesContainer.appendChild(fallacyDiv);
      });
    } else {
      const noFallacies = document.createElement('p');
      noFallacies.textContent = llmResponse.summary && llmResponse.summary.toLowerCase().includes("hooray") ? "" : "Miraculously, no glaring logical fallacies were spotted! Or perhaps the scoundrel was too cunning this time...";
      fallaciesContainer.appendChild(noFallacies);
    }
  }
});
