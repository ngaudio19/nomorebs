document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const llmResponseContainer = document.getElementById('llmResponseContainer');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const motivationalCopyDiv = document.getElementById('motivationalCopy');
  const overviewParagraph = document.getElementById('overview');
  const flagrancyParagraph = document.getElementById('flagrancy');
  const fallaciesContainer = document.getElementById('fallaciesContainer');
  const interactionArea = document.getElementById('interactionArea');
  const responseTypeSelect = document.getElementById('responseType');
  const getResponseBtn = document.getElementById('getResponseBtn');
  const responseMessageParagraph = document.getElementById('responseMessage');

  const motivationalPhrases = [
    "Time to filter the noise.",
    "Intelligence is everywhere now. Sucks for dumb content.",
    "Let's dissect this with a smile.",
    "Ready to unmask the truth?",
    "Prepare for delightful discernment."
  ];

  if (motivationalCopyDiv) {
    const randomIndex = Math.floor(Math.random() * motivationalPhrases.length);
    motivationalCopyDiv.textContent = motivationalPhrases [randomIndex];
  }

  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  let currentFallacyIndex = -1; // To track which fallacy to respond to

  getResponseBtn.addEventListener('click', () => {
      if (currentFallacyIndex >= 0) {
          const responseType = responseTypeSelect.value;
          const fallacy = analysisResults.logical_fallacies?.[currentFallacyIndex];
          if (fallacy) {
              let message = '';
              switch (responseType) {
                  case 'kind':
                      message = `😊 That's an interesting way to put it! Perhaps a different perspective could be...`;
                      break;
                  case 'standard':
                      message = `🤔 The issue here is a classic case of ${fallacy.type}. Specifically...`;
                      break;
                  case 'smartass':
                      message = `😎 Oh, you sweet summer child. That's like saying... (in a logically flawed way, of course).`;
                      break;
              }
              responseMessageParagraph.textContent = message;
              interactionArea.style.display = 'block';
          } else {
              responseMessageParagraph.textContent = "Error: Could not retrieve fallacy details.";
              interactionArea.style.display = 'none';
          }
      } else {
          responseMessageParagraph.textContent = "Please click 'Learn More' on a fallacy first.";
          interactionArea.style.display = 'none';
      }
  });

  async function handleAnalyzeClick() {
    llmResponseContainer.style.display = 'none';
    resultsDiv.style.display = 'none';
    errorMessage.style.display = 'none';
    configMessage.style.display = 'none';
    loadingMessage.style.display = 'block';
    analyzeBtn.disabled = true;
    interactionArea.style.display = 'none';
    currentFallacyIndex = -1; // Reset

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.id && !tab.url.startsWith("chrome://")) {
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
          loadingMessage.style.display = 'none';
          configMessage.style.display = 'block';
          analyzeBtn.disabled = false;
          return;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }).catch(err => {
            console.warn("Failed to inject content script:", err);
        });

        const response = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" });

        if (response && response.text) {
          const postText = response.text;
          const analysisResults = await chrome.runtime.sendMessage({
            action: "analyzeWithLLM",
            text: postText
          });
          window.analysisResults = analysisResults; // Store for response logic

          loadingMessage.style.display = 'none';
          analyzeBtn.disabled = false;
          resultsDiv.style.display = 'block';
          llmResponseContainer.style.display = 'block';

          if (analysisResults.error) {
            displayError(analysisResults.error);
          } else if (analysisResults.llmResponse) {
            displayAnalysis(analysisResults.llmResponse);
          } else {
            displayError("Received an unexpected response from the analysis service.");
          }

        } else if (response && response.error) {
          loadingMessage.style.display = 'none';
          analyzeBtn.disabled = false;
          displayError(response.error);
        } else {
          loadingMessage.style.display = 'none';
          analyzeBtn.disabled = false;
          displayError("Could not extract text. Ensure the post is visible and try again.");
        }
      } else {
        loadingMessage.style.display = 'none';
        analyzeBtn.disabled = false;
        displayError("This extension cannot operate on this page.");
      }
    } catch (error) {
      console.error("Error in popup:", error);
      loadingMessage.style.display = 'none';
      analyzeBtn.disabled = false;
      displayError(`An error occurred: ${error.message}`);
    }
  }

  analyzeBtn.addEventListener('click', handleAnalyzeClick);

  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
  }

  function displayAnalysis(llmResponse) {
    overviewParagraph.textContent = llmResponse.summary || "No overview provided.";
    let poopEmojis = '';
    const flagrancyScore = parseInt(llmResponse.flagrancy_rating);
    if (!isNaN(flagrancyScore) && flagrancyScore >= 1 && flagrancyScore <= 5) {
      poopEmojis = '💩'.repeat(flagrancyScore);
    } else if (llmResponse.flagrancy_rating) {
      poopEmojis = `Flagrancy: ${llmResponse.flagrancy_rating}`; // Show text if not a number
    } else {
      poopEmojis = "Flagrancy: Not rated.";
    }
    flagrancyParagraph.textContent = poopEmojis;

    fallaciesContainer.innerHTML = '';
    if (llmResponse.logical_fallacies && llmResponse.logical_fallacies.length > 0) {
      llmResponse.logical_fallacies.forEach((fallacy, index) => {
        const fallacyDiv = document.createElement('div');
        fallacyDiv.classList.add('fallacy-item');

        const typeHeading = document.createElement('h4');
        typeHeading.classList.add('fallacy-type');
        typeHeading.textContent = fallacy.type || 'Unknown Fallacy';

        const quotePara = document.createElement('p');
        quotePara.classList.add('fallacy-quote');
        quotePara.textContent = `"${fallacy.quote || 'No quote provided.'}"`;

        const explanationPara = document.createElement('p');
        explanationPara.classList.add('fallacy-explanation');
        explanationPara.textContent = fallacy.explanation || 'No explanation provided.';

        const learnMoreSpan = document.createElement('span');
        learnMoreSpan.classList.add('learn-more');
        learnMoreSpan.textContent = 'Learn More';
        learnMoreSpan.addEventListener('click', () => {
            // Placeholder for "Learn More" functionality - could open a new tab, etc.
            alert(`Learn more about ${fallacy.type}`);
        });

        const respondButton = document.createElement('button');
        respondButton.textContent = 'Respond';
        respondButton.classList.add('response-button');
        respondButton.addEventListener('click', () => {
            currentFallacyIndex = index;
            getResponseBtn.disabled = false;
            interactionArea.style.display = 'block';
            responseMessageParagraph.textContent = ''; // Clear previous message
        });

        fallacyDiv.appendChild(typeHeading);
        fallacyDiv.appendChild(quotePara);
        fallacyDiv.appendChild(explanationPara);
        fallacyDiv.appendChild(learnMoreSpan);
        fallacyDiv.appendChild(respondButton);

        fallaciesContainer.appendChild(fallacyDiv);
      });
    } else {
      const noFallacies = document.createElement('p');
      noFallacies.textContent = "No logical fallacies detected (or at least, none that I'm brave enough to point out 😉).";
      fallaciesContainer.appendChild(noFallacies);
    }
  }
});
