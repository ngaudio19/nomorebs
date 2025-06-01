// --- LLM Configuration & Helper ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

async function getLLMSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], resolve);
  });
}

async function performLLMAnalysis(textForAnalysis) { // Removed forSelection flag
  const settings = await getLLMSettings();
  if (!settings.apiKey) {
    return { error: "API Key not found. Please set it in the extension options." };
  }

  const apiKey = settings.apiKey;
  const apiEndpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
  const modelName = settings.modelName || DEFAULT_OPENAI_MODEL;

  const systemPrompt = `You are a 'Deception Detective' AI. Your primary goal is to analyze the provided text for any signs of manipulative intent, misleading framing, or deceptive rhetorical tactics. You should be sharp, insightful, and a bit cheeky in your analysis, addressing the user directly.

The following text was provided by the user for analysis.

Your mission is to analyze this text. Pay close attention to:
1.  **Humor/Satire:** First, assess if the text is likely intended as humor, satire, or sarcasm. If so, this drastically changes the interpretation of any apparent "manipulative tactics" (which might be used intentionally for comedic effect).
2.  **Overall Intent (if not satire):** Is the text genuinely informative, or does it feel like it's pushing an agenda, selling something aggressively under false pretenses, or trying to evoke a strong emotional response to bypass critical thinking?
3.  **Manipulative Language/Rhetoric (if not satire):** Look for loaded words, vague claims presented as facts, downplaying of significant information, an overemphasis on trivial points, misleading comparisons, unfair characterizations (Straw Man), appeals to unqualified authority, or using emotion to cloud judgment. Identify if the text uses tactics from this list: Appeal to Authority (unqualified), Ad Hominem, False Equivalence, Straw Man, Bandwagon, Begging the Question, False Cause (Post Hoc), Appeal to Emotion (when it hijacks logic), No True Scotsman, Survivorship Bias, Anecdotal Evidence (for broad generalizations), Red Herrings/Whataboutism. **Only highlight tactics if they are clearly present and contribute to a potentially misleading or manipulative angle. Do not nitpick standard persuasive language or mild emotional expression.**

Output your findings in JSON format:
{
  "is_satire_or_humor": true/false,
  "satire_explanation": "If true, briefly explain why you think it's satire/humor (1-2 sentences). Else, null.",
  "overall_assessment": "Your main analysis (2-4 sentences). Describe the perceived intent and the primary ways the text attempts to persuade or potentially mislead. If satire, describe its comedic approach. If straightforward and not deceptive, say so positively/neutrally. **The tone here MUST align with the 'deceptiveness_score'.**",
  "deceptiveness_score": "Integer 1-10.
    * 1-3: (If not satire) Minimal to no manipulative language. Standard communication, opinions, or light persuasion.
    * 4-5: (If not satire) Some rhetorical flourishes or persuasive language is present, but it's generally within the bounds of normal discourse or marketing. Likely not intentionally deceptive on its own.
    * 6-7: (If not satire) Contains some clear manipulative tactics or misleading statements that begin to obscure or distort the truth. Getting a bit naughty; a 'scoundrel' might be warming up.
    * 8-9: (If not satire) Strong evidence of deceptive intent, using multiple or significant manipulative tactics. This is clear 'scoundrel' territory.
    * 10: (If not satire) Blatantly manipulative and deceptive, riddled with egregious tactics. A true 'miscreant' at work.
    * **If is_satire_or_humor is true, this score should be 1, and the justification should reflect that it's not being scored for deception.**",
  "score_justification": "Briefly explain your deceptiveness_score (1-2 sentences). If satirical, state that. If not, explain what led to the score. **Tone MUST match rating.**",
  "key_manipulative_tactics": [
    {
      "tactic_quote": "The specific phrase or sentence (max 20 words) from the text that exemplifies a manipulative tactic.",
      "tactic_explanation": "Explain *how* this specific quote/tactic is manipulative or misleading, or how it contributes to the overall deceptive intent. You can mention the underlying logical fallacy concept if it's a clear example (e.g., 'This uses a **Straw Man** by...'), but focus on explaining the *effect* of the deception. (1-3 sentences)"
    }
  ]
}

If the text is satirical/humorous and no specific rhetorical devices are being called out as part of the satire, the \`key_manipulative_tactics\` array can be empty, and the \`satire_explanation\` should cover the general humorous approach.
If the text is straightforward and not deceptive (and not satire), the \`overall_assessment\` should be positive/neutral (e.g., 'Refreshingly clear communication here!'), \`deceptiveness_score\` 1-2, and \`key_manipulative_tactics\` an empty array.
Your default stance should be to give the benefit of the doubt unless deceptive tactics are reasonably clear.`;

      const userPrompt = `Alright, Deception Detective, scrutinize this text. Is it trying to pull a fast one, or is it legit? Or maybe just a good laugh? Give me the lowdown:\n\n---\n${textForAnalysis}\n---`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const response = await fetch(apiEndpoint, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.5,
            max_tokens: 2000,
            response_format: { type: "json_object" }
          })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          let errorData;
          try { errorData = JSON.parse(errorBody); }
          catch (e) { errorData = { message: errorBody || response.statusText }; }
          console.error("LLM API Error Details:", errorData);
          return { error: `API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error from API'}. Check OpenAI status, API key, credits, and model access.` };
        }

        const data = await response.json();
        let llmResponseObject = null;

        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            try {
                llmResponseObject = JSON.parse(data.choices[0].message.content);
            } catch (parseError) {
                if (typeof data.choices[0].message.content === 'object') {
                    llmResponseObject = data.choices[0].message.content;
                } else {
                    console.error("Error parsing LLM JSON string response:", parseError, "\nRaw string response:", data.choices[0].message.content);
                    return { error: `LLM returned a string, but it wasn't valid JSON. Content: ${data.choices[0].message.content}` };
                }
            }
        } else if (typeof data === 'object' && data !== null && !data.choices) {
            console.warn("LLM response was a direct object. Using it directly:", data);
            llmResponseObject = data;
        }

        if (llmResponseObject) {
          return { llmResponse: llmResponseObject };
        } else {
          console.error("Unexpected API response structure or empty content:", data);
          return { error: "Received an unexpected or empty response structure from the LLM." };
        }
      } catch (error) {
        console.error("Error calling LLM API:", error);
        if (error.name === 'AbortError') {
          return { error: "LLM API request timed out." };
        } else {
          return { error: `Network or other error calling LLM: ${error.message}.` };
        }
      }
}

// Context Menu Setup & Handling
chrome.runtime.onInstalled.addListener(() => {
  console.log("TFDYJS Extension Installed/Updated.");
  chrome.contextMenus.remove("analyzeSelectedTextNBS", () => {
    if (chrome.runtime.lastError) { /* Suppress error if it didn't exist */ }
    chrome.contextMenus.remove("analyzeSelectedTextTFDYJS", () => { // Remove previous version of new ID too, just in case
        if (chrome.runtime.lastError) { /* Suppress error */ }
        chrome.contextMenus.create({
          id: "analyzeSelectedTextTFDYJS_v1", // Ensure a unique ID if reloading frequently
          title: "😇 TFDYJS: Analyze selection",
          contexts: ["selection"]
        });
    });
  });
  
  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey) { chrome.runtime.openOptionsPage(); }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeSelectedTextTFDYJS_v1" && info.selectionText) { // Match new ID
    await chrome.storage.local.set({ 
        analysisTrigger: 'contextMenuLoading', 
        analysisTimestamp: Date.now(), 
        selectedTextContent: info.selectionText // Store selected text for popup loading message
    });
    chrome.action.openPopup();
    
    const analysisResults = await performLLMAnalysis(info.selectionText); // forSelection flag removed
    await chrome.storage.local.set({
        lastAnalysisResults: analysisResults,
        analysisTimestamp: Date.now(),
        analysisTrigger: 'contextMenuDone'
    });
    try {
        await chrome.runtime.sendMessage({ action: "contextAnalysisComplete", results: analysisResults });
    } catch (e) {
        console.warn("Could not send direct message to popup for contextAnalysisComplete:", e.message.substring(0,100));
    }
  }
});

// Listener for messages from Popup (e.g., for "Analyze Full Page" button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithLLM") { // From popup's "Analyze Full Page" button
    const postText = request.text;
    (async () => {
      const results = await performLLMAnalysis(postText); // forSelection flag removed
      sendResponse(results);
    })();
    return true;
  } else if (request.action === "getStoredContextMenuAnalysis") {
    (async () => {
        const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp']);
        const oneMinute = 1 * 60 * 1000;
        if (data.analysisTrigger === 'contextMenuDone' && data.lastAnalysisResults && 
            data.analysisTimestamp && (Date.now() - data.analysisTimestamp < oneMinute)) {
            sendResponse({ results: data.lastAnalysisResults });
            await chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
        } else {
            sendResponse({ results: null });
        }
    })();
    return true;
  }
});

console.log("TFDYJS Background Script Loaded - Universal Analyst Edition!");
