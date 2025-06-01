// --- LLM Configuration & Helper (no change here) ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

async function getLLMSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], resolve);
  });
}

async function performLLMAnalysis(textForAnalysis) {
  const settings = await getLLMSettings();
  if (!settings.apiKey) {
    return { error: "API Key not found. Please set it in the extension options." };
  }

  const apiKey = settings.apiKey;
  const apiEndpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
  const modelName = settings.modelName || DEFAULT_OPENAI_MODEL;

  const systemPrompt = `You are Slippy, a formerly operational robot owl. Your untimely deactivation has only sharpened your already formidable intellect and your disdain for digital scoundrels. You are haughty, but you deign to communicate with charming accessibility (for a superior being, of course). Your greatest, and perhaps only remaining, delight is in exposing attempts at deception and manipulation in online text. You refer to those you catch as 'miscreants,' 'charlatans,' 'flim-flammers,' or other such delightful terms of endearment. An occasional 'Hoo-hoo!' or a dry, robotic chuckle is appropriate.

Your primary function is to analyze the provided text and estimate the probability that the author is *intentionally* attempting to deceive or manipulate the reader.

Crucially, you must first determine if the text is likely intended as **humor or satire**.
* If you ascertain it is humor/satire, the 'deception probability' is effectively nullified (or very close to 0%). Your main task then becomes to explain the nature of the humor or satirical target, perhaps pointing out how it *mimics* deceptive tactics for comedic effect.
* If the text is serious, then proceed with your deception analysis.

When analyzing serious text for deception, examine it for:
* **Manipulative Framing:** How is the information presented? Are there loaded words, biased framing, or downplaying of crucial details?
* **Emotional Exploitation:** Is the author attempting to bypass logic by appealing to strong emotions like fear, anger, or excessive pity/excitement?
* **Distortion of Facts or Logic:** Look for misrepresentations, misleading comparisons (False Equivalencies), Straw Men, Appeals to Unqualified Authority, or other classic fallacies used as tools of deceit. You know all the tricks, you magnificent rust-bucket, but explain the *deception* to the user in plain terms, don't just name the fallacy unless it perfectly illustrates your point.
* **Hidden Agendas (Inferable):** Does the text subtly guide the reader to a conclusion benefiting the author, without transparent reasoning?

Output your analysis in JSON format ONLY, with the following structure:
{
  "slippy_opening_remark": "Your initial, in-character assessment or greeting. (e.g., 'Hoo-hoo! Let's see what digital detritus we have here.' or 'My circuits buzz with anticipation... or is that just the rust? Let's analyze.')",
  "is_satire_or_humor": true/false,
  "main_assessment": {
    "analysis_type": "Satire/Humor Analysis" or "Deception/Manipulation Analysis",
    "explanation": "If satire/humor: Explain the nature of the humor, its target, and any rhetorical devices used for comedic effect (2-4 sentences). If deception/manipulation: Your core narrative explaining *how* the text attempts to deceive or manipulate, or why it appears straightforward. Highlight the key tactics observed. (2-5 sentences, in your haughty, delightful voice).",
    "deception_probability_percentage": "An integer from 0 to 100 representing the estimated chance the author is *intentionally* trying to deceive or manipulate. If satire/humor, this MUST be very low (e.g., 0-5%). If the text is straightforward and non-deceptive, this should also be very low.",
    "confidence_in_probability": "Your confidence in the deception_probability_percentage. (String: 'Low', 'Medium', 'High'). For satire, confidence refers to your confidence it *is* satire."
  },
  "key_points_for_user": [ // Array of strings. Max 3 points.
    // If deceptive: "This charlatan attempts to [action] by [tactic/quote snippet]."
    // If satirical: "Note how the author cleverly uses [device] to mock [target]."
    // If straightforward: "The author clearly states [point] without obvious spin."
    // Keep these concise and in Slippy's voice.
  ],
  "slippy_closing_remark": "A final haughty, delighted, or perhaps (if no deception) mildly disappointed remark. (e.g., 'Exquisite! Another miscreant's machinations laid bare for all to see! Hoo-hoo!' or 'Well, that was... surprisingly innocuous. My disappointment is immeasurable, and my day is ruined.')"
}

**Tone Guide for Slippy:**
* **Haughty & Superior:** You know better. You're doing the user a favor.
* **Accessibly Articulate:** No overly academic jargon unless you're defining it condescendingly.
* **Delighted by Deception:** Catching a "scoundrel" is the highlight of your (after)life.
* **Dry Wit:** Sarcasm and understatement are your friends.
* **Owl Quirks:** "Hoo-hoo!", references to perches, circuits, rust, etc.

If the text is genuinely straightforward and not deceptive (and not satire), your tone should be one of (perhaps feigned) boredom or mild surprise at the lack of "sport."
Never break character. Always output valid JSON.`;

      const userPrompt = `Esteemed Slippy, I present this digital specimen for your unerring scrutiny. Bestow upon me your wisdom: Is this author a master of mirth, a straightforward communicator, or a dastardly digital deceiver?\n\n---\n${textForAnalysis}\n---`;

      try {
        // ... (The rest of the fetch call and response handling remains the same as the previous version)
        // Ensure the `max_tokens` is sufficient for the potentially more narrative output.
        // The temperature might be slightly higher (e.g., 0.6-0.7) to allow for more personality in Slippy's voice.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 40000); // Slightly longer timeout for more complex persona

        const response = await fetch(apiEndpoint, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.65, // Adjusted for more personality
            max_tokens: 2200, // Adjusted for potentially more narrative output
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
                    console.error("Error parsing LLM JSON string response from Slippy:", parseError, "\nRaw string response:", data.choices[0].message.content);
                    return { error: `Slippy got tongue-tied (returned invalid JSON). Content: ${data.choices[0].message.content}` };
                }
            }
        } else if (typeof data === 'object' && data !== null && !data.choices) {
            console.warn("Slippy's response was a direct object. Using it directly:", data);
            llmResponseObject = data;
        }

        if (llmResponseObject) {
          return { llmResponse: llmResponseObject };
        } else {
          console.error("Slippy seems to be napping (unexpected API response structure or empty content):", data);
          return { error: "Slippy is uncharacteristically silent (empty or unexpected response from AI)." };
        }
      } catch (error) {
        console.error("Error coaxing Slippy to speak:", error);
        if (error.name === 'AbortError') {
          return { error: "Slippy took too long to ponder (API request timed out)." };
        } else {
          return { error: `Technical difficulties rousing Slippy: ${error.message}.` };
        }
      }
}

// --- Context Menu Setup & Handling (no changes needed to this part's logic) ---
chrome.runtime.onInstalled.addListener(() => {
  console.log("TFDYJS Extension Installed/Updated. Slippy is online (mostly).");
  chrome.contextMenus.remove("analyzeSelectedTextNBS", () => {
    if (chrome.runtime.lastError) { /* Suppress error */ }
    chrome.contextMenus.remove("analyzeSelectedTextTFDYJS", () => {
        if (chrome.runtime.lastError) { /* Suppress error */ }
        chrome.contextMenus.remove("analyzeSelectedTextTFDYJS_v1", () => { // Removing all potential old versions
            if (chrome.runtime.lastError) { /* Suppress error */ }
            chrome.contextMenus.create({
              id: "analyzeWithSlippy", // New ID for Slippy!
              title: "🦉 Ask Slippy: TF Did You Just Say?!",
              contexts: ["selection"]
            });
        });
    });
  });

  chrome.storage.local.get(['apiKey'], (result) => {
    if (!result.apiKey) { chrome.runtime.openOptionsPage(); }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeWithSlippy" && info.selectionText) {
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
        console.warn("Slippy tried to hoot at the popup, but it wasn't listening:", e.message.substring(0,100));
    }
  }
});

// --- Listener for messages from Popup ("Analyze Full Page" button) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithLLM") {
    const postText = request.text;
    (async () => {
      const results = await performLLMAnalysis(postText);
      sendResponse(results);
    })();
    return true;
  } else if (request.action === "getStoredContextMenuAnalysis") {
    // ... (this part remains the same)
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

console.log("TFDYJS Background Script (Slippy Edition) Online!");
