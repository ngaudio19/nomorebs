// Listener for LinkedIn-specific text extraction (used by popup's "Analyze Post" button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPostText") {
    try {
      if (window.location.hostname.includes("linkedin.com")) {
        const postText = findLinkedInPostText();
        if (postText) {
          sendResponse({ text: postText });
        } else {
          sendResponse({ error: "Could not identify LinkedIn post content. Try clicking the post or scrolling it fully into view." });
        }
      } else {
        // This case should ideally be prevented by disabling the button in popup.js
        sendResponse({ error: "The 'Analyze Post' button is specific to LinkedIn pages." });
      }
    } catch (e) {
      console.error("Content script: Error extracting LinkedIn post:", e);
      sendResponse({ error: `Error extracting post: ${e.message}` });
    }
    return true; // Indicates that the response will be sent asynchronously
  }
});

function findLinkedInPostText() {
  // This is the complex LinkedIn-specific DOM traversal logic.
  // Ensure you have your full LinkedIn text extraction logic here from previous versions.
  let activeElement = document.activeElement;
  let potentialPost = activeElement;
  for (let i = 0; i < 10 && potentialPost && potentialPost.innerText; i++) {
    const postContentSelectors = [
        '.feed-shared-update-v2__description-wrapper .update-components-text',
        '.update-components-text.break-words[dir="ltr"] span[aria-hidden="false"]',
        '.update-components-text.break-words span[aria-hidden="false"]',
        '.update-components-text.break-words',
        '.attributed-text-segment-list__content',
        '.article-main__content .article-content-body',
    ];
    for (const selector of postContentSelectors) {
        const mainContent = potentialPost.querySelector(selector) || (potentialPost.matches(selector) ? potentialPost : null);
        if (mainContent && mainContent.innerText && mainContent.innerText.trim().length > 50) {
            return mainContent.innerText.trim();
        }
    }
    if (potentialPost.closest('.feed-shared-update-v2, .linkedin-article, .activity-card')) {
        const directTextElement = potentialPost.querySelector('.update-components-text.break-words span[aria-hidden="false"], .update-components-text.break-words, .article-content-body');
        if (directTextElement && directTextElement.innerText && directTextElement.innerText.trim().length > 50) {
            return directTextElement.innerText.trim();
        }
    }
    potentialPost = potentialPost.parentElement;
  }
  const genericSelectors = [
    '.feed-shared-update-v2__description-wrapper .update-components-text.break-words span[aria-hidden="false"]',
    '.feed-shared-update-v2__description-wrapper .update-components-text.break-words',
    'main .feed-shared-update-v2__description-wrapper .update-components-text.break-words span[aria-hidden="false"]',
    '.article-main__content .article-content-body',
    '.update-components-text[dir="ltr"]',
  ];
  for (const selector of genericSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && element.offsetHeight > 0 && element.offsetWidth > 0;
      if (isVisible) {
        const text = element.innerText.trim();
        if (text.length > 100) { return text; }
      }
    }
  }
  return null;
}
