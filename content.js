chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPostText") { // Action name kept for compatibility with popup.js
    try {
      const mainText = findMainPageContent();
      if (mainText) {
        sendResponse({ text: mainText });
      } else {
        sendResponse({ error: "Could not automatically identify the main text content on this page. Try selecting text and using the right-click context menu." });
      }
    } catch (e) {
      console.error("Content script: Error extracting main page content:", e);
      sendResponse({ error: `Error extracting content: ${e.message}` });
    }
    return true; // Indicates that the response will be sent asynchronously
  }
});

function findMainPageContent() {
  // This is a VERY basic heuristic and will not work well on many complex pages.
  // It's a placeholder for a more sophisticated main content extraction algorithm.

  // Try common semantic tags for main content
  const mainSelectors = ['article', 'main', 'div[role="main"]', 'div[class*="post-content"]', 'div[class*="article-body"]'];
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText && element.innerText.trim().length > 200) { // Arbitrary length
      // console.log("TFDYJS: Found content in selector:", selector);
      return element.innerText.trim();
    }
  }

  // If no specific main content tags, try to find the largest text block in the body.
  // This is very crude.
  let largestText = '';
  const allParagraphs = document.querySelectorAll('p');
  let combinedText = Array.from(allParagraphs).map(p => p.innerText.trim()).join("\n\n");

  if (combinedText.length > largestText.length) {
    largestText = combinedText;
  }
  
  // As an absolute fallback, take a large chunk of body text, excluding script/style.
  if (largestText.length < 500) { // If paragraphs didn't yield much
      const bodyClone = document.body.cloneNode(true);
      bodyClone.querySelectorAll('script, style, nav, header, footer, aside, form, button, [aria-hidden="true"]').forEach(el => el.remove());
      let bodyText = bodyClone.innerText.trim().replace(/\s\s+/g, ' '); // Replace multiple spaces/newlines
      if (bodyText.length > 200) {
          // console.log("TFDYJS: Found content by body text fallback.");
          return bodyText.substring(0, 5000); // Limit length
      }
  }
  
  if (largestText.length > 200) {
    // console.log("TFDYJS: Found content by combining paragraphs.");
    return largestText.substring(0, 5000); // Limit length
  }

  console.warn("TFDYJS content.js: findMainPageContent could not reliably find main text.");
  return null;
}
