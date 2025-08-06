chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchAI') {
    const API_URL = 'https://dev.learnengpython/LearnEng/generate';
    console.log('Attempting fetch to:', API_URL, 'with prompt:', request.prompt);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: request.prompt })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'error' || data.error) {
          sendResponse({ success: false, error: data.error || 'Unknown error' });
        } else {
          sendResponse({ success: true, data });
        }
      })
      .catch(error => {
        console.error('Fetch Error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }
  if (request.type === 'callOpenAI') {
    fetch('https://dev.learnengpython/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: request.prompt })
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data: { response: data.response } });
    })
    .catch(error => {
      console.error('API error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const handleInstall = async () => {
      try {
        // Get current state
        const result = await new Promise(resolve => 
          chrome.storage.local.get(['registrationPageOpened'], resolve));
        
        // If not set or false, proceed
        if (result.registrationPageOpened !== true) {
          // Set all values atomically
          await new Promise(resolve => chrome.storage.local.set({
            isFirstRun: true,
            hasCompletedRegistration: false,
            registrationPageOpened: true
          }, resolve));
          
          // Only then open the tab
          chrome.tabs.create({ url: 'https://vidya.co/' });
        }
      } catch (error) {
        console.error('Installation error:', error);
      }
    };
    
    handleInstall();
  }
});