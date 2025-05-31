// --- LLM Configuration ---
const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"; // Or your preferred OpenAI model

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

      const systemPrompt = `You are a joyful yet strict analyst of online content, with a focus on logical reasoning. Your mission is to examine the following LinkedIn post and identify any logical fallacies present. Your analysis should be direct, honest, and engaging for the user.

Please provide your analysis in JSON format with the following structure:
{
  "summary": "A brief, fun overview of the post's logical coherence (or lack thereof). Aim for 1-2 sentences directly addressing the user.",
  "logical_fallacies": [
    {
      "type": "Name of Fallacy (e.g., Ad Hominem, Straw Man, Appeal to Unqualified Authority, Hasty Generalization, False Dichotomy, Slippery Slope, Anecdotal Evidence, Appeal to Emotion, Bandwagon Fallacy)",
      "quote": "The specific text snippet (max 20 words) from the post that exhibits this fallacy.",
      "explanation": "A brief, user-focused explanation (max 1-2 sentences) of why this is a fallacy in this context.",
      "learn_more_url": "Optional: A URL to a resource explaining this fallacy."
    }
  ],
  "flagrancy_rating": "A single integer from 1 to 5 indicating the overall flagrancy of logical errors in the post, where 1 is 'Minor Oopsie' and 5 is 'Logically Catastrophic'. You can use your own fun labels for these levels.",
  "overall_vibe": "A single word or short phrase describing the overall logical vibe of the post (e.g., 'Reasonably sound', 'A bit wobbly', 'Deeply flawed')."
}

If no specific fallacies are found, return an empty array for logical_fallacies and a summary like 'Hooray! No obvious logical leaps detected. Carry on!' and a flagrancy_rating of 1 with a vibe of 'Logically serene'. Be concise and fun!`;

      const userPrompt = `Analyze this LinkedIn post for logical fallacies:\n\n---\n${postText}\n---`;

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
            temperature: 0.4, // Slightly higher for more playful tone
            max_tokens: 1500,
            response_format: { type: "json_object" }
          })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorBody);
          } catch (e) {
            errorData = { message: errorBody || response.statusText };
          }
          console.error("LLM API Error Details:", errorData);
          sendResponse({ error: `API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error from API'}. Check API key, endpoint, model, and permissions.` });
          return;
        }

        const data = await response.json();

        let llmResponseContent;
        if (data.choices && data.choices [0] && data.choices [0].message) {
          if (typeof data.choices [0].message.content === 'string') {
            llmResponseContent = data.choices [0].message.content;
          } else if (typeof data.choices [0].message === 'object' && data.choices [0].message.tool_calls === undefined) {
            sendResponse({ llmResponse: data.choices [0].message });
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
        } else if (typeof data === 'object' && data !== null && Object.keys(data).length > 0 && !(data.choices && data.choices [0])) {
          console.warn("LLM response was a direct object, not nested as expected. Trying to use it directly:", data);
          sendResponse({ llmResponse: data });
        } else {
          console.error("Unexpected API response structure or empty content:", data);
          sendResponse({ error: "Received an unexpected or empty response structure from the LLM." });
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

    return true;
  }
});

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install" || details.reason === "update") {
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!result.apiKey) {
        chrome.runtime.openOptionsPage();
      }
    });
  }
});

console.log("No More BS (LLM Edition) Background Script Loaded.");
