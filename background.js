// --- LLM Configuration ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"; // Or your preferred OpenAI model like gpt-3.5-turbo, gpt-4-turbo

async function getLLMSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'apiEndpoint', 'modelName'], resolve);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithLLM") {
    const postText = request.text;

    (async () => {
      const settings = await getLLMSettings();
      if (!settings.apiKey) {
        sendResponse({ error: "API Key not found. Please set it in the extension options." });
        return;
      }

      const apiKey = settings.apiKey;
      const apiEndpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
      const modelName = settings.modelName || DEFAULT_OPENAI_MODEL;

      const systemPrompt = `You are an expert analyst specializing in deconstructing corporate communication.
Your task is to analyze the following LinkedIn post for logical fallacies and "marketing bullshit" (e.g., empty buzzwords, excessive hype, vague claims, meaningless jargon).

Please provide your analysis in JSON format with the following structure:
{
  "summary": "A brief overall impression of the post's content and tone. Maximum 2-3 sentences.",
  "logical_fallacies": [
    {
      "type": "Name of Fallacy (e.g., Ad Hominem, Straw Man, Appeal to Unqualified Authority, Hasty Generalization, False Dichotomy, Slippery Slope, Anecdotal Evidence, Appeal to Emotion, Bandwagon Fallacy)",
      "quote": "The specific text snippet (max 20 words) from the post that exhibits this fallacy.",
      "explanation": "A brief explanation (max 1-2 sentences) of why this is a fallacy in this context."
    }
  ],
  "marketing_bullshit": [
    {
      "term": "The buzzword or bullshit phrase identified.",
      "quote": "The specific text snippet (max 20 words) from the post containing this term/phrase.",
      "critique": "Why this term/phrase is considered marketing bullshit in this context (e.g., vague, overused, misleading, cliché). Max 1-2 sentences."
    }
  ],
  "overall_rating": "Optional: A concise qualitative rating like 'High Bullshit Content', 'Some Exaggeration Noted', 'Relatively Clear and Factual', 'Mostly Buzzwords'."
}

If no specific fallacies or marketing bullshit are found, return empty arrays for those keys but still provide a summary and an overall_rating like 'Appears clear of common fallacies and marketing jargon.'.
Be objective and analytical. Avoid offensive language in your analysis output.
Focus on common fallacies and typical corporate jargon. Keep quotes and explanations brief.
`;

      const userPrompt = `Please analyze this LinkedIn post:\n\n---\n${postText}\n---`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

        const response = await fetch(apiEndpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2, // Lowered for more factual, less "creative" responses
            max_tokens: 1500, // Increased slightly, adjust based on typical response sizes
            response_format: { type: "json_object" } // Request JSON output if model supports it
          })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text(); // Get raw text for more debug info
          let errorData;
          try {
            errorData = JSON.parse(errorBody);
          } catch (e) {
            errorData = { message: errorBody || response.statusText };
          }
          console.error("LLM API Error Details:", errorData);
          sendResponse({ error: `API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error from API'}. Check API key, endpoint, model, and permissions. Also ensure your OpenAI account has credits.` });
          return;
        }

        const data = await response.json();

        // With response_format: { type: "json_object" }, the response should already be parsed JSON
        // The actual content might be directly in `data` or nested depending on the model's exact wrapping of JSON mode.
        // For OpenAI, if `response_format` is used, `data.choices[0].message.content` SHOULD be a stringified JSON.
        // However, sometimes the model might directly return the object in `data.choices[0].message` if it's not further wrapped.

        let llmResponseContent;
        if (data.choices && data.choices[0] && data.choices[0].message) {
            if (typeof data.choices[0].message.content === 'string') {
                 llmResponseContent = data.choices[0].message.content;
            } else if (typeof data.choices[0].message === 'object' && data.choices[0].message.tool_calls === undefined) {
                // Some models might return the JSON object directly in message when json_object mode is on
                // llmResponseContent = JSON.stringify(data.choices[0].message); // Not needed, pass object directly
                 sendResponse({ llmResponse: data.choices[0].message });
                 return;
            }
        }


        if (llmResponseContent) {
          try {
            const parsedResponse = JSON.parse(llmResponseContent);
            sendResponse({ llmResponse: parsedResponse });
          } catch (parseError) {
            console.error("Error parsing LLM JSON string response:", parseError, "\nRaw string response:", llmResponseContent);
            sendResponse({ llmResponse: `Could not parse JSON from LLM, raw response: ${llmResponseContent}` });
          }
        } else {
          // If `response_format: { type: "json_object" }` is working as intended with the model,
          // `data` itself might be the direct JSON object if not nested in choices[0].message.content.
          // This part depends on the specific OpenAI model and if it strictly adheres to putting the JSON *string* in `content`.
          // Let's assume for now it's in `content` as a string.
          // If `llmResponseContent` is undefined but `data` is an object, it means the structure was unexpected.
          if (typeof data === 'object' && data !== null && Object.keys(data).length > 0 && !(data.choices && data.choices[0])) {
             console.warn("LLM response was a direct object, not nested as expected. Trying to use it directly:", data);
             sendResponse({ llmResponse: data }); // Send the whole data object if it looks like the result
          } else {
            console.error("Unexpected API response structure or empty content:", data);
            sendResponse({ error: "Received an unexpected or empty response structure from the LLM." });
          }
        }

      } catch (error) {
        console.error("Error calling LLM API:", error);
        if (error.name === 'AbortError') {
            sendResponse({ error: "LLM API request timed out after 30 seconds." });
        } else {
            sendResponse({ error: `Network or other error calling LLM: ${error.message}. Ensure the API endpoint in manifest.json host_permissions is correct and reachable.` });
        }
      }
    })();

    return true; // Indicates that the response will be sent asynchronously.
  }
});

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install" || details.reason === "update") { // Open options on install or update
        // Check if API key is already set
        chrome.storage.local.get(['apiKey'], (result) => {
            if (!result.apiKey) {
                chrome.runtime.openOptionsPage();
            }
        });
    }
});

console.log("No More BS (LLM Edition) Background Script Loaded.");
