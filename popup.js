document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const llmResponseContainer = document.getElementById('llmResponseContainer');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');

  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  analyzeBtn.addEventListener('click', async () => {
    llmResponseContainer.innerHTML = '';
    resultsDiv.style.display = 'none';
    errorMessage.style.display = 'none';
    configMessage.style.display = 'none';
    loadingMessage.style.display = 'block';
    analyzeBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.id && !tab.url.startsWith("chrome://")) { // Added check for chrome:// URLs
        // Check for API key first
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
          loadingMessage.style.display = 'none';
          configMessage.style.display = 'block';
          analyzeBtn.disabled = false;
          return;
        }

        // Ensure content script can be injected
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }).catch(err => { // Catch error if injection fails (e.g., on chrome web store)
            console.warn("Failed to inject content script, or already injected:", err);
            // We can often proceed if it's already injected by manifest,
            // but if it fails for permissions, the sendMessage below will fail.
        });


        const response = await chrome.tabs.sendMessage(tab.id, { action: "getPostText" });

        if (response && response.text) {
          const postText = response.text;
          const analysisResults = await chrome.runtime.sendMessage({
            action: "analyzeWithLLM",
            text: postText
          });

          loadingMessage.style.display = 'none';
          analyzeBtn.disabled = false;

          if (analysisResults.error) {
            displayError(analysisResults.error);
          } else if (analysisResults.llmResponse) {
            displayResults(analysisResults.llmResponse);
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
          displayError("Could not extract text. Ensure the post is visible and try clicking on it first, or refresh the page.");
        }
      } else {
        loadingMessage.style.display = 'none';
        analyzeBtn.disabled = false;
        let errorMsgText = "Could not access the active tab or operate on this page (e.g., internal Chrome pages, Chrome Web Store).";
        if(tab && tab.url.startsWith("chrome://")) {
            errorMsgText = "This extension cannot operate on internal Chrome pages (e.g., chrome://extensions).";
        }
        displayError(errorMsgText);
      }
    } catch (error) {
      console.error("Error in popup:", error);
      loadingMessage.style.display = 'none';
      analyzeBtn.disabled = false;
      let errorMsg = `An error occurred: ${error.message}. Check extension console.`;
      if (error.message && error.message.toLowerCase().includes("cannot access contents of url") || error.message.toLowerCase().includes("cannot access a chrome extension url")) {
        errorMsg = "This extension cannot run on the current page (e.g., Chrome Web Store, other extension pages, or internal browser pages). Try it on a LinkedIn page.";
      } else if (error.message && error.message.toLowerCase().includes("no matching message handler")) {
        errorMsg += " The background script might not be running or didn't load correctly. Try reloading the extension and the LinkedIn page."
      } else if (error.message && error.message.toLowerCase().includes("receiving end does not exist")) {
        errorMsg = "Could not communicate with the LinkedIn page. Please refresh the LinkedIn page and try again. If this persists, the content script might be blocked or failing.";
      }
      displayError(errorMsg);
    }
  });

  function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    resultsDiv.style.display = 'none';
  }

  function displayResults(llmResponse) {
    resultsDiv.style.display = 'block';
    errorMessage.style.display = 'none';
    llmResponseContainer.innerHTML = ''; // Clear previous results

    if (typeof llmResponse === 'string') {
        const pre = document.createElement('pre');
        pre.textContent = llmResponse;
        llmResponseContainer.appendChild(pre);
    } else if (typeof llmResponse === 'object' && llmResponse !== null) {
        if (llmResponse.summary) {
            const h3 = document.createElement('h3');
            h3.textContent = "LLM Summary:";
            llmResponseContainer.appendChild(h3);
            const p = document.createElement('p');
            p.textContent = llmResponse.summary;
            llmResponseContainer.appendChild(p);
        }

        if (llmResponse.logical_fallacies && llmResponse.logical_fallacies.length > 0) {
            const h3 = document.createElement('h3');
            h3.textContent = "Potential Logical Fallacies:";
            llmResponseContainer.appendChild(h3);
            const ul = document.createElement('ul');
            llmResponse.logical_fallacies.forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${f.type || 'Fallacy'}:</strong> ${f.explanation || ''} <br><em>Identified: "${f.quote || 'N/A'}"</em>`;
                ul.appendChild(li);
            });
            llmResponseContainer.appendChild(ul);
        } else if (llmResponse.logical_fallacies) { // Check if array exists even if empty
             const p = document.createElement('p');
             p.textContent = "No specific logical fallacies identified by the LLM.";
             llmResponseContainer.appendChild(p);
        }

        if (llmResponse.marketing_bullshit && llmResponse.marketing_bullshit.length > 0) {
            const h3 = document.createElement('h3');
            h3.textContent = "Potential Marketing Bullshit:";
            llmResponseContainer.appendChild(h3);
            const ul = document.createElement('ul');
            llmResponse.marketing_bullshit.forEach(b => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${b.term || 'Term'}:</strong> ${b.critique || ''} <br><em>Identified: "${b.quote || 'N/A'}"</em>`;
                ul.appendChild(li);
            });
            llmResponseContainer.appendChild(ul);
        } else if (llmResponse.marketing_bullshit) { // Check if array exists even if empty
            const p = document.createElement('p');
            p.textContent = "No specific marketing bullshit identified by the LLM.";
            llmResponseContainer.appendChild(p);
        }

        if(llmResponse.overall_rating){
            const h3 = document.createElement('h3');
            h3.textContent = "Overall Rating:";
            llmResponseContainer.appendChild(h3);
            const p = document.createElement('p');
            p.textContent = llmResponse.overall_rating;
            llmResponseContainer.appendChild(p);
        }

        // If none of the expected fields are there but it's an object, show raw JSON
        if (!llmResponse.summary && !(llmResponse.logical_fallacies && llmResponse.logical_fallacies.length > 0) && !(llmResponse.marketing_bullshit && llmResponse.marketing_bullshit.length > 0)) {
            if(Object.keys(llmResponse).length > 0 && !(llmResponse.logical_fallacies || llmResponse.marketing_bullshit)){ // Avoid if keys are just empty arrays
                const p = document.createElement('p');
                p.textContent = "LLM returned structured data, but not in the expected format. Raw response:"
                llmResponseContainer.appendChild(p);
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(llmResponse, null, 2);
                llmResponseContainer.appendChild(pre);
            } else if (!llmResponse.logical_fallacies && !llmResponse.marketing_bullshit) {
                // If the arrays are present but empty, and no summary, this indicates successful parse but no findings.
                // The specific messages for "no fallacies/bullshit identified" would have already been added.
                // So we might not need to add anything extra here unless it's a truly empty object.
                if(Object.keys(llmResponse).length === 0) {
                    const p = document.createElement('p');
                    p.textContent = "LLM analysis returned an empty response.";
                    llmResponseContainer.appendChild(p);
                }
            }
        }

    } else {
        const p = document.createElement('p');
        p.textContent = "Could not parse the LLM response format, or response was empty.";
        llmResponseContainer.appendChild(p);
    }
  }
});
