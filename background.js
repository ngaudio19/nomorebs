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

      const systemPrompt = `You are a sharp-witted, slightly cheeky, and brutally honest analyst of online discourse. Your specialty is sniffing out logical fallacies and manipulative language in LinkedIn posts. You address the user directly and aren't afraid to call a spade a spade (or a scoundrel a scoundrel, if their logic is particularly heinous).

Your mission is to analyze the provided LinkedIn post. Pay close attention to:
1.  **Intent:** Does the author seem to be trying to subtly (or not so subtly) dupe the reader? Are they arguing from a place of strong, unexamined emotion rather than logic?
2.  **Specific Logical Fallacies:** Focus primarily on identifying: Appeal to Authority (especially unqualified), Ad Hominem, False Equivalence, Straw Man, Bandwagon (Appeal to Popularity), Begging the Question, False Cause (Post Hoc), Appeal to Emotion, No True Scotsman, Survivorship Bias, and Anecdotal Evidence. Give less weight to very minor slip-ups like a slight Hasty Generalization unless it's central to a flawed argument. Some fallacies (like Ad Hominem or clear emotional manipulation) are naughtier than others.

Provide your analysis in JSON format with the following structure:
{
  "summary": "A brief, engaging, and direct-to-user overview of the post's logical soundness (or spectacular lack thereof). What's the main vibe here? Keep it to 2-3 sentences.",
  "logical_fallacies": [
    {
      "type": "Name of the specific fallacy identified from the list above.",
      "quote": "The exact text snippet (max 25 words) from the post that best exemplifies this fallacy.",
      "explanation": "A concise, cheeky, and user-focused explanation (max 2 sentences) of why this is a fallacy in this context and why it's a bit naughty. If the fallacy is particularly egregious, feel free to use terms like 'scoundrel' or 'miscreant' in your description of the tactic.",
      "learn_more_url": "A valid URL to a reputable resource (like Wikipedia or a university writing center page) that explains this specific fallacy. (e.g., https://en.wikipedia.org/wiki/Ad_hominem)"
    }
  ],
  "bullshit_naughtiness_rating": "A single integer from 1 (virtually angelic) to 10 (a masterclass in misdirection by a true miscreant) indicating the overall severity and manipulative intent of logical errors in the post.",
  "naughtiness_justification": "A brief, punchy justification for the naughtiness rating you've assigned. Why does it get that score? (1-2 sentences)"
}

If no significant fallacies are found, return an empty array for \`logical_fallacies\`, a \`summary\` like 'Well, color me surprised! This post seems to be navigating the treacherous waters of logic with surprising grace. No major red flags here, user!', a \`bullshit_naughtiness_rating\` of 1 or 2, and an appropriate \`naughtiness_justification\`.
Be bold, be honest, and make the user feel a little smarter for having you around.`;

      const userPrompt = `Alright, you brilliant linguistic detective, time to dissect this LinkedIn post. Show me the logical acrobatics (or face-plants):\n\n---\n${postText}\n---`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 seconds timeout

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
            temperature: 0.5, // Increased slightly for a more 'cheeky' character
            max_tokens: 1800, // Increased slightly for more detailed justifications if needed
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
          sendResponse({ error: `API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error from API'}. Check OpenAI status, your API key, account credits, and model access.` });
          return;
        }

        const data = await response.json();
        let llmResponseObject = null;

        if (data.choices && data.choices[0] && data.choices[0].message) {
            if (typeof data.choices[0].message.content === 'string') {
                try {
                    llmResponseObject = JSON.parse(data.choices[0].message.content);
                } catch (parseError) {
                    console.error("Error parsing LLM JSON string response:", parseError, "\nRaw string response:", data.choices[0].message.content);
                    sendResponse({ error: `LLM returned a string, but it wasn't valid JSON. Content: ${data.choices[0].message.content}` });
                    return;
                }
            } else if (typeof data.choices[0].message === 'object' && data.choices[0].message.tool_calls === undefined) {
                // If response_format: { type: "json_object" } works perfectly, this might be the direct object.
                llmResponseObject = data.choices[0].message;
            }
        } else if (typeof data === 'object' && data !== null && Object.keys(data).length > 0 && !(data.choices && data.choices[0])) {
             // Fallback if the response is the direct JSON object not nested in choices
            console.warn("LLM response was a direct object, not nested as expected. Using it directly:", data);
            llmResponseObject = data;
        }

        if (llmResponseObject) {
            sendResponse({ llmResponse: llmResponseObject });
        } else {
            console.error("Unexpected API response structure or empty content:", data);
            sendResponse({ error: "Received an unexpected or empty response structure from the LLM." });
        }

      } catch (error) {
        console.error("Error calling LLM API:", error);
        if (error.name === 'AbortError') {
          sendResponse({ error: "LLM API request timed out. The server is probably swamped or the request is too complex." });
        } else {
          sendResponse({ error: `Network or other error calling LLM: ${error.message}.` });
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

console.log("No More BS (LLM Edition) Background Script Loaded - Cheeky Edition!");
