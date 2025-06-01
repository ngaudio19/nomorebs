// Listener for page content extraction (used by popup's "Analyze Full Page (Beta)" button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPostText") {
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
  const mainSelectors = ['article', 'main', 'div[role="main"]', 'div[class*="post-content"]', 'div[class*="article-body"]'];
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText && element.innerText.trim().length > 200) {
      return element.innerText.trim();
    }
  }
  let largestText = '';
  const allParagraphs = document.querySelectorAll('p');
  let combinedText = Array.from(allParagraphs).map(p => p.innerText.trim()).join("\n\n");

  if (combinedText.length > largestText.length) {
    largestText = combinedText;
  }
  if (largestText.length < 500) { 
      const bodyClone = document.body.cloneNode(true);
      bodyClone.querySelectorAll('script, style, nav, header, footer, aside, form, button, [aria-hidden="true"], .sidebar, #sidebar, .comments, #comments, .footer, #footer').forEach(el => el.remove());
      let bodyText = bodyClone.innerText.trim().replace(/\s\s+/g, ' '); 
      if (bodyText.length > 200) {
          return bodyText.substring(0, 7000); // Increased limit slightly for more context
      }
  }
  if (largestText.length > 200) {
    return largestText.substring(0, 7000);
  }
  console.warn("TFDYJS content.js: findMainPageContent could not reliably find main text.");
  return null;
}
