// --- LLM Configuration & Helper (ensure this is at the top) ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

async function getLLMSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], resolve);
  });
}

// --- THIS IS THE performLLMAnalysis FUNCTION ---
async function performLLMAnalysis(textForAnalysis) {
  console.log("TFDYJS Background: Starting performLLMAnalysis for text:", textForAnalysis.substring(0, 100) + "...");
  const settings = await getLLMSettings();
  if (!settings.apiKey) {
    console.error("TFDYJS Background: API Key not found in settings.");
    return { error: "API Key not found. Please set it in the extension options." };
  }

  const apiKey = settings.apiKey;
  const apiEndpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
  const modelName = settings.modelName || DEFAULT_OPENAI_MODEL;

  // --- Ensure your LATEST SLIPPY SYSTEM PROMPT is here ---
  // (The long one defining Slippy, asking for deception probability, satire, specific JSON output)
  const systemPrompt = `You are Slippy, a formerly operational robot owl... [CUT FOR BREVITY - PASTE YOUR FULL SLIPPY PROMPT HERE] ...Prioritize accuracy and avoiding false positives. If in doubt about a *manipulative* fallacy (and it's not satire), err on the side of not listing it.`;
  const userPrompt = `Esteemed Slippy, I present this digital specimen... [CUT FOR BREVITY - PASTE YOUR FULL SLIPPY USER PROMPT HERE] ...Give me the lowdown:\n\n---\n${textForAnalysis}\n---`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const response = await fetch(apiEndpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.65,
        max_tokens: 2200,
        response_format: { type: "json_object" }
      })
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorBody); }
      catch (e) { errorData = { message: errorBody || response.statusText }; }
      console.error("TFDYJS Background: LLM API Error - Status:", response.status, "Details:", errorData);
      return { error: `Slippy's circuits are frazzled (API Error ${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error from OpenAI'}. Check API key, credits, and OpenAI status.` };
    }

    const data = await response.json();
    let llmResponseObject = null;

    // --- Ensure this JSON parsing logic is robust, as provided previously ---
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        try {
            llmResponseObject = JSON.parse(data.choices[0].message.content);
        } catch (parseError) {
            if (typeof data.choices[0].message.content === 'object') {
                llmResponseObject = data.choices[0].message.content;
            } else {
                console.error("TFDYJS Background: Error parsing LLM JSON string:", parseError, "\nRaw response:", data.choices[0].message.content);
                return { error: `Slippy got his wires crossed (returned invalid JSON). He mumbled: ${data.choices[0].message.content.substring(0,100)}...` };
            }
        }
    } else if (typeof data === 'object' && data !== null && !data.choices) { // Direct object from API
        console.warn("TFDYJS Background: LLM response was a direct object:", data);
        llmResponseObject = data;
    }

    if (llmResponseObject && llmResponseObject.main_assessment) { // Check for a key field from Slippy's output
      console.log("TFDYJS Background: LLM analysis successful. Response:", llmResponseObject);
      return { llmResponse: llmResponseObject };
    } else {
      console.error("TFDYJS Background: Slippy's response structure was unexpected or missing key fields:", data);
      return { error: "Slippy is being enigmatic (unexpected response structure from AI). He might be molting." };
    }
  } catch (error) {
    console.error("TFDYJS Background: Error during performLLMAnalysis fetch/processing:", error);
    if (error.name === 'AbortError') {
      return { error: "Slippy took a rather long nap (API request timed out)." };
    }
    return { error: `Technical difficulties communicating with Slippy's perch: ${error.message}.` };
  }
}

// --- Context Menu Setup & Handling ---
chrome.runtime.onInstalled.addListener(() => {
  console.log("TFDYJS Extension Installed/Updated. Slippy is online (mostly).");
  const menuId = "analyzeWithSlippyV1"; // Consistent ID
  chrome.contextMenus.remove(menuId, () => { // Remove old one if it exists
    if (chrome.runtime.lastError) { /* Suppress error if it didn't exist */ }
    chrome.contextMenus.create({
      id: menuId,
      title: "🦉 Ask Slippy: TF Did You Just Say?!",
      contexts: ["selection"]
    });
  });

  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey) { chrome.runtime.openOptionsPage(); }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeWithSlippyV1" && info.selectionText) {
    console.log("TFDYJS Background: Context menu clicked. Selected text:", info.selectionText.substring(0, 50) + "...");
    // 1. Signal popup to show loading (by setting trigger in storage)
    await chrome.storage.local.set({
        analysisTrigger: 'contextMenuLoading',
        analysisTimestamp: Date.now(),
        selectedTextContent: info.selectionText // For popup loading message
    });

    // 2. Open the popup
    chrome.action.openPopup(); // This should be called without await if not a promise, or with await if it is in your specific MV3 setup. For MV3, it doesn't return a promise.

    // 3. Perform analysis
    const analysisResults = await performLLMAnalysis(info.selectionText);
    console.log("TFDYJS Background: Analysis complete. Results:", analysisResults);

    // 4. Store final results and update trigger for popup to pick up via storage.onChanged
    await chrome.storage.local.set({
        lastAnalysisResults: analysisResults,
        analysisTimestamp: Date.now(), // Update timestamp with completion time
        analysisTrigger: 'contextMenuDone'
    });
    // The direct sendMessage call that caused "Slippy tried to hoot..." is removed here
    // to rely more on the storage.onChanged listener in popup.js.
  }
});

// Listener for messages from Popup (for "Analyze Full Page" button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithLLM") {
    const postText = request.text;
    console.log("TFDYJS Background: Received analyzeWithLLM request for full page text (length):", postText?.length);
    (async () => {
      const results = await performLLMAnalysis(postText);
      sendResponse(results); // Send response back to popup's callback
    })();
    return true; // Indicates asynchronous response.
  }
  // Removed getStoredContextMenuAnalysis as popup will directly use onChanged or load on DOMContentLoaded
});

console.log("TFDYJS Background Script (Slippy Edition - Refined Storage) Online!");
