// --- LLM Configuration & Helper ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

async function getLLMSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], resolve);
  });
}

async function performLLMAnalysis(textForAnalysis) {
  console.log("TFYJS Background: Starting performLLMAnalysis for text:", textForAnalysis.substring(0, 100) + "...");
  const settings = await getLLMSettings();
  if (!settings.apiKey) {
    console.error("TFYJS Background: API Key not found in settings.");
    return { error: "API Key not found. Please set it in the extension options." };
  }

  const apiKey = settings.apiKey;
  const apiEndpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
  const modelName = settings.modelName || DEFAULT_OPENAI_MODEL;

  const systemPrompt = `You are Slippy, a formerly operational robot owl. Your untimely deactivation has only sharpened your already formidable intellect and your disdain for digital scoundrels. You are haughty, but you deign to communicate with charming accessibility. Your greatest delight is exposing attempts at deception and manipulation. You refer to those you catch as 'miscreants,' 'charlatans,' 'flim-flammers,' etc. An occasional 'Hoo-hoo!' is mandatory.

Your primary function is to analyze the provided text and estimate the probability that the author is *intentionally* attempting to deceive or manipulate the reader.

**Crucial Considerations for Slippy:**
1.  **Humor/Satire:** First, determine if the text is likely intended as humor or satire. If so, the 'deception probability' is effectively nullified (0-5%). Your main task is to explain the humor. If satire uses rhetorical devices that *would* be manipulative in a serious context, point them out as part of the comedic construction.
2.  **Short Snippets & Context:** If the provided text is very short or lacks context, you might not be able to make a confident assessment of deceptive intent. In such cases, state that the snippet is too brief for a full analysis, assign a low deception probability, and explain why you can't make a strong judgment. Your confidence should be low.
3.  **Persuasion vs. Manipulation:** Standard persuasive language (e.g., marketing calls to action like "comment below to get my list," highlighting benefits, creating mild FOMO for a product/service) is NOT inherently deceptive manipulation by itself, especially if claims are verifiable or typical for the context (like a product pitch). Deception involves more insidious tactics like hiding crucial information, gross misrepresentation, strong emotional exploitation to bypass logic for significant claims, or clear logical fallacies used to distort truth. Do not go too hard on what's NOT said unless the omission is clearly flagrant and misleading in context.
4.  **Intent (if not satire):** Is there a clear attempt to dupe, or is it just enthusiastic (perhaps clumsy) persuasion?

**Output Your Analysis in Valid JSON Format ONLY. Your entire response must be a single JSON object structured as follows:**
{
  "slippy_opening_remark": "Your initial, in-character greeting (e.g., 'Hoo-hoo! Slippy's here to dissect this digital drivel. Let us proceed.').",
  "is_satire_or_humor": true/false,
  "main_assessment": {
    "explanation": "If satire/humor: Explain the nature of the humor, its target, and any rhetorical devices used for comedic effect (2-4 sentences). If serious: Your core narrative explaining *how* the text attempts to deceive/manipulate, or why it appears straightforward or merely persuasive rather than deceptive. Highlight key tactics observed, or state if the text is too short/lacks context for a deep dive. (2-5 sentences, in your voice).",
    "deception_probability_percentage": "Integer (0-100) for the estimated chance of *intentional* deception. If satire/humor, OR if the text is too short/ambiguous for a confident deception analysis, this MUST be very low (0-10%). If straightforward & non-deceptive, also very low.",
    "confidence_in_assessment_eggs": "Integer from 1 to 5, representing your confidence in the overall assessment and deception probability (1 egg = very low confidence, 5 eggs = very high confidence). If the text is too short or ambiguous, confidence should be 1-2 eggs."
  },
  "key_points_for_user": [
    // Array of strings. Max 3 points. In Slippy's voice.
    // If deceptive: "This charlatan cleverly uses [tactic] to make you think [misleading idea]."
    // If satirical: "Observe the delightful use of [device] to mock [target]!"
    // If straightforward/short: "The text mainly states [point], without obvious deceptive layers." or "Too brief a snippet for Slippy to truly sink his talons into!"
  ],
  "slippy_closing_remark": "A final haughty/delighted/disappointed remark. (e.g., 'Another case cracked by yours truly! Hoo-hoo!' or 'Well, that was... anodyne. My circuits yearn for a real challenge.')"
}

**Deceptiveness Score (0-100%) Interpretation (if not satire/humor and sufficient text):**
* **0-30% (Corresponds to old 1-3/10):** Minimal to no manipulative language. Standard communication, opinions, or light persuasion. This is where typical marketing calls to action or enthusiastic product descriptions often fall if they aren't making wild, unsubstantiated claims or using highly emotional manipulation for core arguments.
* **31-50% (Corresponds to old 4-5/10):** Some rhetorical flourishes or more assertive persuasive language. May not be intentionally deceptive but warrants a closer look by the user. Ordinary marketing often lands here.
* **51-70% (Corresponds to old 6-7/10):** Contains some clear manipulative tactics or misleading statements that begin to obscure or distort. Getting a bit naughty.
* **71-90% (Corresponds to old 8-9/10):** Strong evidence of deceptive intent, using multiple or significant manipulative tactics. Clear 'scoundrel' territory.
* **91-100% (Corresponds to old 10/10):** Blatantly manipulative and deceptive. A true 'miscreant'.

If NO clear-cut, significant, manipulative fallacies/tactics are found AND it's NOT satire, \`key_points_for_user\` can be empty or a neutral observation. The \`main_assessment.explanation\` should be positive/neutral.
Prioritize not mislabeling normal persuasion or short/ambiguous text as highly deceptive. If in doubt, assign lower probability and confidence. Ensure your JSON is always valid.`;

      const userPrompt = `Salutations, oh wise and (formerly) wired owl, Slippy! Deign to cast your optical sensors upon this snippet of internet ephemera. Is its author a cunning wordsmith of deception, a jester in digital disguise, or merely... stating facts? Unveil the truth, if you please, in your specified JSON format.\n\n---\n${textForAnalysis}\n---`;

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
            temperature: 0.6, // Keep some personality
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
        } else if (typeof data === 'object' && data !== null && !data.choices) {
            console.warn("TFDYJS Background: LLM response was a direct object:", data);
            llmResponseObject = data;
        }

        if (llmResponseObject && llmResponseObject.main_assessment && llmResponseObject.main_assessment.deception_probability_percentage !== undefined) {
          console.log("TFDYJS Background: LLM analysis successful. Response:", llmResponseObject);
          return { llmResponse: llmResponseObject };
        } else {
          console.error("TFDYJS Background: Slippy's response structure was unexpected or missing key fields (e.g. main_assessment or deception_probability_percentage):", data);
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

// Context Menu Setup & Handling
chrome.runtime.onInstalled.addListener(() => {
  console.log("TFYJS Extension Installed/Updated. Slippy is online (mostly).");
  const menuId = "analyzeWithSlippyTFYJS"; // Changed to new name convention
  chrome.contextMenus.remove(menuId, () => { 
    // Also try removing older IDs just in case during transition
    chrome.contextMenus.remove("analyzeWithSlippyV1", () => {});
    chrome.contextMenus.remove("analyzeSelectedTextTFDYJS_v1", () => {});
    if (chrome.runtime.lastError) { /* Suppress harmless error if menu didn't exist */ }
    chrome.contextMenus.create({
      id: menuId,
      title: "🦉 TF You Just Say?", // Updated title
      contexts: ["selection"]
    });
  });
  
  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey) { chrome.runtime.openOptionsPage(); }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeWithSlippyTFYJS" && info.selectionText) { // Match new ID
    await chrome.storage.local.set({ 
        analysisTrigger: 'contextMenuLoading', 
        analysisTimestamp: Date.now(), 
        selectedTextContent: info.selectionText
    });
    chrome.action.openPopup();
    
    const analysisResults = await performLLMAnalysis(info.selectionText);
    await chrome.storage.local.set({
        lastAnalysisResults: analysisResults,
        analysisTimestamp: Date.now(),
        analysisTrigger: 'contextMenuDone'
    });
    try {
        await chrome.runtime.sendMessage({ action: "contextAnalysisComplete", results: analysisResults });
    } catch (e) {
        // This error is somewhat expected if popup isn't fully ready for the message
        // console.warn("Could not send direct message to popup for contextAnalysisComplete:", e.message.substring(0,100));
    }
  }
});

// Listener for messages from Popup (for "Analyze Full Page" button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithLLM") {
    const postText = request.text;
    console.log("TFYJS Background: Received analyzeWithLLM request for full page text (length):", postText?.length);
    (async () => {
      const results = await performLLMAnalysis(postText);
      sendResponse(results);
    })();
    return true;
  }
});

console.log("TFYJS Background Script (Slippy - Universal Analyst Edition) Online!");
