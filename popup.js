document.addEventListener('DOMContentLoaded', async function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsDiv = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const configMessage = document.getElementById('configMessage');
  const openOptionsLink = document.getElementById('openOptionsLink');
  const instructionTextP = document.getElementById('instructionText');

  const overviewSection = document.getElementById('overviewSection');
  const naughtinessSection = document.getElementById('naughtinessSection');
  const naughtinessTitleH3 = document.getElementById('naughtinessTitle');
  const naughtinessRatingP = document.getElementById('naughtinessRating');
  const naughtinessJustificationP = document.getElementById('naughtinessJustification');
  const tacticsSection = document.getElementById('tacticsSection');
  const tacticsTitleH3 = document.getElementById('tacticsTitle'); // Make sure this ID is in your HTML
  const tacticsContainer = document.getElementById('tacticsContainer');

  // References for Slippy's specific output areas from HTML
  const slippyOpeningDiv = document.getElementById('slippyOpening');
  const assessmentTypeDiv = document.getElementById('assessmentType'); // Assuming this exists or is part of overview
  const assessmentExplanationDiv = document.getElementById('assessmentExplanation'); // Assuming this exists or is part of overview
  const probabilityScoreP = document.getElementById('probabilityScore');
  const probabilityConfidenceP = document.getElementById('probabilityConfidence');
  const keyPointsListUl = document.getElementById('keyPointsList');
  const slippyClosingDiv = document.getElementById('slippyClosing');


  const defaultLoadingMessage = "💥 Truth serum activated!";
  loadingMessage.textContent = defaultLoadingMessage;

  async function updateButtonAndInstruction() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab && tab.url ? tab.url : "";
      if (currentUrl && (currentUrl.includes("linkedin.com/feed") || currentUrl.includes("linkedin.com/posts") || currentUrl.includes("linkedin.com/pulse"))) {
        instructionTextP.textContent = "Select text & right-click to analyze, or click below to analyze the main LinkedIn post.";
        analyzeBtn.disabled = false;
        analyzeBtn.title = "Attempts to analyze the main content of the current LinkedIn post.";
      } else {
        instructionTextP.textContent = "To analyze, select text on any page, then right-click and choose 'TFDYJS: Analyze selection'.";
        analyzeBtn.disabled = true;
        analyzeBtn.title = "This button is for analyzing full page content (Beta). Use right-click for specific text.";
      }
    } catch (e) {
      console.error("Error querying tabs for URL:", e);
      instructionTextP.textContent = "Select text & right-click to analyze, or use button for page content.";
      analyzeBtn.disabled = true;
    }
  }
  updateButtonAndInstruction();


  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  function showLoadingState(message) {
    resultsDiv.style.display = 'none';
    errorMessage.style.display = 'none';
    configMessage.style.display = 'none';
    loadingMessage.textContent = message || defaultLoadingMessage;
    loadingMessage.style.display = 'block';
    
    const currentAnalyzeBtnText = analyzeBtn.textContent;
    if (currentAnalyzeBtnText !== "Analyzing...") {
        analyzeBtn.setAttribute('data-original-text', currentAnalyzeBtnText);
    }
    analyzeBtn.textContent = "Analyzing...";
    analyzeBtn.disabled = true;
  }

  function hideLoadingStateRestoreButton() {
    loadingMessage.style.display = 'none';
    const originalText = analyzeBtn.getAttribute('data-original-text') || "Analyze Full Page (Beta)";
    analyzeBtn.textContent = originalText;
    updateButtonAndInstruction();
  }

  function renderResults(analysisData, clearStorage = true) {
    hideLoadingStateRestoreButton();
    resultsDiv.style.display = 'block';

    if (analysisData.error) {
      displayError(analysisData.error);
    } else if (analysisData.llmResponse) {
      displayAnalysis(analysisData.llmResponse);
    } else {
      displayError("Received no data or an unexpected response from analysis.");
    }
    if (clearStorage) {
        chrome.storage.local.remove(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', 'selectedTextContent']);
    }
  }

  async function checkForContextMenuAnalysisOnLoad() {
    try {
      const data = await chrome.storage.local.get(['analysisTrigger', 'lastAnalysisResults', 'analysisTimestamp', '
