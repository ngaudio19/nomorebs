chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPostText") {
    // console.log("Content script: Received getPostText request");
    try {
      const postText = findPostText();
      if (postText) {
        sendResponse({ text: postText });
      } else {
        sendResponse({ error: "Could not identify the LinkedIn post content on the page. Try clicking directly on the post, scrolling it fully into view, or refreshing the page." });
      }
    } catch (e) {
      console.error("Content script: Error extracting post:", e);
      sendResponse({ error: `Error extracting post: ${e.message}` });
    }
    return true; // Indicates that the response will be sent asynchronously
  }
});

function findPostText() {
  let activeElement = document.activeElement;
  let potentialPost = activeElement;
  let textContent = null;

  // Strategy 1: Traverse up from the active (focused/clicked) element
  for (let i = 0; i < 10 && potentialPost && potentialPost.innerText; i++) {
    const postContentSelectors = [
        '.feed-shared-update-v2__description-wrapper .update-components-text',
        '.update-components-text.break-words[dir="ltr"] span[aria-hidden="false"]', // More specific for "see more"
        '.update-components-text.break-words span[aria-hidden="false"]', // General "see more" text
        '.update-components-text.break-words', // Basic text container
        '.attributed-text-segment-list__content',
        '.article-main__content .article-content-body', // For LinkedIn articles
        '.comment__main સામાન્ય__rich-text', // For comments (if ever needed, different styling)
        // Add more specific selectors based on current LinkedIn structure if needed
    ];

    for (const selector of postContentSelectors) {
        const mainContent = potentialPost.querySelector(selector) || (potentialPost.matches(selector) ? potentialPost : null);
        if (mainContent && mainContent.innerText && mainContent.innerText.trim().length > 50) {
            textContent = mainContent.innerText.trim();
            // console.log("Content script: Found post text via active element traversal using selector:", selector);
            return textContent;
        }
    }

    // Check if the potentialPost itself is a known high-level post container
    if (potentialPost.closest('.feed-shared-update-v2, .linkedin-article, .activity-card, .social-details-social-activity__comment-item')) {
        // Try to get text directly from a common child if the container itself was focused
        const directTextElement = potentialPost.querySelector('.update-components-text.break-words span[aria-hidden="false"], .update-components-text.break-words, .article-content-body');
        if (directTextElement && directTextElement.innerText && directTextElement.innerText.trim().length > 50) {
            // console.log("Content script: Found text in child of focused high-level container.");
            return directTextElement.innerText.trim();
        }
    }
    potentialPost = potentialPost.parentElement;
  }

  // Strategy 2: General page scan if active element didn't yield results
  // This is more prone to picking the wrong post if multiple are visible.
  // Prioritize elements that are more likely to be the "main" viewed post.
  const genericSelectors = [
    // Common feed post text (standard and "see more" expanded)
    '.feed-shared-update-v2__description-wrapper .update-components-text.break-words span[aria-hidden="false"]',
    '.feed-shared-update-v2__description-wrapper .update-components-text.break-words',
    // When post is opened in its own detail view or modal
    'main .feed-shared-update-v2__description-wrapper .update-components-text.break-words span[aria-hidden="false"]',
    'main .update-components-text.break-words span[aria-hidden="false"]', // More general text in main area
    // LinkedIn Articles
    '.article-main__content .article-content-body',
    // A common pattern for text content
    '.update-components-text[dir="ltr"]',
    // Fallback for some text elements
    '.white-space-pre-wrap.break-words.text-body-medium'
  ];

  let bestCandidateText = null;
  let highestScore = -1;

  for (const selector of genericSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && element.offsetHeight > 0 && element.offsetWidth > 0;
      
      if (isVisible) {
        const text = element.innerText.trim();
        if (text.length > 100) { // Minimum length for a post
            let score = text.length; // Longer texts are often better candidates
            // Boost score if it's clearly within a main feed item or article structure
            if (element.closest('.feed-shared-update-v2') || element.closest('.linkedin-article')) {
                score += 200;
            }
            // Boost score if it's more central on the screen (very rough heuristic)
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            if (rect.top >= 0 && rect.bottom <= viewportHeight && rect.left >=0 && rect.right <= viewportWidth) { // Fully in viewport
                 // Closer to center is better
                const verticalCenter = viewportHeight / 2;
                const horizontalCenter = viewportWidth / 2;
                const elementVCenter = rect.top + rect.height / 2;
                const elementHCenter = rect.left + rect.width / 2;
                // Simple distance, could be improved
                const distanceToCenter = Math.abs(elementVCenter - verticalCenter) + Math.abs(elementHCenter - horizontalCenter);
                score += ( (viewportHeight + viewportWidth) / 2 - distanceToCenter ) / 10; // Add some points for being central
            }


            if (score > highestScore) {
                highestScore = score;
                bestCandidateText = text;
            }
        }
      }
    }
  }

  if (bestCandidateText) {
    // console.log("Content script: Found post text via generic scan with score:", highestScore);
    return bestCandidateText;
  }

  console.warn("No More Corporate Bullshit: Could not reliably find post text. LinkedIn's structure may have changed, or no suitable post was found with current heuristics.");
  return null;
}
