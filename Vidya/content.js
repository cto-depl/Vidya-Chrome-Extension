let toolti = null;
let chatSidebar = null;
let floatingIcon = null;
let chatContainer = null;
let isVoiceMode = false;
let recognition = null;
let isRecording = false;
let isSpeaking = false;
let currentUtterance = null;
let conversationHistory = [];
let userProfile = null;
let loginModal = null;
const ALLOWED_EMAILS_SHEET = 'https://docs.google.com/spreadsheets/d/1SRxSeP2sdbJgWQGKmMCNeyDhQLsQU-VrSMMlrSWZJOA/edit?usp=sharing';
const REGISTRATION_URL = 'https://vidy.co/';
let isFirstRun = true;
const REGISTRATION_CHECK_INTERVAL = 5000; // 1 second
const MAX_REGISTRATION_CHECKS = 5;
let isVoiceInputActive = false;

let quizState = {
  questions: [],
  currentIndex: 0,
  userAnswers: [],
  startTime: null,
  totalQuestions: 0
};


function createLoginModal() {
  if (loginModal) return;

  loginModal = document.createElement('div');
  loginModal.className = 'vidy-login-modal';
  loginModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
  `;

  loginModal.innerHTML = `
    <div class="login-container" style="background: white; padding: 30px; border-radius: 10px; width: 350px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="vidy" style="width: 80px; height: 80px;">
        <h2 style="margin: 10px 0 5px; color: #333;">Login to vidy</h2>
        <p style="color: #666; margin: 0;">Please enter your credentials</p>
      </div>
      <div id="login-error" style="color: #f44336; margin-bottom: 15px; display: none;"></div>
      <form id="login-formrm">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #555;">Email</label>
          <input type="email" id="login-email" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; color: #555;">Password</label>
          <input type="password" id="login-password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
        </div>
        <button type="submit" style="width: 100%; padding: 12px;   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">Login</button>
      </form>
    </div>
  `;

  document.body.appendChild(loginModal);

  const loginForm = loginModal.querySelector('#login-formrm');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginModal.querySelector('#login-email').value.trim();
    const password = loginModal.querySelector('#login-password').value.trim();
    const errorElement = loginModal.querySelector('#login-error');

    try {
      const isValid = await validateCredentials(email, password);
      if (isValid) {
        // Store login state
        chrome.storage.local.set({ isLoggedIn: true, userEmail: email }, () => {
          loginModal.remove();
          loginModal = null;
          createFloatingIcon(); // Show the floating icon after login
        });
      } else {
        errorElement.textContent = 'Invalid email or password';
        errorElement.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorElement.textContent = 'Login failed. Please try again.';
      errorElement.style.display = 'block';
    }
  });
}
async function validateCredentials(email, password) {
  try {
    // In a Chrome extension, we need to use chrome.identity or a backend service
    // For this example, we'll use a hardcoded check since direct access to Google Sheets isn't possible from content script

    // HARDCODED CREDENTIALS (for demo purposes - in production, use a backend service)
    const validCredentials = {
      'sathwiky579@gmail.com': 'amma143nanna'
      // Add more credentials as needed
    };

    return validCredentials[email] === password;

    // In a real implementation, you would:
    // 1. Set up a Google Apps Script as a backend
    // 2. Call it from your extension to validate credentials
    // Example:
    // const response = await fetch('YOUR_APPS_SCRIPT_URL?email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password));
    // return response.ok && (await response.json()).valid;

  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}
class PageContentScraper {
  constructor() {
    this.supportMessages = [];
    this.chatMessages = [];
    this.currentMode = 'support';
    this.isChatOpen = false;
    this.lastSupportRecommendedQuestions = [];
    this.lastAction = null;
  }
  async loadChatState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['chatState'], (result) => {
        const state = result.chatState || {};
        this.supportMessages = state.supportMessages || [];
        this.chatMessages = state.chatMessages || [];
        this.currentMode = state.currentMode || 'support';
        this.isChatOpen = state.isChatOpen || false;
        this.lastSupportRecommendedQuestions = state.lastSupportRecommendedQuestions || [];
        this.lastAction = state.lastAction || null;
        console.log('Loaded chat state:', {
          supportMessages: this.supportMessages,
          chatMessages: this.chatMessages,
          currentMode: this.currentMode,
          isChatOpen: this.isChatOpen,
          lastSupportRecommendedQuestions: this.lastSupportRecommendedQuestions,
          lastAction: this.lastAction
        });
        resolve();
      });
    });
  }


  saveChatState() {
    const state = {
      supportMessages: this.supportMessages,
      chatMessages: this.chatMessages,
      currentMode: this.currentMode,
      isChatOpen: this.isChatOpen,
      lastSupportRecommendedQuestions: this.lastSupportRecommendedQuestions,
      lastAction: this.lastAction
    };
    chrome.storage.local.set({ chatState: state }, () => {
      console.log('Chat state saved:', state);
    });
  }
  scrapePageContent() {
    const content = {
      title: document.title,
      url: window.location.href,
      text: this.getPageText(),
      structure: this.getPageStructure(),
      forms: this.getForms(),
      links: this.getLinks(),
      buttons: this.getButtons(),
      inputs: this.getInputs(),
      metadata: this.getMetadata()
    };
    return JSON.stringify(content, null, 2);
  }

  getPageText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.trim().length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node.textContent.trim());
    }
    return textNodes.join(' ').replace(/\s+/g, ' ').trim();
  }

  getPageStructure() {
    const structure = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      if (this.isVisible(heading)) {
        structure.push({
          type: 'heading',
          level: heading.tagName.toLowerCase(),
          text: heading.textContent.trim(),
          id: heading.id || null,
          classes: Array.from(heading.classList)
        });
      }
    });
    const sections = document.querySelectorAll('section, article, main, nav, aside, header, footer');
    sections.forEach(section => {
      if (this.isVisible(section)) {
        structure.push({
          type: 'section',
          tag: section.tagName.toLowerCase(),
          id: section.id || null,
          classes: Array.from(section.classList),
          text: this.getElementText(section).substring(0, 200) + '...'
        });
      }
    });
    return structure;
  }

  getForms() {
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
      if (this.isVisible(form)) {
        const formInputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || null,
          id: input.id || null,
          placeholder: input.placeholder || null,
          required: input.required || false,
          classes: Array.from(input.classList)
        }));
        forms.push({
          id: form.id || null,
          action: form.action || null,
          method: form.method || 'GET',
          classes: Array.from(form.classList),
          inputs: formInputs
        });
      }
    });
    return forms;
  }

  getLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(link => {
      if (this.isVisible(link)) {
        links.push({
          text: link.textContent.trim(),
          href: link.href,
          id: link.id || null,
          classes: Array.from(link.classList)
        });
      }
    });
    return links.slice(0, 50);
  }

  getButtons() {
    const buttons = [];
    document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(button => {
      if (this.isVisible(button)) {
        buttons.push({
          text: button.textContent.trim() || button.value || 'Button',
          type: button.type || 'button',
          id: button.id || null,
          classes: Array.from(button.classList),
          disabled: button.disabled || false
        });
      }
    });
    return buttons;
  }

  getInputs() {
    const inputs = [];
    document.querySelectorAll('input, select, textarea').forEach(input => {
      if (this.isVisible(input)) {
        inputs.push({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || null,
          id: input.id || null,
          placeholder: input.placeholder || null,
          value: input.value || null,
          required: input.required || false,
          classes: Array.from(input.classList)
        });
      }
    });
    return inputs;
  }

  getMetadata() {
    const meta = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(metaTag => {
      const name = metaTag.getAttribute('name') || metaTag.getAttribute('property');
      const content = metaTag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    meta.title = document.title;
    meta.url = window.location.href;
    meta.domain = window.location.hostname;
    return meta;
  }

  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0;
  }

  getElementText(element) {
    const clone = element.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());
    return clone.textContent.trim();
  }

  async executeAction(actionData) {
    try {
      const { type, selector, value, background } = actionData;
      console.log('Executing action:', actionData);

      // For click actions with a non-null value, navigate directly
      if (type === 'click' && value) {
        console.log('Navigating to:', value);
        window.location.href = value;
        return { success: true };
      }

      // Existing logic for other cases
      if (type === 'navigate' && value && /^https?:\/\//.test(value)) {
        this.isChatOpen = !!chatContainer;
        await this.saveChatState();
        window.location.href = value;
        return { success: true };
      }

      let element = selector ? document.querySelector(selector) : null;
      if (!element && type !== 'navigate') {
        console.warn(`Element not found with selector: ${selector}`);
        return { success: false, error: `Element not found: ${selector}` };
      }

      if (background) {
        setTimeout(async () => {
          try {
            switch (type) {
              case 'click':
                if (element.tagName.toLowerCase() === 'a') {
                  window.location.href = value || element.href;
                } else {
                  await this.clickElement(element);
                }
                break;
              case 'scroll':
                await this.scrollToElement(element);
                break;
              case 'highlight':
                await this.highlightElement(element);
                break;
              case 'fill':
                if (!value) return;
                await this.fillElement(element, value);
                break;
            }
          } catch (error) {
            console.error('Background action error:', error);
          }
        }, 1000);
        return { success: true, message: 'Background action queued' };
      }

      switch (type) {
        case 'click':
          if (element.tagName.toLowerCase() === 'a') {
            window.location.href = value || element.href;
          } else {
            await this.clickElement(element);
          }
          break;
        case 'scroll':
          await this.scrollToElement(element);
          break;
        case 'highlight':
          await this.highlightElement(element);
          break;
        case 'fill':
          if (!value) return { success: false, error: 'Value is required for fill action' };
          await this.fillElement(element, value);
          break;
        default:
          return { success: false, error: `Unknown action type: ${type}` };
      }

      return { success: true };
    } catch (error) {
      console.error('Action execution error:', error);
      return { success: false, error: error.message, stack: error.stack };
    }
  }
  // Replace the existing clickElement method with this updated version
  async clickElement(element) {
    try {
      if (!element.isConnected) throw new Error('Element is not in the DOM');
      console.log('Attempting to click element:', element);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));
      if (element.disabled || !this.isVisible(element)) {
        throw new Error('Element is disabled or not visible');
      }
      if (element.tagName.toLowerCase() === 'a' && element.href) {
        console.log('Navigating directly to:', element.href);
        window.location.href = element.href;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }
      element.click();
      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, { bubbles: true, cancelable: true, view: window });
        element.dispatchEvent(event);
      });
      if (element.tagName.toLowerCase() === 'a' && element.onclick) {
        console.log('Executing onclick handler');
        if (typeof element.onclick === 'function') {
          element.onclick();
        }
      }
    } catch (error) {
      console.error('Click error:', error);
      if (element.tagName.toLowerCase() === 'a' && element.href) {
        console.log('Falling back to navigation:', element.href);
        window.location.href = element.href;
      }
      throw error;
    }
  }

  async scrollToElement(element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async highlightElement(element) {
    const originalStyle = {
      outline: element.style.outline,
      backgroundColor: element.style.backgroundColor,
      transition: element.style.transition
    };
    element.style.transition = 'all 0.3s ease';


    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      element.style.outline = originalStyle.outline;
      element.style.backgroundColor = originalStyle.backgroundColor;
      element.style.transition = originalStyle.transition;
    }, 3000);
  }

  async fillElement(element, value) {
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      element.focus();
      element.value = '';
      for (let i = 0; i < value.length; i++) {
        element.value += value[i];
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);
    } else {
      throw new Error('Element is not fillable (not an input or textarea)');
    }
  }
}

// When processing AI response action
const pageContentScraper = new PageContentScraper();

// Store user profile data
// Initialize the floating icon as soon as the script runs
createFloatingIcon();

// Add event listeners for toolti
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (selectedText.length > 0 && !toolti) {
    const isInsideChat = chatContainer && chatContainer.contains(e.target);
    if (!isInsideChat) {
      showtoolti(e, selectedText);
    }
  }
});

chrome.storage.local.get(['userProfile'], (result) => {
  userProfile = result.userProfile || { supportNeeded: true, language: 'English', autoNavigate: true }; // Add default fields

});
document.addEventListener('mousedown', (e) => {
  if (toolti && !toolti.contains(e.target) && (!chatSidebar || !chatSidebar.contains(e.target)) && (!chatContainer || !chatContainer.contains(e.target))) {
    stopLiveAudio(() => {
      toolti.remove();
      toolti = null;
      if (floatingIcon) floatingIcon.style.display = 'block';
    });
  }
});
function createFloatingIcon() {
  chrome.storage.local.get(['isLoggedIn'], (result) => {


    // if (!result.isLoggedIn) {
    //   createLoginModal();
    //   return;
    // }
    if (floatingIcon) return;

    floatingIcon = document.createElement('img');
    floatingIcon.src = chrome.runtime.getURL('icons/Vidya4b.png');
    floatingIcon.className = 'floating-ic';
    floatingIcon.style.cssText = `
    position: fixed;
    width: 30px;
    height: 30px;
    cursor: pointer;
    z-index: 2147483647;
    user-select: none;
    transition: all 0.2s ease;
  `;
    document.body.appendChild(floatingIcon);

    // Load saved position and chat state
    chrome.storage.local.get(['iconPosition'], (result) => {
      const pos = {
        x: window.innerWidth - 35,
        y: window.innerHeight / 2,
        side: 'right' // Force right side
      };
      floatingIcon.style.left = `${pos.x}px`;
      floatingIcon.style.top = `${pos.y}px`;
      floatingIcon.dataset.side = 'right';
      chrome.storage.local.set({
        iconPosition: pos
      });

      // Restore chat if it was open
      if (result.chatState?.isChatOpen) {
        createChatContainer();
      }
    });

    let isDragging = false;
    let offsetX, offsetY;

    floatingIcon.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - floatingIcon.getBoundingClientRect().left;
      offsetY = e.clientY - floatingIcon.getBoundingClientRect().top;
      floatingIcon.style.cursor = 'grabbing';
      floatingIcon.style.transform = 'scale(1.1)';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      // Constrain to viewport
      x = Math.max(0, Math.min(x-35, window.innerWidth - floatingIcon.offsetWidth-35));
      y = Math.max(0, Math.min(y, window.innerHeight - floatingIcon.offsetHeight));

      floatingIcon.style.left = `${x}px`;
      floatingIcon.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      floatingIcon.style.cursor = 'pointer';
      floatingIcon.style.transform = 'scale(1)';

      // Determine side (left or right)
      const iconRect = floatingIcon.getBoundingClientRect();
      const iconCenter = iconRect.left + iconRect.width / 2;
      const isLeftSide = iconCenter < window.innerWidth / 2;

      // Snap to nearest edge with some margin
      const margin = 10;
      const newX = window.innerWidth - 35;


      floatingIcon.style.left = `${newX}px`;
      floatingIcon.dataset.side = 'right';

      // Save position
      chrome.storage.local.set({
        iconPosition: {
          x: newX,
          y: parseInt(floatingIcon.style.top),
          side: 'right'
        }
      });

      // Check if click (minimal movement)
      const movedDistance = Math.sqrt(
        Math.pow(e.clientX - (parseInt(floatingIcon.style.left) + offsetX), 2) +
        Math.pow(e.clientY - (parseInt(floatingIcon.style.top) + offsetY), 2)
      );

      if (movedDistance < 5) {
        toggleChatContainer();
      }
    });
  });
}
// Add logout functionality
function addLogoutButton() {
  if (!chatContainer) return;

  const headerActions = chatContainer.querySelector('.vidy-header-actions');
  if (!headerActions) return;

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'vidy-logout-btn';
  logoutBtn.title = 'Logout';
  logoutBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
    </svg>
  `;

  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['isLoggedIn', 'userEmail'], () => {
      if (chatContainer) chatContainer.remove();
      if (floatingIcon) floatingIcon.remove();
      createLoginModal();
    });
  });

  headerActions.appendChild(logoutBtn);
}

function toggleChatContainer() {
  if (chatContainer) {
    // Remove animation class before removing
    chatContainer.classList.remove('open');
    setTimeout(() => {
      chatContainer.remove();
      chatContainer = null;
      if (floatingIcon) floatingIcon.style.display = 'block';
      resetPageContent(); // Use fixed version
      pageContentScraper.isChatOpen = false;
      pageContentScraper.saveChatState();
      console.log('Chat container closed');
    }, 300); // Match animation duration
  } else {
    createChatContainer();
    pageContentScraper.isChatOpen = true;
    pageContentScraper.saveChatState();
    console.log('Chat container opened');
  }
}
chrome.storage.local.get(['iconPosition', 'chatState'], (result) => {
  const pos = result.iconPosition || {
    x: window.innerWidth - 70,
    y: window.innerHeight / 2,
    side: 'right'
  };
  floatingIcon.style.left = `${pos.x}px`;
  floatingIcon.style.top = `${pos.y}px`;
  floatingIcon.dataset.side = 'right'; // Always right
  floatingIcon.className = 'vidy-floating-ic'; // Ensure correct class
  chrome.storage.local.set({ iconPosition: pos });

  if (result.chatState?.isChatOpen) {
    createChatContainer();
  }
});
function shiftPageContent() {
  const body = document.body;
  const html = document.documentElement;
  const sidebarWidth = 400;

  // Clear any previous stored styles
  body.removeAttribute('data-original-style');

  // Store original body styles
  const computedStyle = window.getComputedStyle(body);
  body.dataset.originalStyle = JSON.stringify({
    marginLeft: body.style.marginLeft || computedStyle.marginLeft,
    marginRight: body.style.marginRight || computedStyle.marginRight,
    width: body.style.width || computedStyle.width,
    paddingLeft: body.style.paddingLeft || computedStyle.paddingLeft,
    paddingRight: body.style.paddingRight || computedStyle.paddingRight,
    overflowX: body.style.overflowX || computedStyle.overflowX
  });

  // Store original html styles
  const htmlComputedStyle = window.getComputedStyle(html);
  html.dataset.originalStyle = JSON.stringify({
    overflowX: html.style.overflowX || htmlComputedStyle.overflowX
  });

  // Shift body content
  body.style.marginRight = `${sidebarWidth}px`;
  body.style.width = `calc(100% - ${sidebarWidth}px)`;
  body.style.overflowX = 'hidden';
  html.style.overflowX = 'hidden';

  // Shift fixed/absolute elements
  // document.querySelectorAll('*').forEach(el => {
  //   if (el === chatContainer || el === floatingIcon) return;

  //   const style = window.getComputedStyle(el);
  //   if (style.position === 'fixed' || style.position === 'absolute') {
  //     // Store original right value if not already stored
  //     if (!el.dataset.originalStyle) {
  //       el.dataset.originalStyle = JSON.stringify({
  //         right: style.right,
  //         position: style.position
  //       });
  //     }

  //     // Apply shift
  //     const currentRight = parseFloat(style.right) || 0;
  //     el.style.right = `${currentRight + sidebarWidth}px`;
  //   }
  // });

  console.log('Page shifted: marginRight=', body.style.marginRight, 'width=', body.style.width);
}
function resetPageContent() {
  const body = document.body;
  const html = document.documentElement;

  // Reset body styles
  if (body.dataset.originalStyle) {
    const originalBodyStyle = JSON.parse(body.dataset.originalStyle);
    body.style.marginLeft = originalBodyStyle.marginLeft || '';
    body.style.marginRight = originalBodyStyle.marginRight || '';
    body.style.width = originalBodyStyle.width || '';
    body.style.paddingLeft = originalBodyStyle.paddingLeft || '';
    body.style.paddingRight = originalBodyStyle.paddingRight || '';
    body.style.overflowX = '';
    html.style.overflowX = '';
  }

  // Reset all elements
  document.querySelectorAll('*').forEach(el => {
    if (el.dataset.originalStyle) {
      const originalStyle = JSON.parse(el.dataset.originalStyle);
      el.style.marginLeft = originalStyle.marginLeft || '';
      el.style.marginRight = originalStyle.marginRight || '';
      el.style.position = originalStyle.position || '';
      el.style.left = originalStyle.left || '';
      el.style.right = originalStyle.right || '';
      el.style.width = originalStyle.width || '';
      delete el.dataset.originalStyle; // Clear stored styles
    }
  });

  console.log('Page reset: marginRight=', body.style.marginRight, 'width=', body.style.width);
}
function setupZIndexObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(() => {
      const chatContainer = document.querySelector('.vidy-chat-containe');
      const floatingIcon = document.querySelector('.floating-ic');
      const toolti = document.querySelector('.custom-toolti');

      if (chatContainer) {
        chatContainer.style.zIndex = '2147483647';
      }
      if (floatingIcon) {
        floatingIcon.style.zIndex = '2147483646';
      }
      if (toolti) {
        toolti.style.zIndex = '2147483645';
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Return observer for cleanup if needed
  return observer;
}

function handleSuboption(mode, type) {
  const input = chatContainer.querySelector('.chat-containe-input input');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');

  if (mode === 'writingng') {
    switch (type) {
      case 'letter':
        sendChatMessage(null, `Generate a formal letter based on: ${input.value}`);
        break;
      case 'email':
        sendChatMessage(null, `Generate a professional email based on: ${input.value}`);
        break;
      case 'essay':
        sendChatMessage(null, `Generate an essay based on: ${input.value}`);
        break;
    }
  } else if (mode === 'summarizerer') {
    const level = subMenu.querySelector('.sum-level').value;
    const paragraphs = subMenu.querySelector('.sum-paragraphs').value;
    sendChatMessage(null, `summarize this text to ${level} level in ${paragraphs} paragraph(s): ${input.value}`);
  }else if (mode === 'quiz') {
    const quizInput = chatContainer.querySelector('.quizz-options textarea').value;
    sendChatMessage(null, `Generate a quiz based on: ${quizInput}`);
  } else if (mode === 'translator') {
    const textInput = chatContainer.querySelector('.translatr-options textarea').value;
    const targetLanguage = chatContainer.querySelector('.trans-language').value;
    sendChatMessage(null, `Translate this text to ${targetLanguage}: ${textInput}`);
  }
}
function getModeTitle(mode) {
  return {
    'chat': 'Chat with AI',
    'writingng': 'Writing Assistant',
    'lessonon-plan': 'Lesson Plan Generator',
    'studydy-plan': 'Study Plan Generator',
    'summarizerer': 'Text summarizer',
    'support': 'Support Assistant',
    'settings': 'Settings',
    'clear-chat': 'Clear Chat',
    'more-option': 'More Learning Tools',
    'quiz': 'Quiz Generator',
    'translator': 'Text Translator'
  }[mode];
}
function createChatContainer() {
  if (chatContainer) {
    chatContainer.remove();
    chatContainer = null;
  }

  chatContainer = document.createElement('div');
  chatContainer.className = 'vidy-chat-containe';

  const iconRect = floatingIcon.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const isLeftSide = iconRect.left + iconRect.width / 2 < viewportWidth / 2;

  // Improved positioning with better spacing
  chatContainer.style.cssText = `
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  height: 80vh;  // Changed from 100vh to 80vh
  max-height: 800px;  // Added max-height
  background: #ffffff;
  border-radius: 20px 0 0 20px;
  box-shadow: -4px 0 20px rgba(0,0,0,0.15);
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border: 1px solid #e0e4e7;
  backdrop-filter: blur(10px);
  overflow: hidden;
`;

  chatContainer.innerHTML = `
    <div class="vidy-chat-mai">
      <div class="vidy-chat-heade">
        <div class="vidy-header-content">
          <div class="vidy-header-avatar">
            <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="vidy AI" />
          </div>
          <div class="vidy-header-info">
            <h3 id="header-title">vidy AI Assistant</h3>
            <span class="vidy-status">Online</span>
          </div>
          <div class="vidy-header-act">
          <button class="vidy-close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          </div>
        </div>
        <div class="vidy-header-actions" style="display:none !important;">
          <button class="vidy-home-b" title="Home" style="display: ${userProfile ? 'inline-flex' : 'none'};">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 19v-5h4v5c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-7h1.7c.46 0 .68-.57.33-.87L12.67 3.6c-.38-.34-.96-.34-1.34 0l-8.36 7.53c-.34.3-.13.87.33.87H5v7c0 .55.45 1 1 1h3c.55 0 1-.45 1-1z"/>
            </svg>
          </button>
          <button class="vidy-settings-b" title="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </button>
          <button class="vidy-close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="vidy-content-wrapper">
        <div class="vidy-mode-cont"></div>
        <div class="vidy-toolba">
        <button class="vidy-toolba-btn active" title="Support" data-mode="support">
       
     
        <div class="size-5"><svg width="20" height="20" viewBox="0 0 20 20"  xmlns="http://www.w3.org/2000/svg"><path d="M12.899 1.417H7.1c-.813 0-1.468 0-2 .043-.546.045-1.026.139-1.47.365a3.75 3.75 0 0 0-1.639 1.64c-.226.443-.32.924-.365 1.47-.044.531-.044 1.187-.044 2v10.167c0 .258 0 .5.018.697.02.205.064.475.236.722.221.319.563.532.946.592.297.046.56-.032.752-.105.186-.07.403-.177.634-.29l1.499-.73c.513-.25.708-.343.907-.409q.281-.092.574-.132c.208-.029.424-.03.995-.03h4.755c.813 0 1.468 0 2-.044.546-.044 1.026-.139 1.47-.365a3.75 3.75 0 0 0 1.639-1.639c.226-.444.32-.924.365-1.47.044-.532.044-1.187.044-2V6.935c0-.813 0-1.469-.044-2-.044-.546-.139-1.027-.365-1.47a3.75 3.75 0 0 0-1.639-1.64c-.444-.226-.924-.32-1.47-.365-.532-.043-1.187-.043-2-.043z" ></path><path fill-rule="evenodd" clip-rule="evenodd" d="M5.25 7.113a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75m0 4.667a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75" fill="#fff"></path></svg></div>
      </button>
          <button class="vidy-toolba-btn " title="Chat" data-mode="chat" style="display:none !important;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          <button class="vidy-toolba-btn" title="Writing" data-mode="writingng">
          <div class="size-5"><svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.824 17.925a1.42 1.42 0 0 1-.689-.689 1.44 1.44 0 0 1-.12-.627c0-.163.018-.356.037-.553l.734-7.94c.045-.488.083-.897.14-1.231.06-.35.15-.676.332-.98a2.75 2.75 0 0 1 1.184-1.08c.32-.152.652-.212 1.006-.24.338-.026.75-.026 1.24-.026h1.014a.8.8 0 0 0 .136.186l7.663 7.663v.965c0 .49 0 .901-.026 1.24-.028.353-.088.686-.24 1.005a2.75 2.75 0 0 1-1.08 1.185c-.304.18-.63.27-.98.33a17 17 0 0 1-1.231.141l-7.94.735c-.197.018-.39.036-.553.037-.177 0-.4-.016-.627-.121m13.234-7.081c.567-.315 1.035-.577 1.395-.82.387-.264.726-.555.948-.953a2.75 2.75 0 0 0 .276-1.97c-.104-.443-.35-.816-.65-1.176-.293-.35-.695-.751-1.183-1.24l-1.49-1.49c-.488-.487-.89-.89-1.24-1.182-.359-.3-.732-.546-1.176-.65a2.75 2.75 0 0 0-1.969.276c-.398.222-.69.56-.952.948-.244.36-.506.828-.821 1.395z" ></path><path fill-rule="evenodd" clip-rule="evenodd" d="M6.275 13.802a.75.75 0 0 1 .002 1.06l-2.883 2.893a.75.75 0 0 1-1.062-1.06l2.882-2.891a.75.75 0 0 1 1.06-.002z" fill="#fff"></path></svg></div>
          </button>
          <button class="vidy-toolba-btn" title="Lesson Plan" data-mode="lessonon-plan">
          <div class="size-5">
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 60 60"><path fill-rule="evenodd" d="M44.547.97a.5.5 0 0 1 .906 0l1.324 2.837a5 5 0 0 0 2.416 2.416l2.836 1.324a.5.5 0 0 1 0 .906l-2.836 1.324a5 5 0 0 0-2.416 2.416l-1.324 2.836a.5.5 0 0 1-.906 0l-1.324-2.836a5 5 0 0 0-2.416-2.416l-2.836-1.324a.5.5 0 0 1 0-.906l2.836-1.324a5 5 0 0 0 2.416-2.416L44.547.971Zm-32.682 9.26c-.726.049-1.087.138-1.328.238a3.82 3.82 0 0 0-2.07 2.07c-.1.241-.189.601-.238 1.327-.051.746-.052 1.707-.052 3.135s.001 2.39.052 3.135c.05.726.139 1.086.239 1.328a3.82 3.82 0 0 0 2.069 2.069c.241.1.602.189 1.328.239.745.05 1.707.052 3.134.052h35.722c-.853-1.683-1.378-3.633-1.521-5.67a2.177 2.177 0 1 1 4.344-.305c.203 2.9 1.407 5.127 2.794 6.207a2.178 2.178 0 0 1 .045 3.4 3.2 3.2 0 0 1-.575.376 3.2 3.2 0 0 1-1.208.326c-.258.02-.55.02-.786.02H14.926c-1.335 0-2.446 0-3.358-.062-.947-.064-1.837-.203-2.698-.56a8.18 8.18 0 0 1-4.426-4.426c-.356-.86-.495-1.75-.56-2.698-.062-.911-.062-2.022-.062-3.357v-.148c0-1.335 0-2.446.062-3.357.065-.948.204-1.838.56-2.698A8.18 8.18 0 0 1 8.87 6.445c.86-.357 1.75-.496 2.698-.56.912-.062 2.023-.062 3.358-.062h16.457a2.177 2.177 0 1 1 0 4.354H14.999c-1.427 0-2.389.002-3.134.053m41.901 22.592h.048c.237 0 .528 0 .786.021a3.2 3.2 0 0 1 1.209.326q.309.157.574.376a2.177 2.177 0 0 1-.045 3.4c-1.528 1.19-2.823 3.769-2.823 7.055s1.295 5.865 2.823 7.054a2.177 2.177 0 0 1 .045 3.401 3.2 3.2 0 0 1-.574.376c-.465.237-.907.3-1.209.325-.258.022-.55.022-.786.021H14.926c-1.335 0-2.446 0-3.357-.062-.948-.064-1.838-.204-2.699-.56a8.18 8.18 0 0 1-4.425-4.426c-.357-.86-.496-1.75-.56-2.698-.063-.911-.063-2.022-.063-3.357v-.148c0-1.335 0-2.446.062-3.357.065-.948.204-1.838.56-2.698a8.18 8.18 0 0 1 4.426-4.426c.861-.357 1.751-.496 2.699-.56.91-.063 2.022-.063 3.357-.063zM49.16 44c0-2.461.552-4.832 1.56-6.823H15c-1.428 0-2.39.002-3.135.052-.726.05-1.086.14-1.328.24a3.82 3.82 0 0 0-2.069 2.068c-.1.242-.19.602-.239 1.328-.05.746-.052 1.707-.052 3.135s.001 2.39.052 3.135c.05.726.139 1.086.24 1.328a3.82 3.82 0 0 0 2.068 2.069c.242.1.602.189 1.328.239.745.05 1.707.051 3.135.051h35.72c-1.008-1.99-1.56-4.36-1.56-6.822" clip-rule="evenodd"></path></svg>
</div>

        
        
          </button>
          <button class="vidy-toolba-btn" title="Study Plan" data-mode="studydy-plan">
          <div class="size-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V8h14v12z"/>
            </svg>
            </div>
          </button>
          <button class="vidy-toolba-btn" title="Summarizer" data-mode="summarizerer">
          <div class="size-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
            </svg>
            </div>
          </button>

          <button class="vidy-toolba-btn" data-mode="quiz" title="Quiz Generator">
          <div class="size-5">
          <svg fill="#000000" width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.8594854,20.7417567 C15.3870177,21.5619833 13.7245582,22 12,22 C6.4771525,22 2,17.5228475 2,12 C2,6.4771525 6.4771525,2 12,2 C17.5228475,2 22,6.4771525 22,12 C22,13.7245582 21.5619833,15.3870177 20.7417567,16.8594854 L21.0946904,21.0946904 L16.8594854,20.7417567 Z M16.3916038,18.6958341 L18.9053096,18.9053096 L18.6958341,16.3916038 L18.8621131,16.1149882 C19.6030308,14.8824253 20,13.4715357 20,12 C20,7.581722 16.418278,4 12,4 C7.581722,4 4,7.581722 4,12 C4,16.418278 7.581722,20 12,20 C13.4715357,20 14.8824253,19.6030308 16.1149882,18.8621131 L16.3916038,18.6958341 Z M12.0003283,16.9983464 C11.4478622,16.9983464 11,16.5506311 11,15.9983464 C11,15.4460616 11.4478622,14.9983464 12.0003283,14.9983464 C12.5527943,14.9983464 13.0006565,15.4460616 13.0006565,15.9983464 C13.0006565,16.5506311 12.5527943,16.9983464 12.0003283,16.9983464 Z M13,14 L11,14 L11,13 C11,12.2626932 11.3827392,11.7004784 11.9774877,11.2286498 C12.1564111,11.0867055 12.2101653,11.0510845 12.5339634,10.8458119 C12.8225361,10.6628706 13,10.3473166 13,10 C13,9.44771525 12.5522847,9 12,9 C11.4477153,9 11,9.44771525 11,10 L9,10 C9,8.34314575 10.3431458,7 12,7 C13.6568542,7 15,8.34314575 15,10 C15,11.0395627 14.4660508,11.988994 13.6048137,12.5349773 C13.3517279,12.6954217 13.3206582,12.7160104 13.2204897,12.7954765 C13.0562911,12.9257393 13,13.0084267 13,13 L13,14 Z"/>
</svg>
         </div>
        </button>
        
        <button class="vidy-toolba-btn" data-mode="translator" title="Text Translator">
        <div class="size-5">
        <svg width="800px" height="800px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <title>translate</title>
        <g id="Layer_2" data-name="Layer 2">
          <g id="invisible_box" data-name="invisible box">
            <rect width="48" height="48" fill="none"/>
          </g>
          <g id="icons_Q2" data-name="icons Q2">
            <path d="M43.8,41.2,33.9,16.3A2.1,2.1,0,0,0,32,15H30a2.1,2.1,0,0,0-1.9,1.3L23.3,28.4a24,24,0,0,1-5.6-4.3c3.4-4,5.9-8.8,6.2-13.1h2A2.1,2.1,0,0,0,28,9.3,2,2,0,0,0,26,7H17.5V4.1A2.1,2.1,0,0,0,15.8,2a2,2,0,0,0-2.3,2V7H6.1A2.1,2.1,0,0,0,4,8.7,2,2,0,0,0,6,11H19.9c-.3,3-2.3,6.7-4.9,10.1a34.1,34.1,0,0,1-3.2-4.9A2.1,2.1,0,0,0,9.6,15a2,2,0,0,0-1.4,2.9,39.1,39.1,0,0,0,4.1,6.2,24,24,0,0,1-7,5A2.2,2.2,0,0,0,4,31.4,2,2,0,0,0,6,33l.8-.2A26.4,26.4,0,0,0,15,27a28.1,28.1,0,0,0,6.8,5.1l-3.6,9.1A2,2,0,0,0,20,44a2.2,2.2,0,0,0,1.9-1.3L25.8,33H36.2l3.9,9.7A2.2,2.2,0,0,0,42,44a2,2,0,0,0,1.8-2.8ZM27.4,29,31,19.9,34.6,29Z"/>
          </g>
        </g>
      </svg>
</div>

      </button>
      

          <button class="vidy-toolba-btn" title="More options" data-mode="more-option" style="display:none;">
          <div class="size-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.025 1.25h-2.05c-.445 0-.816 0-1.12.02a2.8 2.8 0 0 0-.907.19 2.75 2.75 0 0 0-1.489 1.488c-.12.29-.167.59-.188.907a9 9 0 0 0-.017.402q-.45.008-.819.036c-.546.045-1.027.14-1.47.366a3.75 3.75 0 0 0-1.64 1.639c-.226.444-.32.924-.365 1.47-.043.531-.043 1.187-.043 2v2.464c0 .813 0 1.469.043 2 .045.546.14 1.026.365 1.47a3.75 3.75 0 0 0 1.64 1.64c.443.226.924.32 1.47.365.531.043 1.187.043 2 .043h7.13c.813 0 1.469 0 2-.043.546-.045 1.027-.14 1.47-.366a3.75 3.75 0 0 0 1.64-1.639c.226-.444.32-.924.365-1.47.043-.531.043-1.187.043-2V9.768c0-.813 0-1.469-.043-2-.045-.546-.14-1.026-.365-1.47a3.75 3.75 0 0 0-1.64-1.64c-.443-.226-.924-.32-1.47-.365q-.368-.029-.82-.036a9 9 0 0 0-.016-.402 2.8 2.8 0 0 0-.188-.907 2.75 2.75 0 0 0-1.489-1.489c-.29-.12-.59-.167-.907-.188-.304-.021-.675-.021-1.12-.021m2.22 3a7 7 0 0 0-.012-.293c-.017-.241-.046-.358-.078-.435a1.25 1.25 0 0 0-.677-.677c-.077-.032-.194-.061-.435-.078A17 17 0 0 0 11 2.75H9c-.476 0-.796 0-1.043.017-.241.017-.358.046-.435.078a1.25 1.25 0 0 0-.677.677c-.032.077-.061.194-.078.435q-.009.13-.012.293z"/>
            <path fill="#fff" fill-rule="evenodd" d="M7.009 10.75H.916v-1.5H7.01a3.085 3.085 0 0 1 5.982 0h6.091v1.5h-6.09a3.085 3.085 0 0 1-5.983 0ZM8.417 10a1.583 1.583 0 1 1 3.166 0 1.583 1.583 0 0 1-3.166 0" clip-rule="evenodd"></path>
         </div>
            </svg>
        </button>
        <button class="vidy-toolba-btn" title="Preferences" data-mode="settings">
        <div class="size-5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13-.56-1.62.94l-2.39-.96c-.22-.07-.47 0-.59.22L2.8 8.29c-.11.2-.06.47.12.61l2.03 1.58c-.04.3-.06.64-.06.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32c.11-.2.06-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    </div>
                </button>
                <button class="vidy-toolba-btn" title="Clear Chat" data-mode="clear-chat">
                <div class="size-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3V4H4V6H5V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V6H20V4H15V3H9ZM7 6H17V20H7V6ZM9 8V18H11V8H9ZM13 8V18H15V8H13Z"/>
              </svg>
              
              
    </div>
</button>
        </div>
      </div>
      
      <div class="vidy-settings-panel" style="display: none;"></div>
      <div class="vidy-profile-vie" style="display: none;"></div>
      <div class="vidy-voice-container" style="display: none;"></div>
    </div>
  `;

  document.body.appendChild(chatContainer);
  shiftPageContent(); // Call without isLeftSide
  floatingIcon.style.display = 'none';
  const modeContent = chatContainer.querySelector('.vidy-mode-cont');
  const headerTitle = chatContainer.querySelector('#header-title');
  switchMode('support', modeContent, headerTitle);
  addLogoutButton();


  setupChatContainerListeners();
  const toolba = chatContainer.querySelector('.vidy-toolba');
  if (toolba) {
    const lessononPlanBtn = toolba.querySelector('[data-mode="lessonon-plan"]');
    const studydyPlanBtn = toolba.querySelector('[data-mode="studydy-plan"]');

    // Set initial visibility based on role
    if (userProfile?.role === 'teacher') {
      if (lessononPlanBtn) lessononPlanBtn.style.display = 'flex ';
      if (studydyPlanBtn) studydyPlanBtn.style.display = 'none ';
    } else if (userProfile?.role === 'student') {
      if (lessononPlanBtn) lessononPlanBtn.style.display = 'none ';
      if (studydyPlanBtn) studydyPlanBtn.style.display = 'flex ';
    }
  }
  console.log('Chat container created: classes=', chatContainer.className, 'style=', chatContainer.style.cssText);
}

function setupChatContainerListeners() {
  const closeBtn = chatContainer.querySelector('.vidy-close-btn');
  const settingsBtn = chatContainer.querySelector('.vidy-settings-b');
  const homeBtn = chatContainer.querySelector('.vidy-home-b');
  const toolbaBtns = chatContainer.querySelectorAll('.vidy-toolba-btn');
  const modeContent = chatContainer.querySelector('.vidy-mode-cont');
  const headerTitle = chatContainer.querySelector('#header-title');

  closeBtn.addEventListener('click', toggleChatContainer);
  settingsBtn.addEventListener('click', () => {
    if (userProfile) showProfileView();
    else toggleSettingsPanel();
  });
  homeBtn.addEventListener('click', returnToChatMode);

  let activeMode = 'support';
  toolbaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      toolbaBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.getAttribute('data-mode');
      switchMode(activeMode, modeContent, headerTitle);
    });
  });
}

function switchMode(mode, contentDiv, headerTitle) {
  if (mode === 'support' && userProfile?.supportNeeded === false) {
    contentDiv.innerHTML = '<p class="erro">Support mode is disabled. Enable it in Settings.</p>';
    headerTitle.textContent = getModeTitle(mode);
    return;
  }
  if (mode === 'clear-chat') {
    contentDiv.innerHTML = `
      <div class="clear-chat-confirm" style="padding: 15px; text-align: center;">
        <p style="margin-bottom: 20px;">Are you sure you want to clear all chat and support conversations?</p>
        <button class="confirm-clear-btn" style="background: #f44336; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Confirm</button>
        <button class="cancel-clear-btn" style="background: #e0e0e0; color: #54656f; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
      </div>
    `;
    headerTitle.textContent = 'Clear Chat';
    const confirmBtn = contentDiv.querySelector('.confirm-clear-btn');
    const cancelBtn = contentDiv.querySelector('.cancel-clear-btn');
    confirmBtn.addEventListener('click', async () => {
      pageContentScraper.chatMessages = [];
      pageContentScraper.supportMessages = [];
      await pageContentScraper.saveChatState();
      contentDiv.innerHTML = '<p style="padding: 15px; text-align: center;">Conversations cleared successfully!</p>';
      setTimeout(() => {
        const chatBtn = chatContainer.querySelector('.vidy-toolba-btn[data-mode="support"]');
        chatBtn.click();
      }, 1500);
    });
    cancelBtn.addEventListener('click', () => {
      const chatBtn = chatContainer.querySelector('.vidy-toolba-btn[data-mode="support"]');
      chatBtn.click();
    });
    return;
  }
  const toolba = chatContainer.querySelector('.vidy-toolba');
  if (toolba) {
    const lessononPlanBtn = toolba.querySelector('[data-mode="lessonon-plan"]');
    const studydyPlanBtn = toolba.querySelector('[data-mode="studydy-plan"]');

    if (userProfile?.role === 'teacher') {
      if (lessononPlanBtn) lessononPlanBtn.style.display = 'flex ';
      if (studydyPlanBtn) studydyPlanBtn.style.display = 'none ';
    } else if (userProfile?.role === 'student') {
      if (lessononPlanBtn) lessononPlanBtn.style.display = 'none ';
      if (studydyPlanBtn) studydyPlanBtn.style.display = 'flex ';
    } else {
      // Default case - show both if role isn't set
      if (lessononPlanBtn) lessononPlanBtn.style.display = 'flex';
      if (studydyPlanBtn) studydyPlanBtn.style.display = 'flex';
    }
  }
  contentDiv.innerHTML = '';
  headerTitle.textContent = getModeTitle(mode);

  switch (mode) {
    case 'translator':
      // Get languages for dropds
      const languages = Object.values(languageMap);

      contentDiv.innerHTML = `
        <div class="translatr-formrm">
          <div class="language-selectionon">
            <select id="source-lang">
              <option value="auto">Detect Language</option>
              ${languages.map(lang => `<option value="${lang}">${lang}</option>`).join('')}
            </select>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#666">
              <path d="M8 7l4-4 4 4m0 10l-4 4-4-4"/>
            </svg>
            <select id="target-lang" style="margin-right:50px;">
              ${languages.map(lang => `<option value="${lang}" ${lang === 'English' ? 'selected' : ''}>${lang}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-grou">
            <label for="source-text">Text to Translate</label>
            <textarea id="source-text" placeholder="Enter text here..."></textarea>
          </div>
          
          <button class="translte-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="margin-right: 8px;">
              <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
            Translate
          </button>
          
          <div class="translationon-result"></div>
        </div>
      `;
      document.querySelector('.translte-btn').addEventListener('click', translateText);
      break;

 
      case 'quiz':
        contentDiv.innerHTML = `
          <div class="quizz-formrm">
          <div  class="quizz-formrm-inner">
            <div class="form-row">
              <div class="form-grou">
                <label for="class-select">Class/Grade</label>
                <select id="class-select">
                  <option value="6">6th Grade</option>
                  <option value="7">7th Grade</option>
                  <option value="8">8th Grade</option>
                  <option value="9">9th Grade</option>
                  <option value="10">10th Grade</option>
                  <option value="11">11th Grade</option>
                  <option value="12">12th Grade</option>
                  <option value="university">University</option>
                </select>
              </div>
              
              <div class="form-grou">
                <label for="quizz-subject">Subject/Topic</label>
                <input type="text" id="quizz-subject" placeholder="e.g., Mathematics, History">
              </div>
            </div>
            
            <div class="form-grou">
              <label>Question Types</label>
              <div class="questin-ty-grid">
                <!-- Multiple Choice -->
                <div class="questin-tye-card active" data-type="mcq">
                    <div class="tye-headerer">
                        <div class="tye-left">
                            <div class="tye-icon">📝</div>
                            <div class="tye-title">Multiple Choice</div>
                        </div>
                        <div class="quantty-control">
                            <div class="quantty-input-wrapper">
                                <button class="quantty-btn"  data-type="mcq" data-action="decrease">−</button>
                                <span class="quantty-display" id="mcq-qty">5</span>
                                <button class="quantty-btn"   data-type="mcq" data-action="increase">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- True/False -->
                <div class="questin-tye-card active" data-type="tf">
                    <div class="tye-headerer">
                        <div class="tye-left">
                            <div class="tye-icon">✓</div>
                            <div class="tye-title">True / False</div>
                        </div>
                        <div class="quantty-control">
                            <div class="quantty-input-wrapper">
                                <button class="quantty-btn" data-type="tf" data-action="decrease">−</button>
                                <span class="quantty-display" id="tf-qty">3</span>
                                <button class="quantty-btn"  data-type="tf" data-action="increase">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Short Answer -->
                <div class="questin-tye-card active" data-type="short">
                    <div class="tye-headerer">
                        <div class="tye-left">
                            <div class="tye-icon">💭</div>
                            <div class="tye-title">Short Answer</div>
                        </div>
                        <div class="quantty-control">
                            <div class="quantty-input-wrapper">
                                <button class="quantty-btn"  data-type="short" data-action="decrease">−</button>
                                <span class="quantty-display" id="short-qty">2</span>
                                <button class="quantty-btn"  data-type="short" data-action="increase">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Essay -->
                <div class="questin-tye-card active" data-type="essay">
                    <div class="tye-headerer">
                        <div class="tye-left">
                            <div class="tye-icon">📄</div>
                            <div class="tye-title">Essay</div>
                        </div>
                        <div class="quantty-control">
                            <div class="quantty-input-wrapper">
                                <button class="quantty-btn quantty-btn1" data-type="essay" data-action="decrease">−</button>
                                <span class="quantty-display" id="essay-qty">1</span>
                                <button class="quantty-btn quantty-btn2" data-type="essay" data-action="increase">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            
            <div class="form-grou">
              <label for="quizz-details">Additional Instructions</label>
              <textarea id="quizz-details" placeholder="Specific topics, difficulty level, time limit, etc."></textarea>
            </div>
            
            <button class="generate-btntn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="margin-right: 8px;">
                <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
              Generate Quiz
            </button>
            </div>
            <div class="quizz-previ"></div>
          </div>
        `;

    
            contentDiv.addEventListener('click', (e) => {
          if (e.target.classList.contains('quantty-btn')) {
            const type = e.target.dataset.type;
            const action = e.target.dataset.action;
            const delta = action === 'increase' ? 1 : -1;
            changeQuantity(type, delta);
          }
        });

        document.querySelector('.generate-btntn').addEventListener('click', generateQuiz);
       
        break;
    
    case 'support':    
      contentDiv.innerHTML = `
        <div class="chat-containe-messages" style="
          flex-grow: 1;
          padding: 10px;
          overflow-y: auto;
          max-height: calc(100vh - 150px);
          ${pageContentScraper.supportMessages.length === 0 ? 'display: flex; flex-direction: column; justify-content: center; align-items: center;' : 'display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch;'}
        ">
          ${pageContentScraper.supportMessages.length === 0 ? `
            <div class="vidy-intro-message" style="
              text-align: center;
              color: #54656f;
              font-size: 16px;
              font-weight: 500;
              padding: 20px;
              max-width: 80%;
            ">
            <h3>Hi,</h3>
              <p style="margin: 0 0 10px; font-size: 16px; "><strong> How can I assist you?</strong></p>
              <p style="margin: 0; font-size: 16px; color: #666;">I'm vidy, your AI assistant. Ask me anything or select text on the page to get started!</p>
            </div>
          ` : ''}
        </div>
        <div class="chat-containe-wrapper">
          <div class="chat-containe-input" style="flex-shrink: 0; padding: 10px;">
            <div style="display: flex; align-items: center; gap: 5px; width:100% !important;">
              <div style="position: relative; flex-grow: 1;">
             
                <textarea id="support-inp" placeholder="Ask Anything @Support /prompt..." style="
                  width: 100%;
                  border: 1px solid #ddd;
                  border-radius: 20px;
                  outline: none;
                  resize: vertical;
                  min-height: 32px;
                  max-height: 200px;
                  box-sizing: border-box;
                  font-family: inherit;
                  font-size: 14px;
                  padding-top: 16px;
                  line-height: 1.4;
                  padding-left: 10px;
                "></textarea>
                <button id="voice-inpu-btn" style="
                position: absolute;
                left: 85%;
                top: 40%;
                transform: translateY(-50%);
                background: none;
                border: none;
                cursor: pointer;
                padding: 0;
              ">
                <img src="${chrome.runtime.getURL('icons/mic.png')}" alt="Voice Input" style="width: 18px; height: 18px;">
              </button>
              <button id="send-chat" style=" position: absolute;
              left: 85%;
              top: 40%;
              transform: translateY(-50%);
              background: none;
              border: none;
              cursor: pointer;
              padding: 0;
              display:none; ">
                <img src="${chrome.runtime.getURL('icons/send.png')}" alt="Send" style="width: 24px; height: 24px;">
              </button>
              </div>
              
            </div>
            <div id="voice-statu" style="display: none;"></div>
          </div>
          <div class="error-section hidden" style="padding: 10px; color: #f44336; display: none;"></div>
        </div>
      `;
      const voiceInputBtn = contentDiv.querySelector('#voice-inpu-btn');
      const voiceStatus = contentDiv.querySelector('#voice-statu');
      const supportMessagesDiv = contentDiv.querySelector('.chat-containe-messages');
      const supportInput = contentDiv.querySelector('#support-inp');
      const supportSendBtn = contentDiv.querySelector('#send-chat');
      const errorSection = contentDiv.querySelector('.error-section');
    
      const toggleVoiceInput = () => {
        if (isVoiceInputActive) {
          stopVoiceRecognition();
          isVoiceInputActive = false;
          // voiceInputBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/mic.png')}" alt="Voice Input" style="width: 24px; height: 24px;">`;
          voiceInputBtn.style.display = 'none';
          supportSendBtn.style.display = 'block';
          voiceStatus.style.display = 'none';
        } else {
          startVoiceRecognition(supportInput, voiceStatus);
          voiceInputBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/record.png')}" alt="Listening..." style="width: 24px; height: 24px;">`;
          voiceStatus.textContent = 'Listening...';
          voiceStatus.style.display = 'none';
          isVoiceInputActive = true;
        }
      };
    
      voiceInputBtn.addEventListener('click', toggleVoiceInput);
      pageContentScraper.loadChatState().then(() => {
        console.log('Restoring support messages, count:', pageContentScraper.supportMessages.length);
        if (pageContentScraper.supportMessages.length) {
          supportMessagesDiv.innerHTML = ''; // Clear intro message if messages exist
          supportMessagesDiv.style.display = 'flex';
          supportMessagesDiv.style.flexDirection = 'column';
          supportMessagesDiv.style.justifyContent = 'flex-start';
          supportMessagesDiv.style.alignItems = 'stretch';
          pageContentScraper.supportMessages.forEach(({ sender, message }, index) => {
            const questions = (index === pageContentScraper.supportMessages.length - 1 && sender === 'assistant')
              ? pageContentScraper.lastSupportRecommendedQuestions
              : [];
            console.log(`Restoring message ${index + 1}:`, { sender, message, questions });
            addMessageToChat(sender, message, supportMessagesDiv, questions);
          });
        } else {
          console.log('No support messages to restore, keeping intro message');
        }
      }).catch(error => {
        console.error('Failed to load chat state:', error);
        errorSection.textContent = 'Failed to load previous messages.';
        errorSection.classList.remove('hidden');
      });
      supportInput.addEventListener('input', () => {
        if (supportInput.value.trim() !== '') {
          voiceInputBtn.style.display = 'none';
          supportSendBtn.style.display = 'block';
        } else {
          voiceInputBtn.style.display = 'inline-block'; // or whatever it was originally
          supportSendBtn.style.display = 'none';
        }
      });
      supportSendBtn.addEventListener('click', async () => {
        if (isVoiceInputActive) {
          stopVoiceRecognition();
          isVoiceInputActive = false;
          voiceInputBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/mic.png')}" alt="Voice Input" style="width: 24px; height: 24px;">`;
          voiceStatus.style.display = 'none';
        }
        const question = supportInput.value.trim();
        if (!question) {
          errorSection.textContent = 'Please enter a question';
          errorSection.classList.remove('hidden');
          return;
        }
        errorSection.classList.add('hidden');
        supportInput.value = '';
   

        // Reset styles to non-centered layout before adding new message
        supportMessagesDiv.style.display = 'flex';
        supportMessagesDiv.style.flexDirection = 'column';
        supportMessagesDiv.style.justifyContent = 'flex-start';
        supportMessagesDiv.style.alignItems = 'stretch';
        const introMessage = supportMessagesDiv.querySelector('.vidy-intro-message');
        if (introMessage) introMessage.remove();
        await sendSupportMessage(question, supportMessagesDiv);
      });
    
      supportInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          const question = supportInput.value.trim();
          if (!question) {
            errorSection.textContent = 'Please enter a question';
            errorSection.classList.remove('hidden');
            return;
          }
          errorSection.classList.add('hidden');
          
          supportInput.value = '';

          // Reset styles to non-centered layout before adding new message
          supportMessagesDiv.style.display = 'flex';
          supportMessagesDiv.style.flexDirection = 'column';
          supportMessagesDiv.style.justifyContent = 'flex-start';
          supportMessagesDiv.style.alignItems = 'stretch';
          const introMessage = supportMessagesDiv.querySelector('.vidy-intro-message');
          if (introMessage) introMessage.remove();
          

          await sendSupportMessage(question, supportMessagesDiv);
        }
      });
    
      voiceInputBtn.addEventListener('click', toggleVoiceInput);
      break;
  case 'chat':
      contentDiv.innerHTML = `
        <div class="chat-containe-messages" style="flex-grow: 1; padding: 10px; overflow-y: auto; max-height: calc(100vh - 150px);"></div>
        <div class="chat-containe-input" style="flex-shrink: 0; border-top: 1px solid #e0e0e0;">
          <input type="text" placeholder="Type your message..." style="width: calc(100% - 80px);">
          <button class="send-chat"><img src="${chrome.runtime.getURL('icons/send.png')}" alt="Send" style="width: 24px; height: 24px;"></button>
          <button class="voice-chat-btn" title="Use Voice" style="display:none;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#075e54"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6.1 6c0 2.61-1.91 4.77-4.4 5.18v2.02h2.5v2h-5v-2h2.5v-2.02c-2.49-.41-4.4-2.57-4.4-5.18 0-.55.45-1 1-1s1 .45 1 1c0 1.66 1.34 3 3 3s3-1.34 3-3c0-.55.45-1 1-1s1 .45 1 1z"/></svg>
          </button>
        </div>
      `;
      const messagesDiv = contentDiv.querySelector('.chat-containe-messages');
      const input = contentDiv.querySelector('input');
      const sendBtn = contentDiv.querySelector('.send-chat');
      const voiceBtn = contentDiv.querySelector('.voice-chat-btn');

      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        input.value = selectedText;
        sendChatMessage(null, selectedText, messagesDiv);
      }

      sendBtn.addEventListener('click', () => sendChatMessage(null, input.value, messagesDiv));
      input.addEventListener('keypress', (e) => e.key === 'Enter' && sendChatMessage(null, input.value, messagesDiv));
      voiceBtn.addEventListener('click', startVoiceChatMode);

      pageContentScraper.loadChatState().then(() => {
        if (pageContentScraper.chatMessages.length) {
          pageContentScraper.chatMessages.forEach(({ sender, message }) => {
            addMessageToChat(sender, message, messagesDiv);
          });
        }
      }).catch(error => {
        console.error('Failed to load chat state:', error);
        messagesDiv.innerHTML += '<p class="erro">Failed to load previous messages.</p>';
      });
      break;

    case 'writingng':
      contentDiv.innerHTML = `
        <div class="writingng-formrm" style="padding: 15px;">
          <h3>Writing Assistant</h3>
          <select class="writingng-type">
            <option value="letter">Letter</option>
            <option value="email">Email</option>
            <option value="essay">Essay</option>
          </select>
          <input type="text" class="writingng-topic" placeholder="Enter topic or prompt...">
          <input type="text" class="writingng-recipient" placeholder="Recipient (optional)">
          <button class="generate-btntn">Generate</button>
        </div>
        <div class='writingng-preview response-ccontainer' style='flex-grow: 1; padding: 10px; background: #f9f9f9;'></div>
      `;
      const writingngTopic = contentDiv.querySelector('.writingng-topic');
      if (window.getSelection().toString().trim()) writingngTopic.value = window.getSelection().toString().trim();
      contentDiv.querySelector('.generate-btntn').addEventListener('click', () => generatewritingng(contentDiv));
      break;

    case 'lessonon-plan':
      chrome.storage.local.get(['settings'], (result) => {
        const savedSettings = result.settings || { class: '' };
        contentDiv.innerHTML = `
          <div class="lessonon-formrm" style="padding: 15px;">
            <h3>Lesson Plan Generator</h3>
            <input type="text" id="subject" placeholder="Enter subject (e.g., Math)">
            <input type="text" id="class" placeholder="Enter your class" value="${savedSettings.class || ''}">
            <input type="text" id="duration" placeholder="Enter duration (e.g., 1 hour)">
            <input type="text" id="additional-info" placeholder="Enter any additional info(optional)">
            <button class="generate-btntn">Generate lessonon Plan</button>
          </div>
          <div class="lessonon-preview"></div>
        `;
        const generateBtn = contentDiv.querySelector('.generate-btntn');
        const previewDiv = contentDiv.querySelector('.lessonon-preview');

        generateBtn.addEventListener('click', async () => {
          const subject = contentDiv.querySelector('#subject').value.trim();
          const classLevel = contentDiv.querySelector('#class').value.trim();
          const duration = contentDiv.querySelector('#duration').value.trim();
          const additionalInfo = contentDiv.querySelector('#additional-info').value.trim();

          if (!subject || !classLevel || !duration) {
            previewDiv.innerHTML = '<p class="erro">Please fill in all required fields.</p>';
            return;
          }

          previewDiv.innerHTML = '<p class="loadi">Generating lessonon plan...</p>';

          try {
            const prompt = `
              Create a detailed lessonon plan for:
              - Subject: ${subject}
              - Class: ${classLevel}
              - Duration: ${duration}
              - Additional Information: ${additionalInfo || 'None'}
              
              Format the response with plain text:
              - Use "Heading:" for section headers (e.g., "lessonon Objectives:", "Activities:")
              - Do NOT use Markdown symbols like **, #, or |.
              - Use bullet points (-) for objectives and activities
              - For the timeline, use a plain text table format:
                  Time       Activity           Materials
                  0-10 min   Quiz               Quiz Sheets
              - Preserve new lines for readability
              - Use clear, concise language
            `;
            const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            const data = await response.json();
            let formattedResponse = data.response
              .replace(/(\w+\s*\w*:\s*)/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br>');
            previewDiv.innerHTML = `<div class="response-ccontent">${formattedResponse}</div>`;
          } catch (error) {
            previewDiv.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
          }
        });
      });
      break;

    case 'studydy-plan':
      chrome.storage.local.get(['settings'], (result) => {
        const savedSettings = result.settings || { class: '' };
        contentDiv.innerHTML = `
          <div class="studydy-formrm" style="padding: 15px;">
            <h3>Study Plan Generator</h3>
            <input type="text" id="subject" placeholder="Enter subject (e.g., Math)">
            <input type="text" id="class" placeholder="Enter your class" value="${savedSettings.class || ''}">
            <input type="text" id="duration" placeholder="Enter duration (e.g., 2 weeks)">
            <input type="text" id="additional-info" placeholder="Enter any additional info(optional)">
            <button class="generate-btntn">Generate Study Plan</button>
          </div>
          <div class="studydy-preview"></div>
        `;
        const generateBtn = contentDiv.querySelector('.generate-btntn');
        const previewDiv = contentDiv.querySelector('.studydy-preview');

        generateBtn.addEventListener('click', async () => {
          const subject = contentDiv.querySelector('#subject').value.trim();
          const classLevel = contentDiv.querySelector('#class').value.trim();
          const duration = contentDiv.querySelector('#duration').value.trim();
          const additionalInfo = contentDiv.querySelector('#additional-info').value.trim();

          if (!subject || !classLevel || !duration) {
            previewDiv.innerHTML = '<p class="erro">Please fill in all required fields.</p>';
            return;
          }

          previewDiv.innerHTML = '<p class="loadi">Generating studydy plan...</p>';

          try {
            const prompt = `
              Create a detailed studydy plan for:
              - Subject: ${subject}
              - Class: ${classLevel}
              - Duration: ${duration}
              - Additional Information: ${additionalInfo || 'None'}
              
              Format the response with plain text:
              - Use "Heading:" for section headers (e.g., "studydy Plan:", "Schedule:")
              - Do NOT use Markdown symbols like **, #, or |.
              - Use bullet points (-) for tasks
              - For the schedule, use a plain text table format:
                  Day       Topic              Resources         Time
                  Monday    Algebra Basics     Textbook Ch. 1    1 hour
              - Preserve new lines for readability
              - Use clear, concise language
            `;
            const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }
            const data = await response.json();
            let formattedResponse = data.response
              .replace(/(\w+\s*\w*:\s*)/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br>');
            previewDiv.innerHTML = `<div class="response-ccontent">${formattedResponse}</div>`;
          } catch (error) {
            previewDiv.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
          }
        });
      });
      break;

    case 'summarizerer':
      contentDiv.innerHTML = `
        <div class="summarizerer-formrm" style="padding: 15px;">
          <textarea class="summarizerer-input" placeholder="Paste text to summarize..." style="width: 100%; height: 100px; resize: none;"></textarea>
          <div style="margin: 10px 0;">
            <label>Level: <select class="sum-level"  style=" margin-bottom:15px;"><option value="basic">Basic</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label style="margin-left: 10px;">Paragraphs: <input type="number" class="sum-paragraphs" min="1" max="5" value="1" style="width: 50px;"></label>
          </div>
          <button class="generate-btntn">summarizere</button>
        </div>
        <div class="summarizerer-preview response-ccontainer" style="flex-grow: 1; padding: 10px; overflow-y: auto; background: #f9f9f9; max-height: calc(100vh - 250px);"></div>
      `;
      const summarizererInput = contentDiv.querySelector('.summarizerer-input');
      if (window.getSelection().toString().trim()) summarizererInput.value = window.getSelection().toString().trim();
      contentDiv.querySelector('.generate-btntn').addEventListener('click', () => generateSummary(contentDiv));
      break;
    
   

    case 'settings':
      contentDiv.innerHTML = `
                        <div class="settings-formrm">
                            <div class="settings-conte">
                                <div class="ai-setti-field">
                                    <label for="username">Name</label>
                                    <input type="text" id="username" placeholder="Enter your username" value="${userProfile?.username || ''}">
                                </div>
                                <div class="ai-setti-field">
                                    <label for="language">Native Language</label>
                                    <input type="text" id="language" placeholder="Enter your language" value="${userProfile?.language || 'English'}">
                                </div>
                                <div class="ai-setti-field">
                                    <label for="class">Class</label>
                                    <input type="text" id="class" placeholder="Enter your class" value="${userProfile?.class || ''}">
                                </div>
                                <div class="ai-setti-field">
                                    <label for="role">Role</label>
                                    <select id="role">
                                        <option value="">Select role</option>
                                        <option value="student" ${userProfile?.role === 'student' ? 'selected' : ''}>Student</option>
                                        <option value="teacher" ${userProfile?.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                                    </select>
                                </div>
                                <div class="ai-setti-field">
                                    <label for="support-needed">Enable Support Mode</label>
                                    <input type="checkbox" id="support-needed" ${userProfile?.supportNeeded !== false ? 'checked' : ''}>
                                </div>
                                <div class="ai-setti-field">
    <label for="auto-navigate">Enable Automatic Navigation</label>
    <input type="checkbox" id="auto-navigate" ${userProfile?.autoNavigate !== false ? 'checked' : ''}>
  </div>
                                <button class="ai-setti-save">Save Settings</button>
                            </div>
                        </div>
                    `;
      function renderSettingsForm() {
        const contentDiv = chatContainer.querySelector('.vidy-mode-cont');
        contentDiv.innerHTML = `
                        <div class="settings-formrm">
                          <div class="settings-conte">
                            <div class="ai-setti-field">
                              <label for="username">Name</label>
                              <input type="text" id="username" placeholder="Enter your username" value="${userProfile?.username || ''}">
                            </div>
                            <div class="ai-setti-field" style="display:none !important;">
                              <label for="age">Age</label>
                              <input type="number" id="age" placeholder="Enter your age" value="${userProfile?.age || ''}">
                            </div>
                            <div class="ai-setti-field">
                              <label for="class">Class/Grade</label>
                              <input type="text" id="class" placeholder="e.g., Grade 5, Class 10" value="${userProfile?.class || ''}">
                            </div>
                            <div class="ai-setti-field">
                              <label for="language">Native Language</label>
                              <select id="language">
                                ${Object.entries(languageMap).map(([key, value]) => `
                                  <option value="${value}" ${userProfile?.language === value ? 'selected' : ''}>
                                    ${value}
                                  </option>
                                `).join('')}
                              </select>
                            </div>
                            <div class="ai-setti-field">
                              <label for="role">Role</label>
                              <select id="role">
                                <option value="student" ${userProfile?.role === 'student' ? 'selected' : ''}>student</option>
                                <option value="teacher" ${userProfile?.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                              
                              </select>
                            </div>
                            <div class="ai-setti-field">
  <div style="display: flex; align-items: center; gap: 12px;">
    <label for="auto-navigate" style="margin: 0;">Enable Automatic Navigation</label>
    
    <!-- Toggle Switch -->
    <label class="toggle-swit">
      <input type="checkbox" id="auto-navigate" ${userProfile?.autoNavigate !== false ? 'checked' : ''}>
      <span class="slid round"></span>
    </label>
  </div>
</div>
                          
                            <button class="ai-setti-save">Save Settings</button>
                          </div>
                        </div>
                      `;

        const saveBtn = contentDiv.querySelector('.ai-setti-save');
        saveBtn.addEventListener('click', () => {
          const username = contentDiv.querySelector('#username').value.trim();
          const age = contentDiv.querySelector('#age').value.trim();
          const classLevel = contentDiv.querySelector('#class').value.trim();
          const language = contentDiv.querySelector('#language').value;
          const role = contentDiv.querySelector('#role').value;
          const autoNavigate = document.querySelector('#auto-navigate').checked;
          userProfile = {
            username,
            age,
            class: classLevel,
            language,
            autoNavigate,
            role,
            supportNeeded: true
          };

          chrome.storage.local.set({ userProfile }, () => {
            console.log('User profile saved:', userProfile);
            renderProfileView();
          });
        });
      }
      // Helper function to render profile view
      function renderProfileView() {
        contentDiv.innerHTML = `
                            <div class="vidy-profile-vie">
                                <div class="settings-conte">
                                    <h3>Profile Details</h3>
                                    <div class="profile-fieldd">
                                        <strong>Name:</strong>
                                        <p>${userProfile?.username || 'Not set'}</p>
                                    </div>
                                    <div class="profile-fieldd">
                                        <strong>Native Language:</strong>
                                        <p>${userProfile?.language || 'English'}</p>
                                    </div>
                                    <div class="profile-fieldd">
                                        <strong>Class:</strong>
                                        <p>${userProfile?.class || 'Not set'}</p>
                                    </div>
                                    <div class="profile-fieldd">
                                        <strong>Role:</strong>
                                        <p>${userProfile?.role ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1) : 'Not set'}</p>
                                    </div>
                                    <div class="profile-fieldd" style="display:none !important;">
                                        <strong>Support Mode:</strong>
                                        <p>${userProfile?.supportNeeded !== false ? 'Enabled' : 'Disabled'}</p>
                                    </div>
                                    <div class="profile-fieldd">
    <strong>Auto Navigation:</strong>
    <p>${userProfile?.autoNavigate !== false ? 'Enabled' : 'Disabled'}</p>
  </div>
                                    <button class="edit-profi-btn">Edit Profile</button>
                                </div>
                            </div>
                        `;
        const editBtn = contentDiv.querySelector('.edit-profi-btn');
        editBtn.addEventListener('click', () => {
          renderSettingsForm();
        });
      }

      // Initially render settings form
      renderProfileView();
      break;
  }
}
function toggleVoiceInput() {
  if (isVoiceInputActive) {
    stopVoiceRecognition();
    voiceInputBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/mic.png')}" alt="Voice Input" style="width: 24px; height: 24px;">`;
    voiceStatus.textContent = '';
    voiceStatus.style.display = 'none';
    isVoiceInputActive = false;
  } else {
    startVoiceRecognition();
    voiceInputBtn.innerHTML = `<img src="${chrome.runtime.getURL('icons/speak.png')}" alt="Listening..." style="width: 24px; height: 24px;">`;
    voiceStatus.textContent = 'Listening...';
    voiceStatus.style.display = 'block';
    isVoiceInputActive = true;
  }
}
function stopVoiceRecognition() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}
async function generatewritingng(contentDiv) {
  const type = contentDiv.querySelector('.writingng-type').value;
  const topic = contentDiv.querySelector('.writingng-topic').value || window.getSelection().toString().trim();
  const recipient = contentDiv.querySelector('.writingng-recipient').value;
  const preview = contentDiv.querySelector('.writingng-preview');
  if (!topic) {
    preview.innerHTML = '<p class="erro">Please enter a topic or select text.</p>';
    return;
  }
  preview.innerHTML = '<p class="loadi">Generating...</p>';
  try {
    const response = await generateAIResponse(topic, { mode: 'writingng', type, details: { recipient } });
    preview.innerHTML = `
      <div class="response-ccontent">${response.replace(/\n/g, '<br>')}</div>
      <div class="response-coptions">
        <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:14px;height:14px;"></button>
        <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="speak" style="width:14px;height:14px;"></button>
        <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="edit" style="width:14px;height:14px;"></button>
        <button class="retry-btn" title="Retry"><img src="${chrome.runtime.getURL('icons/reload.png')}" alt="retry" style="width:14px;height:14px;"></button>
      </div>`;
    addResponseoptionsListeners(preview, true, () => generatewritingng(contentDiv));
  } catch (error) {
    preview.innerHTML = `<p class="erro">Error generating response: ${error.message}</p>`;
  }
}

function updateRoleInputs() {
  const container = document.querySelector('#role-names-container');
  if (!container) return;

  const count = parseInt(document.querySelector('#role-count').value);
  container.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    container.innerHTML += `
      <div class="role-input">
        <label>Role ${i}:</label>
        <input type="text" value="User ${i}">
      </div>
    `;
  }
}
function changeQuantity(type, delta) {
  const qtyElement = document.getElementById(`${type}-qty`);
  if (!qtyElement) return;
  
  const card = document.querySelector(`.questin-tye-card[data-type="${type}"]`);
  let currentQty = parseInt(qtyElement.textContent);
  let newQty = currentQty + delta;
  
  // Ensure quantity stays within bounds
  if (newQty < 0) newQty = 0;
  if (newQty > 20) newQty = 20;
  
  qtyElement.textContent = newQty;
  
  // Update card appearance
  card.classList.toggle('active', newQty > 0);
  card.classList.toggle('inactive', newQty === 0);
}
async function generateQuiz() {
  const container = document.querySelector('.quizz-previ');
  const form = document.querySelector('.quizz-formrm-inner');
  if (!container) return;
  form.style.display = 'none';
  container.innerHTML = `
    <div class="quizz-loading">
      <div class="spinner"></div>
      <p>Generating your quiz...</p>
    </div>
  `;

  // Get form values
  const classLevel = document.querySelector('#class-select').value;
  const subject = document.querySelector('#quizz-subject').value || 'General Knowledge';
  const details = document.querySelector('#quizz-details').value || '';

  // Get question types
  const questionTypes = [];

  const types = ['mcq', 'tf', 'short', 'essay'];
  types.forEach(type => {
      const qtyElement = document.getElementById(type + '-qty');
      const card = document.querySelector(`[data-type="${type}"]`);
      const qty = parseInt(qtyElement.textContent);
      console.log("qty"+type+"amt"+qty);
      questionTypes.push({
        type: type,
        quantity: qty
      });
      if (qty === 0) {
          card.classList.remove('active');
          card.classList.add('inactive');
      } else {
          card.classList.remove('inactive');
          card.classList.add('active');
      }
  });



  // document.querySelectorAll('.tye-r').forEach(row => {
  //   const checkbox = row.querySelector('input[type="checkbox"]');
  //   const qtyInput = row.querySelector('.qty-input');

  //   if (checkbox.checked) {
  //     questionTypes.push({
  //       type: checkbox.value,
  //       quantity: parseInt(qtyInput.value)
  //     });
  //   }
  // });

  try {
    // Prepare prompt
    const prompt = `
      Generate a quiz for ${classLevel === 'university' ? 'university' : `${classLevel}th grade`} on "${subject}".
      Question types and quantities: ${JSON.stringify(questionTypes)}
      Additional details: ${details}
      
      Format the quiz as a JSON array with the following structure:
      [
        {
          "type": "multiple_choice" OR "true_false" OR "short_answer" OR "essay",
          "question": "Question text",
          "options": ["option1", "option2", "option3", "option4"] (only for multiple_choice),
          "correctAnswer": "Correct answer",
          "explanation": "Explanation of the answer"
        },
        ...
      ]
      
      IMPORTANT: Return ONLY the JSON array, no additional text.
    `;

    // Call API
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    
    // Parse the JSON response
    try {
      quizState.questions = JSON.parse(data.response);
      quizState.currentIndex = 0;
      quizState.userAnswers = [];
      quizState.startTime = Date.now();
      quizState.totalQuestions = quizState.questions.length;
      
      if (quizState.questions.length === 0) {
        throw new Error('No questions generated');
      }
      
      renderQuizQuestion();
    } catch (parseError) {
      console.error('Error parsing quiz:', parseError);
      container.innerHTML = `
        <div class="quizz-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#f44336">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p>Error parsing quiz. Please try again.</p>
          <button class="retry-btn">Retry</button>
        </div>
      `;
      document.querySelector('.retry-btn').addEventListener('click', generateQuiz);
    }
  } catch (error) {
    container.innerHTML = `
      <div class="quizz-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#f44336">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>Error: ${error.message}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;
    document.querySelector('.retry-btn').addEventListener('click', generateQuiz);
  }
}


function renderQuizQuestion() {
  const container = document.querySelector('.quizz-previ');
  if (!container || quizState.currentIndex >= quizState.questions.length) return;

  const question = quizState.questions[quizState.currentIndex];
  const questionNumber = quizState.currentIndex + 1;
  const totalQuestions = quizState.totalQuestions;
  
  let questionHTML = '';
  
  switch (question.type) {
    case 'multiple_choice':
      questionHTML = `
        <div class="quizz-question">
          <div class="questin-header">
            <span class="questin-count">Question ${questionNumber}/${totalQuestions}</span>
            <span class="questin-type">Multiple Choice</span>
          </div>
          <div class="questin-text">${question.question}</div>
          <div class="options-container">
            ${question.options.map((option, index) => `
              <label class="optio">
                <input type="radio" name="answer" value="${option}" 
                       ${quizState.userAnswers[quizState.currentIndex] === option ? 'checked' : ''}>
                <span class="option-text">${option}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
      break;
      
    case 'true_false':
      questionHTML = `
        <div class="quizz-question">
          <div class="questin-header">
            <span class="questin-count">Question ${questionNumber}/${totalQuestions}</span>
            <span class="questin-type">True/False</span>
          </div>
          <div class="questin-text">${question.question}</div>
          <div class="options-container">
            <label class="optio">
              <input type="radio" name="answer" value="True" 
                     ${quizState.userAnswers[quizState.currentIndex] === 'True' ? 'checked' : ''}>
              <span class="option-text">True</span>
            </label>
            <label class="optio">
              <input type="radio" name="answer" value="False" 
                     ${quizState.userAnswers[quizState.currentIndex] === 'False' ? 'checked' : ''}>
              <span class="option-text">False</span>
            </label>
          </div>
        </div>
      `;
      break;
      
    case 'short_answer':
      questionHTML = `
        <div class="quizz-question">
          <div class="questin-header">
            <span class="questin-count">Question ${questionNumber}/${totalQuestions}</span>
            <span class="questin-type">Short Answer</span>
          </div>
          <div class="questin-text">${question.question}</div>
          <textarea class="short-answerer" placeholder="Type your answer here...">${quizState.userAnswers[quizState.currentIndex] || ''}</textarea>
        </div>
      `;
      break;
      
    case 'essay':
      questionHTML = `
        <div class="quizz-question">
          <div class="questin-header">
            <span class="questin-count">Question ${questionNumber}/${totalQuestions}</span>
            <span class="questin-type">Essay</span>
          </div>
          <div class="questin-text">${question.question}</div>
          <textarea class="essay-answerer" placeholder="Type your essay here...">${quizState.userAnswers[quizState.currentIndex] || ''}</textarea>
        </div>
      `;
      break;
  }
  
  const navigationHTML = `
    <div class="quizz-navigation">
      <button class="nav-b prev-btn" ${quizState.currentIndex === 0 ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
        </svg>
        Previous
      </button>
      <button class="nav-b next-btn">
        ${quizState.currentIndex === quizState.totalQuestions - 1 ? 'Submit Quiz' : 'Next'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </button>
    </div>
    <button class="exit-quizzz-btn">Exit Quiz</button>
  `;
  
  container.innerHTML = questionHTML + navigationHTML;
  
  // Add event listeners
  document.querySelector('.prev-btn').addEventListener('click', goToPreviousQuestion);
  document.querySelector('.next-btn').addEventListener('click', goToNextQuestion);
  document.querySelector('.exit-quizzz-btn').addEventListener('click', confirmExitQuiz);
}

function saveAnswer() {
  const question = quizState.questions[quizState.currentIndex];
  let answer = '';
  
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const selected = document.querySelector('input[name="answer"]:checked');
    answer = selected ? selected.value : '';
  } else {
    answer = document.querySelector('.short-answerer, .essay-answerer').value;
  }
  
  quizState.userAnswers[quizState.currentIndex] = answer;
}

function goToPreviousQuestion() {
  saveAnswer();
  quizState.currentIndex--;
  renderQuizQuestion();
}

function goToNextQuestion() {
  saveAnswer();
  
  if (quizState.currentIndex < quizState.totalQuestions - 1) {
    quizState.currentIndex++;
    renderQuizQuestion();
  } else {
    submitQuiz();
  }
}

function confirmExitQuiz() {
  const form = document.querySelector('.quizz-formrm-inner');
  form.style.display = 'block';
    resetQuiz();
  }


async function submitQuiz() {
  const container = document.querySelector('.quizz-previ');
  if (!container) return;
  
  container.innerHTML = `
    <div class="quizz-submitting">
      <div class="spinner"></div>
      <p>Evaluating your answers...</p>
    </div>
  `;
  
  try {
    // Prepare grading request
    
    const quizData = {
      questions: quizState.questions,
      userAnswers: quizState.userAnswers,
      timeTaken: Math.floor((Date.now() - quizState.startTime) / 1000) // in seconds
    };
    const actualScore = quizState.questions.reduce((score, q, i) => {
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const userAns = quizState.userAnswers[i]?.toString().trim().toLowerCase();
        const correctAns = q.correctAnswer.toString().trim().toLowerCase();
        return userAns === correctAns ? score + 1 : score;
      }
      return score; // Open-ended questions evaluated by AI
    }, 0);

    const totalQuestions = quizState.questions.length;
    const actualPercentage = Math.round((actualScore / totalQuestions) * 100);
    // const prompt = `
    //   Evaluate the quiz answers and provide detailed feedback in JSON format:
    //   ${JSON.stringify(quizData)}
      
    //   Response format:
    //   {
    //     "score": "X/Y",
    //     "percentage": N,
    //     "feedback": [
    //       {
    //         "question": "Question text",
    //         "userAnswer": "User's answer",
    //         "correctAnswer": "Correct answer",
    //         "isCorrect": true/false,
    //         "explanation": "Explanation text"
    //       },
    //       ...
    //     ],
    //     "overallFeedback": "Personalized feedback based on performance",
    //     "badgege": "badgege name based on performance",
    //     "badgegeIcon": "Icon name for badgege"
    //   }
    // `;
    const prompt = `
    Evaluate quiz answers and provide feedback. ADHERE TO THESE RULES:
    1. Verify score matches: ${actualScore}/${totalQuestions} (${actualPercentage}%)
    2. For open-ended questions, set isCorrect=true ONLY if answer is substantially correct
    3. NEVER alter the score/percentage values provided above
    
    Quiz data: ${JSON.stringify({
      questions: quizState.questions,
      userAnswers: quizState.userAnswers,
      actualScore: `${actualScore}/${totalQuestions}`,
      actualPercentage
    })}
    
    Response format (STRICT JSON):
    {
      "score": "${actualScore}/${totalQuestions}", 
      "percentage": ${actualPercentage},
      "feedback": [{
        "question": "Question text",
        "userAnswer": "User's answer",
        "correctAnswer": "Correct answer",
        "isCorrect": true/false,
        "explanation": "Explanation text"
      }],
      "overallFeedback": "Personalized feedback based on performance",
      "badgege": "badgege name based on performance",
      "badgegeIcon": "Icon name for badgege""
    }`;








    // Call API for grading
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) throw new Error(`Grading error: ${response.status}`);
    const data = await response.json();
    
    // Parse the grading result
    try {
      const gradingResult = JSON.parse(data.response);
      if (gradingResult.score !== `${actualScore}/${totalQuestions}` || 
      gradingResult.percentage !== actualPercentage) {
    console.warn('AI score mismatch. Using client-side score');
    gradingResult.score = `${actualScore}/${totalQuestions}`;
    gradingResult.percentage = actualPercentage;
  }
      showQuizResults(gradingResult);
    } catch (parseError) {
      console.error('Error parsing grading result:', parseError);
      container.innerHTML = `
        <div class="quizz-error">
          <p>Error evaluating your answers. Please try again.</p>
          <button class="retry-btn">Retry Evaluation</button>
        </div>
      `;
      document.querySelector('.retry-btn').addEventListener('click', submitQuiz);
    }
  } catch (error) {
    container.innerHTML = `
      <div class="quizz-error">
        <p>Error: ${error.message}</p>
        <button class="retry-btn">Retry Evaluation</button>
      </div>
    `;
    document.querySelector('.retry-btn').addEventListener('click', submitQuiz);
  }
}

function showQuizResults(result) {
  const container = document.querySelector('.quizz-previ');
  if (!container) return;
  
  // Calculate correct answers
  const correctCount = result.feedback.filter(q => q.isCorrect).length;
  
  // Determine badgege icon
  const badgegeIcons = {
    'Novice': '🥉',
    'Explorer': '🥈',
    'Scholar': '🥇',
    'Master': '🏆',
    'Genius': '🌟'
  };
  
  const badgegeIcon = badgegeIcons[result.badgege] || '🎓';
  
  container.innerHTML = `
    <div class="quizz-results">
      <div class="result-headerer">
        <div class="scre-badgege">
          <div class="badgege-icon">${badgegeIcon}</div>
          <div class="badgege-name">${result.badgege}</div>
        </div>
        <div class="scre-display">
          <div class="scre-value">${result.score}</div>
          <div class="scre-percentage">${result.percentage}%</div>
        </div>
      </div>
      
      <div class="feedbck-summary">
        <p>${result.overallFeedback}</p>
      </div>
      
      <div class="detailed-feedbackck">
        <h3>Question Breakdown</h3>
        <div class="feedbck-list">
          ${result.feedback.map((item, index) => `
            <div class="feedbck-item ${item.isCorrect ? 'correct' : 'incorrect'}">
              <div class="feedbck-header">
                <span class="questin-number">Q${index + 1}</span>
                <span class="status-icon">${item.isCorrect ? '✓' : '✗'}</span>
              </div>
              <div class="feedbck-question">${item.question}</div>
              <div class="feedbck-answer">
                <strong>Your answer:</strong> ${item.userAnswer || 'No answer provided'}
              </div>
              ${!item.isCorrect ? `
                <div class="feedbck-correct">
                  <strong>Correct answer:</strong> ${item.correctAnswer}
                </div>
              ` : ''}
              <div class="feedbck-explanation">${item.explanation}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="result-actionsns">
        <button class="actin-btn retry-quizz">Retry Quiz</button>
        <button class="actin-btn new-quizz">New Quiz</button>
        <button class="actin-btn exit-quizz">Exit</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.querySelector('.retry-quizz').addEventListener('click', () => {
    quizState.currentIndex = 0;
    quizState.userAnswers = [];
    quizState.startTime = Date.now();
    renderQuizQuestion();
  });
  
  document.querySelector('.new-quizz').addEventListener('click', () => {
    resetQuiz();
    document.querySelector('.generate-btntn').click();
  });
  
  document.querySelector('.exit-quizz').addEventListener('click', resetQuiz);
}

function resetQuiz() {
  quizState = {
    questions: [],
    currentIndex: 0,
    userAnswers: [],
    startTime: null,
    totalQuestions: 0
  };
  const form = document.querySelector('.quizz-formrm-inner');
  const container = document.querySelector('.quizz-previ');
  form.style.display = 'block';

  if (container) container.innerHTML = '';
}
// Roleplay generation function
async function generateRoleplay() {
  const container = document.querySelector('.roleplay-preview');
  if (!container) return;

  container.innerHTML = '<p class="loadi">Generating roleplay...</p>';

  // Get form values
  const roleCount = parseInt(document.querySelector('#role-count').value);
  const roles = [];

  document.querySelectorAll('#role-names-container .role-input input').forEach((input, index) => {
    roles.push({
      name: input.value || `User ${index + 1}`,
      id: `role${index + 1}`
    });
  });

  const topic = document.querySelector('#roleplay-topic').value || 'Educational scenario';

  try {
    // Prepare prompt
    const prompt = `
      Create a roleplay script with ${roleCount} roles: ${roles.map(r => r.name).join(', ')}
      Topic: ${topic}
      
      Format:
      - Start with a scene setting
      - For each line: [Character Name]: [Dialogue]
      - Include stage directions in parentheses
      - End with a conclusion or discussion points
    `;

    // Call API
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();

    // Format response
    let formattedResponse = data.response
      .replace(/(Scene:.*)/, '<div class="scene-setting">$1</div>') // Scene setting
      .replace(/([A-Za-z ]+):/g, '<div class="role-name">$1:</div>') // Character names
      .replace(/\((.*?)\)/g, '<div class="stage-direction">($1)</div>') // Stage directions
      .replace(/\n/g, '<br>');

    container.innerHTML = `
      <div class="roleplay-content">${formattedResponse}</div>
      <div class="roleplay-actions">
        <button class="roleplay-actin-btn" data-action="add-roles">Add More Roles</button>
        <button class="roleplay-actin-btn" data-action="extend">Extend Scenario</button>
        <button class="roleplay-actin-btn" data-action="simplify">Simplify Language</button>
     
      </div>
    `;

    // Add action listeners
    document.querySelectorAll('.roleplay-actin-btn').forEach(btn => {
      btn.addEventListener('click', handleRoleplayAction);
    });

  } catch (error) {
    container.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
  }
}

// translationon function
async function translateText() {
  const resultContainer = document.querySelector('.translationon-result');
  if (!resultContainer) return;

  resultContainer.innerHTML = '<p class="loadi">translationng...</p>';

  const sourceText = document.querySelector('#source-text').value;
  const sourceLang = document.querySelector('#source-lang').value;
  const targetLang = document.querySelector('#target-lang').value;

  if (!sourceText.trim()) {
    resultContainer.innerHTML = '<p class="erro">Please enter text to translate</p>';
    return;
  }

  try {
    // Prepare prompt
    const prompt = `
      Translate the following text from ${sourceLang === 'auto' ? 'auto-detected language' : sourceLang} to ${targetLang}:
      "${sourceText}"
      
      Provide only the translatedd text without any additional explanations.
    `;

    // Call API
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();

    resultContainer.innerHTML = `
      <div class="translationon-output">
        <div class="translatedd-text">${data.response}</div>
        <div class="translationon-actions">
          <button class="cop-translationon">Copy translationon</button>
          <button class="speak-translationon">Speak translationon</button>
          <button class="new-translationon">New translationon</button>
        </div>
      </div>
    `;

    // Add action listeners
    resultContainer.querySelector('.cop-translationon').addEventListener('click', () => {
      copyText(data.response);
      showCopyFeedback(resultContainer.querySelector('.cop-translationon'), true);
    });

    resultContainer.querySelector('.speak-translationon').addEventListener('click', () => {
      speakText(data.response);
    });

    resultContainer.querySelector('.new-translationon').addEventListener('click', () => {
      document.querySelector('#source-text').value = '';
      resultContainer.innerHTML = '';
    });

  } catch (error) {
    resultContainer.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
  }
}

// Quiz action handler
function handleQuizAction(e) {
  const action = e.target.getAttribute('data-action');
  const quizContent = document.querySelector('.quizz-content').innerText;
  const subject = document.querySelector('#quizz-subject').value;

  let prompt = '';

  switch (action) {
    case 'generate-more':
      prompt = `Generate 5 additional quiz questions on "${subject}" similar to this format: ${quizContent}`;
      break;
    case 'simplify':
      prompt = `Simplify these quiz questions to make them easier: ${quizContent}`;
      break;
    case 'add-details':
      prompt = `Add more detailed explanations to these quiz questions: ${quizContent}`;
      break;
    case 'export':
      alert('Export feature would be implemented in a full version');
      return;
  }

  const preview = document.querySelector('.quizz-previ');
  preview.innerHTML = '<p class="loadi">Processing...</p>';

  // Call API with the new prompt
  fetch('https://ai.learneng.app/LearnEng/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      let formattedResponse = data.response
        .replace(/(\d+\.\s)/g, '<strong>$1</strong>')
        .replace(/Answer:\s*(.*)/g, '<div class="quizz-answer">Answer: $1</div>')
        .replace(/Explanation:\s*(.*)/g, '<div class="quizz-explanation">Explanation: $1</div>')
        .replace(/\n/g, '<br>');

      preview.innerHTML = `
      <div class="quizz-content">${formattedResponse}</div>
      <div class="quizz-actions">
        <button class="quizz-actin-btn" data-action="generate-more">Generate More Questions</button>
        <button class="quizz-actin-btn" data-action="simplify">Simplify Questions</button>
        <button class="quizz-actin-btn" data-action="add-details">Add More Details</button>
        
      </div>
    `;

      document.querySelectorAll('.quizz-actin-btn').forEach(btn => {
        btn.addEventListener('click', handleQuizAction);
      });
    })
    .catch(error => {
      preview.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
    });
}

// Roleplay action handler
function handleRoleplayAction(e) {
  const action = e.target.getAttribute('data-action');
  const roleplayContent = document.querySelector('.roleplay-content').innerText;
  const topic = document.querySelector('#roleplay-topic').value;

  let prompt = '';

  switch (action) {
    case 'add-roles':
      prompt = `Add 2 more roles to this roleplay scenario: ${roleplayContent}`;
      break;
    case 'extend':
      prompt = `Extend and elaborate this roleplay scenario: ${roleplayContent}`;
      break;
    case 'simplify':
      prompt = `Simplify the language in this roleplay for easier understanding: ${roleplayContent}`;
      break;
    case 'export':
      alert('Export feature would be implemented in a full version');
      return;
  }

  const preview = document.querySelector('.roleplay-preview');
  preview.innerHTML = '<p class="loadi">Processing...</p>';

  // Call API with the new prompt
  fetch('https://ai.learneng.app/LearnEng/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
    .then(response => {
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      let formattedResponse = data.response
        .replace(/(Scene:.*)/, '<div class="scene-setting">$1</div>')
        .replace(/([A-Za-z ]+):/g, '<div class="role-name">$1:</div>')
        .replace(/\((.*?)\)/g, '<div class="stage-direction">($1)</div>')
        .replace(/\n/g, '<br>');

      preview.innerHTML = `
      <div class="roleplay-content">${formattedResponse}</div>
      <div class="roleplay-actions">
        <button class="roleplay-actin-btn" data-action="add-roles">Add More Roles</button>
        <button class="roleplay-actin-btn" data-action="extend">Extend Scenario</button>
        <button class="roleplay-actin-btn" data-action="simplify">Simplify Language</button>
       
      </div>
    `;

      document.querySelectorAll('.roleplay-actin-btn').forEach(btn => {
        btn.addEventListener('click', handleRoleplayAction);
      });
    })
    .catch(error => {
      preview.innerHTML = `<p class="erro">Error: ${error.message}</p>`;
    });
}



async function generatelessononPlan(contentDiv) {
  const subject = contentDiv.querySelector('.lessonon-subject').value;
  const grade = contentDiv.querySelector('.lessonon-grade').value;
  const duration = contentDiv.querySelector('.lessonon-duration').value;
  const preview = contentDiv.querySelector('.lessonon-preview');
  if (!subject) {
    preview.innerHTML = '<p class="erro">Please enter a subject.</p>';
    return;
  }
  preview.innerHTML = '<p class="loadi">Generating...</p>';
  try {
    const response = await generateAIResponse('Generate a lessonon plan', { mode: 'lessonon-plan', details: { subject, grade, duration } });
    preview.innerHTML = `
      <div class="response-ccontent">${response.replace(/\n/g, '<br>')}</div>
      <div class="response-coptions">
        <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:18px;height:18px;"></button>
        <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="speak" style="width:18px;height:18px;"></button>
        <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="edit" style="width:18px;height:18px;"></button>
        <button class="retry-btn" title="Retry"><img src="${chrome.runtime.getURL('icons/reload.png')}" alt="retry" style="width:18px;height:18px;"></button>
      </div>`;
    addResponseoptionsListeners(preview, true, () => generatelessononPlan(contentDiv));
  } catch (error) {
    preview.innerHTML = `<p class="erro">Error generating response: ${error.message}</p>`;
  }
}

async function generatestudydyPlan(contentDiv) {
  const classLevel = contentDiv.querySelector('.studydy-class').value;
  const subject = contentDiv.querySelector('.studydy-subject').value;
  const topic = contentDiv.querySelector('.studydy-topic').value || window.getSelection().toString().trim();
  const timeline = contentDiv.querySelector('.studydy-timeline').value;
  const preview = contentDiv.querySelector('.studydy-preview');
  if (!topic) {
    preview.innerHTML = '<p class="erro">Please enter a topic or select text.</p>';
    return;
  }
  preview.innerHTML = '<p class="loadi">Generating...</p>';
  try {
    const response = await generateAIResponse(topic, { mode: 'studydy-plan', details: { class: classLevel, subject, topic, timeline } });
    const rows = response.split('\n').map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => `<td>${cell.trim()}</td>`);
      return cells.length ? `<tr>${cells.join('')}</tr>` : '';
    }).filter(row => row);
    preview.innerHTML = `
      <div class="response-ccontent">${rows.length ? `<table>${rows.join('')}</table>` : response.replace(/\n/g, '<br>')}</div>
      <div class="response-coptions">
        <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:14px;height:14px;"></button>
        <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="speak"  style="width:14px;height:14px;></button>
        <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="edit"  style="width:14px;height:14px;></button>
        <button class="retry-btn" title="Retry"><img src="${chrome.runtime.getURL('icons/reload.png')}" alt="edit"  style="width:14px;height:14px;></button>
      </div>`;
    addResponseoptionsListeners(preview, true, () => generatestudydyPlan(contentDiv));
  } catch (error) {
    preview.innerHTML = `<p class="erro">Error generating response: ${error.message}</p>`;
  }
}

async function generateSummary(contentDiv) {
  const text = contentDiv.querySelector('.summarizerer-input').value || window.getSelection().toString().trim();
  const level = contentDiv.querySelector('.sum-level').value;
  const paragraphs = contentDiv.querySelector('.sum-paragraphs').value;
  const preview = contentDiv.querySelector('.summarizerer-preview');
  if (!text) {
    preview.innerHTML = '<p class="erro">Please enter text or select some to summarize.</p>';
    return;
  }
  preview.innerHTML = '<p class="loadi">Generating...</p>';
  try {
    const response = await generateAIResponse(text, { mode: 'summarizerer', details: { level, paragraphs } });
    preview.innerHTML = `
      <div class="response-ccontent">${response.replace(/\n/g, '<br>')}</div>
      <div class="response-coptions">
        <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy"  style="width:14px;height:14px;"></button>
        <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="speak" style="width:14px;height:14px;"></button>
        <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="edit" style="width:14px;height:14px;"></button>
        <button class="retry-btn" title="Retry"><img src="${chrome.runtime.getURL('icons/reload.png')}" alt="retry" style="width:14px;height:14px;"></button>
      </div>`;
    addResponseoptionsListeners(preview, true, () => generateSummary(contentDiv));
  } catch (error) {
    preview.innerHTML = `<p class="erro">Error generating response: ${error.message}</p>`;
  }
}
function formatwritingng(type, topic, recipient) {
  switch (type) {
    case 'letter': return `<p>Dear ${recipient || 'Sir/Madam'},<br><br>${topic}<br><br>Sincerely,<br>User</p>`;
    case 'email': return `<p>Subject: ${topic}<br><br>To: ${recipient || 'recipient@example.com'}<br><br>${topic}<br><br>Best regards,<br>User</p>`;
    case 'essay': return `<h4>${topic}</h4><p>This is an essay about ${topic}...</p>`;
  }
}

// Modified startVoiceChatMode function
function startVoiceChatMode() {
  // Check if chatContainer exists
  if (!chatContainer) {
    console.error("Chat container not found!");
    return;
  }

  // Get references to all container elements
  const voiceContainer = chatContainer.querySelector('.voice-inpu-container');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');
  const inputDiv = chatContainer.querySelector('.chat-containe-input');
  const settingsPanel = chatContainer.querySelector('.settings-pane1');
  const profileView = chatContainer.querySelector('.profile-vie');

  // Make sure all elements exist
  if (!voiceContainer || !messagesDiv || !inputDiv) {
    console.error("Required elements not found in chat container");
    return;
  }

  // Hide all other container elements and show voice container
  voiceContainer.style.display = 'flex';
  messagesDiv.style.display = 'none';
  inputDiv.style.display = 'none';
  if (settingsPanel) settingsPanel.style.display = 'none';
  if (profileView) profileView.style.display = 'none';

  // Set up the voice container UI
  voiceContainer.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="listeni" class="state-icon listening" style="width: 100px; height: 100px; border-radius: 50%;">
    <div class="voice-statu" style="margin-top: 10px; padding: 8px 15px; background-color: rgba(0,0,0,0.7); color: white; border-radius: 4px;">Listening...</div>
    <div class="transcribed-text" style="margin-top: 10px; color: #333; min-height: 20px;"></div>
    <div class="voice-controls" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
      <button class="cancel-voice-bt" style="background: #f44336; color: #fff; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      <button class="ask-next-btn" style="background: #2196F3; color: #fff; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; display: none;">Ask Next</button>
    </div>
  `;
  chatContainer.classList.add('voice-inpu-active');

  // References to dynamic UI elements
  const transcribedDiv = voiceContainer.querySelector('.transcribed-text');
  const statusDiv = voiceContainer.querySelector('.voice-statu');
  const cancelBtn = voiceContainer.querySelector('.cancel-voice-bt');
  const askNextBtn = voiceContainer.querySelector('.ask-next-btn');

  // Function to handle the complete listening, processing, and speaking flow
  const handleVoiceInteraction = (firstTime = true) => {
    // If not first time, update UI to indicate listening again
    if (!firstTime) {
      statusDiv.textContent = 'Listening...';
      statusDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';

      // If speaking bars exist, replace them with the state icon
      const speakingBars = voiceContainer.querySelector('.speaking-ba');
      if (speakingBars) {
        const stateIconHTML = `<img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="listeni" class="state-icon listening" style="width: 100px; height: 100px; border-radius: 50%;">`;
        speakingBars.insertAdjacentHTML('beforebegin', stateIconHTML);
        speakingBars.remove();
      }

      // Hide ask next button while listening
      if (askNextBtn) askNextBtn.style.display = 'none';

      // Clear previous transcript
      if (transcribedDiv) transcribedDiv.textContent = '';
    }

    console.log("Starting voice recognition...");

    // Start voice recognition
    startVoiceRecognition(
      async (transcript) => {
        // Successfully captured speech
        console.log("Captured transcript:", transcript);

        if (!transcript || transcript.trim() === '') {
          console.log("Empty transcript, listening again...");
          statusDiv.textContent = 'Nothing heard. Please try again.';
          statusDiv.style.backgroundColor = '#ff9800'; // Orange for warning
          setTimeout(() => handleVoiceInteraction(false), 2000);
          return;
        }

        // Update UI with transcript
        if (transcribedDiv) transcribedDiv.textContent = `Heard: "${transcript}"`;
        if (statusDiv) {
          statusDiv.textContent = 'Processing...';
          statusDiv.style.backgroundColor = '#ff9800'; // Orange for processing
        }

        // Update icon to indicate loading
        const stateIcon = voiceContainer.querySelector('.state-icon');
        if (stateIcon && stateIcon.classList) {
          stateIcon.classList.remove('listening');
          stateIcon.classList.add('loading');
        }

        try {
          console.log("Sending request to API with transcript:", transcript);
          console.log("Current conversation history:", conversationHistory);

          // Prepare conversation history for API call
          const apiHistory = [...conversationHistory, { role: 'user', content: transcript }];

          // Call API to get AI response
          const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: JSON.stringify(apiHistory) })
          });

          // Handle API errors
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server error: ${response.status}`, errorText);
            throw new Error(`Server error: ${response.status}`);
          }

          // Parse response
          const data = await response.json();
          console.log("API response:", data);

          if (!data || typeof data.response !== 'string') {
            throw new Error('Invalid response format');
          }

          // Extract AI response
          const aiResponse = data.response;
          console.log("AI response text:", aiResponse);

          // Update conversation history
          conversationHistory.push({ role: 'user', content: transcript });
          conversationHistory.push({ role: 'assistant', content: aiResponse });

          // Update status to speaking
          if (statusDiv) {
            statusDiv.textContent = 'Speaking...';
            statusDiv.style.backgroundColor = '#2196F3'; // Blue for speaking
          }

          // Replace icon with speaking animation - FIXED VERSION
          const currentStateIcon = voiceContainer.querySelector('.state-icon');
          if (currentStateIcon && currentStateIcon.parentNode) {
            // Create speaking bars element
            const speakingBarsElement = document.createElement('div');
            speakingBarsElement.className = 'speaking-ba';
            speakingBarsElement.style.display = 'flex';
            speakingBarsElement.style.gap = '4px';
            speakingBarsElement.style.alignItems = 'flex-end';
            speakingBarsElement.style.height = '70px';
            speakingBarsElement.style.justifyContent = 'center';

            // Create bars
            for (let i = 0; i < 5; i++) {
              const bar = document.createElement('div');
              bar.className = 'bar';
              bar.style.width = '8px';
              bar.style.background = '#2196F3';
              bar.style.borderRadius = '4px';
              bar.style.height = `${Math.floor(Math.random() * 50) + 10}px`;
              speakingBarsElement.appendChild(bar);
            }

            // Replace icon with bars
            currentStateIcon.parentNode.replaceChild(speakingBarsElement, currentStateIcon);
            animateSpeakingBars();
          }

          // Speak the response
          speakText1(aiResponse, () => {
            console.log("Finished speaking response");

            // Add messages to chat history UI
            addMessageToChat('user', transcript);
            addMessageToChat('ai', aiResponse);

            // Update status
            if (statusDiv) {
              statusDiv.textContent = 'Ready for next question';
              statusDiv.style.backgroundColor = '#4CAF50'; // Green for ready
            }

            // Show ask next button
            if (askNextBtn) askNextBtn.style.display = 'inline-block';

          }, (error) => {
            console.error("Speech Error:", error);
            if (statusDiv) {
              statusDiv.textContent = `Speech Error: ${error}`;
              statusDiv.style.backgroundColor = '#f44336'; // Red for error
            }
            setTimeout(returnToChatMode, 3000);
          });

        } catch (error) {
          console.error("Error during API call or processing:", error);
          if (statusDiv) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.backgroundColor = '#f44336'; // Red for error
          }
          setTimeout(returnToChatMode, 3000);
        }
      },
      (error) => {
        // Voice recognition error
        console.error("Recognition error:", error);
        if (statusDiv) {
          statusDiv.textContent = `Recognition Error: ${error}`;
          statusDiv.style.backgroundColor = '#f44336'; // Red for error
        }
        if (transcribedDiv) transcribedDiv.textContent = '';
        setTimeout(() => handleVoiceInteraction(false), 3000);
      }
    );
  };

  // Start the voice interaction flow
  handleVoiceInteraction();

  // Set up cancel button
  cancelBtn.addEventListener('click', () => {
    console.log("Cancel button clicked");
    stopLiveAudio(() => {
      returnToChatMode();
      chatContainer.classList.remove('voice-inpu-active');
    });
  });

  // Set up ask next button
  askNextBtn.addEventListener('click', () => {
    console.log("Ask Next button clicked");
    stopLiveAudio(() => {
      console.log("Audio stopped, starting new voice interaction");
      handleVoiceInteraction(false);
    });
  });
}
// Add this utility at the top of your script to convert spoken number words to digits
// Simplified number word conversion for debugging
// Number word conversion (unchanged for now, but we'll adjust processing)
const numberWords = {
  "zero": 0, "oh": 0, "o": 0, "nil": 0, "nought": 0,
  "one": 1, "won": 1, "wun": 1,
  "two": 2, "to": 2, "too": 2, "deuce": 2, "tu": 2,
  "three": 3, "tree": 3, "tri": 3, "trey": 3, "thre": 3,
  "four": 4, "for": 4, "fo": 4, "fower": 4, "fore": 4,
  "five": 5, "fife": 5, "faiv": 5, "phive": 5, "fiv": 5,
  "six": 6, "sicks": 6, "sux": 6, "seks": 6, "sik": 6,
  "seven": 7, "sevn": 7, "sev": 7, "sven": 7, "saven": 7, "sevan": 7,
  "eight": 8, "ate": 8, "ait": 8, "et": 8, "eigt": 8,
  "nine": 9, "naine": 9, "nien": 9, "nein": 9, "nin": 9,
  "ten": 10, "then": 10, "tin": 10, "tan": 10,
  "eleven": 11, "elvn": 11, "leven": 11, "elevn": 11,
  "twelve": 12, "twelv": 12, "twelf": 12, "twel": 12,
  "thirteen": 13, "thirtn": 13, "threetn": 13, "thirtin": 13,
  "fourteen": 14, "fortn": 14, "fourtn": 14, "forteen": 14,
  "fifteen": 15, "fiftn": 15, "fiveteen": 15, "fiftin": 15,
  "sixteen": 16, "sixtn": 16, "siksteen": 16,
  "seventeen": 17, "seventn": 17, "sevntin": 17,
  "eighteen": 18, "eightn": 18, "atetn": 18, "eigtin": 18,
  "nineteen": 19, "ninteen": 19, "nintin": 19,
  "twenty": 20, "twente": 20, "tweny": 20,
  "thirty": 30, "thirtee": 30, "therty": 30,
  "forty": 40, "fourtee": 40, "fortee": 40,
  "fifty": 50, "fivtee": 50, "fivty": 50,
  "sixty": 60, "sixti": 60, "siksty": 60,
  "seventy": 70, "seventi": 70, "sevntee": 70,
  "eighty": 80, "eighti": 80, "aty": 80,
  "ninety": 90, "ninty": 90, "nine-ty": 90
};
function returnToChatMode() {
  const settingsPanel = chatContainer.querySelector('.settings-pane1');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');
  const inputDiv = chatContainer.querySelector('.chat-containe-input');
  const profileView = chatContainer.querySelector('.profile-vie');
  const voiceContainer = chatContainer.querySelector('.voice-inpu-container');

  settingsPanel.style.display = 'none';
  messagesDiv.style.display = 'block';
  inputDiv.style.display = 'flex';
  profileView.style.display = 'none';
  voiceContainer.style.display = 'none';
  chatContainer.classList.remove('voice-inpu-active'); // Reset background
}
function wordToNumber(word) {
  const lowerWord = word.toLowerCase().trim();
  console.log(`Raw number input: "${lowerWord}"`);
  const parts = lowerWord.split(/[\s-]+/);
  if (parts.length === 1) {
    const num = numberWords[lowerWord] || parseInt(lowerWord);
    return num !== undefined && !isNaN(num) ? num : lowerWord;
  }
  let total = 0;
  for (const part of parts) {
    const num = numberWords[part] || parseInt(part);
    if (num !== undefined && !isNaN(num)) total += num;
  }
  return total > 0 ? total : lowerWord;
}

function startVoiceSettings() {
  const voiceContainer = chatContainer.querySelector('.voice-inpu-container');
  const settingsPanel = chatContainer.querySelector('.settings-pane1');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');
  const inputDiv = chatContainer.querySelector('.chat-containe-input');
  const profileView = chatContainer.querySelector('.profile-vie');

  voiceContainer.style.display = 'flex';
  settingsPanel.style.display = 'none';
  messagesDiv.style.display = 'none';
  inputDiv.style.display = 'none';
  profileView.style.display = 'none';

  const questions = [
    "What is your name?",
    "How old are you?",
    "Which class are you in? Please say 'class' followed by the number.",
    "What is your native language?",
    "Are you a teacher or a student?"
  ];
  let currentQuestion = 0;
  let tempProfile = {};
  let retryCount = 0;
  const maxRetries = 3;

  voiceContainer.innerHTML = `
  <div class="profile-display"></div>
  <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="listeni" class="state-icon">
  <div class="voice-qu"></div>
  <div class="transcribed-text" style="margin-top: 10px; color: #333;"></div>
  <div class="voice-response" style="margin-top: 10px; color: #666;"></div>
  <div class="voice-controls" style="margin-top: 10px;">
    <button class="go-back-btn" style="padding: 5px 10px; margin-right: 5px;">Go Back</button>
    <button class="skip-btn" style="padding: 5px 10px;">Skip</button>
  </div>
`;
  updateProfileDisplay();
  const questionDiv = voiceContainer.querySelector('.voice-qu');
  const transcribedDiv = voiceContainer.querySelector('.transcribed-text');
  const responseDiv = voiceContainer.querySelector('.voice-response');
  const stateIcon = voiceContainer.querySelector('.state-icon');

  function updateVoiceUI(state, transcript = '') {
    transcribedDiv.textContent = transcript ? `Heard: "${transcript}"` : '';
    if (state === 'listening') {
      stateIcon.src = chrome.runtime.getURL('icons/Vidya4b.png');
      stateIcon.alt = 'Listening';
      responseDiv.textContent = "Listening...";
    } else if (state === 'processi') {
      stateIcon.src = chrome.runtime.getURL('icons/Vidya4b.png');
      stateIcon.alt = 'processi';
      responseDiv.textContent = 'Processing your answer...';
    } else if (state === 'speaking') {
      stateIcon.outerHTML = `
        <div class="speaking-ba">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>
      `;
      responseDiv.textContent = 'Speaking...';
      animateSpeakingBars();
    } else if (state === 'saving') {
      stateIcon.src = chrome.runtime.getURL('icons/Vidya4b.png');
      stateIcon.alt = 'Saving';
      responseDiv.textContent = 'Saving profile...';
    } else if (state === 'ended') {
      stateIcon.src = chrome.runtime.getURL('icons/Vidya4b.png');
      stateIcon.alt = 'Waiting';
      responseDiv.textContent = "Recognition ended, waiting...";
    }
  }

  function animateSpeakingBars() {
    if (!toolti) return; // Exit if toolti is null
    const bars = toolti.querySelectorAll('.speaking-ba .bar');
    if (!bars.length) return;

    const animate = () => {
      bars.forEach((bar) => {
        const height = Math.random() * 20 + 10;
        bar.style.height = `${height}px`;
        bar.style.transition = 'height 0.1s ease';
      });
      if (isSpeaking && toolti) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  function askQuestion() {
    if (currentQuestion >= questions.length) {
      confirmSave(tempProfile);
      return;
    }

    questionDiv.textContent = questions[currentQuestion];
    questionDiv.style.color = '#333';
    updateVoiceUI('listening');
    retryCount = 0;

    console.log(`Asking question ${currentQuestion + 1}: "${questions[currentQuestion]}"`);
    speakText1(questions[currentQuestion], () => {
      console.log("Speech completed, waiting before recognition...");
      setTimeout(() => {
        console.log("Starting recognition...");
        listenForAnswer();
      }, 500);
    }, () => {
      console.log("Speech failed, retrying...");
      questionDiv.textContent = `Speech failed. Retrying: ${questions[currentQuestion]}`;
      questionDiv.style.color = '#d32f2f';
      setTimeout(askQuestion, 2000);
    });

    setupControlButtons();
  }

  function listenForAnswer() {
    startVoiceRecognition(
      (transcript) => {
        console.log(`Transcribed text: "${transcript}"`);
        updateVoiceUI('processi', transcript);
        const lowerTranscript = transcript.toLowerCase().trim();

        if (lowerTranscript === "go back" && currentQuestion > 0) {
          currentquestin--;
          console.log("Going back to previous question without saving current...");
          delete tempProfile[Object.keys(tempProfile)[currentQuestion]]; // Remove current answer
          askQuestion();
        } else if (lowerTranscript === "skip") {
          console.log("Skipping current question...");
          processVoiceAnswer("", currentQuestion);
          currentQuestion++;
          askQuestion();
        } else if (transcript.trim()) {
          processVoiceAnswer(transcript, currentQuestion);
          currentQuestion++;
          console.log("Processed answer, moving to next question...");
          setTimeout(askQuestion, 500);
        } else {
          handleNoInput();
        }
      },
      (error) => {
        console.log(`Recognition error: ${error}`);
        responseDiv.textContent = `Error: ${error}`;
        if (error === "no-speech" || error === "audio-capture") {
          handleNoInput();
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry ${retryCount}/${maxRetries} due to error: ${error}`);
          questionDiv.textContent = `Error: ${error}. Try again (${retryCount}/${maxRetries}).`;
          questionDiv.style.color = '#d32f2f';
          setTimeout(listenForAnswer, 2000);
        } else {
          console.log("Max retries reached, skipping due to error...");
          questionDiv.textContent = "Max retries reached. Skipping.";
          processVoiceAnswer("", currentQuestion);
          currentQuestion++;
          setTimeout(askQuestion, 2000);
        }
      }
    );
  }

  function handleNoInput() {
    if (retryCount < maxRetries) {
      retryCount++;
      console.log(`Retry ${retryCount}/${maxRetries}: No input detected`);
      questionDiv.textContent = `I didn’t hear you. Try again (${retryCount}/${maxRetries}).`;
      questionDiv.style.color = '#d32f2f';
      responseDiv.textContent = "Please speak again...";
      updateVoiceUI('listening');
      setTimeout(listenForAnswer, 1000);
    } else {
      console.log("Max retries reached, skipping...");
      questionDiv.textContent = "Max retries reached. Skipping.";
      processVoiceAnswer("", currentQuestion);
      currentQuestion++;
      setTimeout(askQuestion, 2000);
    }
  }

  function processVoiceAnswer(transcript, index) {
    let processedValue = transcript.trim();
    updateVoiceUI('processi', transcript);
    switch (index) {
      case 0: tempProfile.name = processedValue || "Unknown"; break;
      case 1:
        const age = wordToNumber(processedValue);
        tempProfile.age = (typeof age === "number" && age > 0 && age < 150) ? age : processedValue || "Unknown";
        break;
      case 2:
        const classMatch = processedValue.match(/(?:class|grade)?\s*(\d+|nine|ten|eleven|twelve)/i);
        tempProfile.class = classMatch ?
          wordToNumber(classMatch[1]).toString() :
          (wordToNumber(processedValue) >= 5 && wordToNumber(processedValue) <= 12 ?
            wordToNumber(processedValue).toString() : processedValue || "Unknown");
        break;
      case 3: tempProfile.language = processedValue || "Unknown"; break;
      case 4:
        tempProfile.role = processedValue.toLowerCase().includes('teacher') ? 'teacher' :
          (processedValue.toLowerCase().includes('student') ? 'student' :
            processedValue || "Unknown");
        break;
    }
    updateProfileDisplay(); // Update display after each answer
  }
  function updateProfileDisplay() {
    const profileDisplay = voiceContainer.querySelector('.profile-display') ||
      document.createElement('div');
    profileDisplay.className = 'profile-display';
    profileDisplay.style.cssText = `
      margin-bottom: 15px;
      padding: 10px;
      background: #f0f4f8;
      border-radius: 4px;
      color: #333;
    `;

    profileDisplay.innerHTML = `
      <h4 style="margin: 0 0 5px 0;">Current Profile:</h4>
      <p>Name: ${tempProfile.name || 'Not set'}</p>
      <p>Age: ${tempProfile.age || 'Not set'}</p>
      <p>Class: ${tempProfile.class || 'Not set'}</p>
      <p>Language: ${tempProfile.language || 'Not set'}</p>
      <p>Role: ${tempProfile.role || 'Not set'}</p>
    `;

    if (!voiceContainer.querySelector('.profile-display')) {
      voiceContainer.insertBefore(profileDisplay, voiceContainer.firstChild);
    }
  }
  function confirmSave(profile) {
    questionDiv.textContent = "Do you want to save this profile? Say yes or no.";
    updateVoiceUI('listening');
    console.log("Asking to save profile...");
    let retryAttempts = 0;
    const maxSpeechRetries = 3;

    function attemptSave() {
      speakText1("Do you want to save this profile? Say yes or no.", () => {
        startVoiceRecognition(
          (transcript) => {
            console.log(`Transcribed save response: "${transcript}"`);
            updateVoiceUI('processi', transcript);
            if (transcript.toLowerCase().includes('yes')) {
              updateVoiceUI('saving');
              userProfile = profile;
              chrome.storage.local.set({ userProfile }, () => {
                console.log("Profile saved:", userProfile);
                showProfileView();
                voiceContainer.style.display = 'none';
                const homeBtn = chatContainer.querySelector('.home-b');
                if (homeBtn) homeBtn.style.display = 'inline-block'; // Show home button after voice save
              });
            } else {
              console.log("Profile not saved.");
              questionDiv.textContent = "Profile not saved.";
              responseDiv.textContent = "Returning to settings...";
              setTimeout(() => {
                voiceContainer.style.display = 'none';
                settingsPanel.style.display = 'flex';
              }, 2000);
            }
          },
          (error) => {
            console.log(`Save recognition error: ${error}`);
            responseDiv.textContent = `Error: ${error}`;
            questionDiv.textContent = `Error: ${error}. Say yes or no again.`;
            questionDiv.style.color = '#d32f2f';
            setTimeout(attemptSave, 2000);
          }
        );
      }, () => {
        console.log("Speech failed in confirmSave, retrying...");
        if (retryAttempts < maxSpeechRetries) {
          retryAttempts++;
          console.log(`Speech retry attempt ${retryAttempts}/${maxSpeechRetries}`);
          setTimeout(attemptSave, 2000);
        } else {
          console.log("Max speech retries reached, aborting save.");
          questionDiv.textContent = "Failed to confirm save. Returning to settings.";
          setTimeout(() => {
            voiceContainer.style.display = 'none';
            settingsPanel.style.display = 'flex';
          }, 2000);
        }
      });
    }

    attemptSave();
  }

  function setupControlButtons() {
    const goBackBtn = voiceContainer.querySelector('.go-back-btn');
    const skipBtn = voiceContainer.querySelector('.skip-btn');

    goBackBtn.disabled = currentQuestion === 0;
    goBackBtn.removeEventListener('click', handleGoBack);
    skipBtn.removeEventListener('click', handleSkip);

    function handleGoBack() {
      if (currentQuestion > 0) {
        stopLiveAudio(() => {
          // Remove the current question's answer
          const keys = Object.keys(tempProfile);
          if (keys[currentQuestion]) {
            delete tempProfile[keys[currentQuestion]];
          }
          currentquestin--;
          updateProfileDisplay();
          askQuestion();
        });
      }
    }

    function handleSkip() {
      stopLiveAudio(() => {
        updateVoiceUI('processi', 'Skipped');
        processVoiceAnswer("", currentQuestion); // Set default value
        currentQuestion++;
        updateProfileDisplay();
        setTimeout(askQuestion, 500);
      });
    }

    goBackBtn.addEventListener('click', handleGoBack);
    skipBtn.addEventListener('click', handleSkip);
  }

  askQuestion();
}
function speakText1(text, onSuccess, onError) {
  if (!('speechSynthesis' in window)) {
    console.error("Speech Synthesis not supported in this browser");
    if (onError) onError("Speech Synthesis not supported");
    return;
  }

  console.log("Setting up speech synthesis for text:", text.substring(0, 50) + "...");

  // Split text into manageable chunks to improve reliability
  const splitTextIntoChunks = (text) => {
    const maxChunkLength = 150;
    const chunks = [];

    // Try to split on sentence boundaries first
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    if (sentences.length > 0) {
      let currentChunk = '';
      for (const sentence of sentences) {
        // If adding this sentence would exceed max length, save current chunk and start new one
        if (currentChunk.length + sentence.length > maxChunkLength) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      // Add the last chunk if exists
      if (currentChunk) chunks.push(currentChunk.trim());
    } else {
      // If no sentence boundaries, split by max length
      for (let i = 0; i < text.length; i += maxChunkLength) {
        chunks.push(text.substring(i, i + maxChunkLength).trim());
      }
    }

    // If we have no chunks (unlikely), use the whole text
    return chunks.length > 0 ? chunks : [text];
  };

  const speakChunks = (chunks) => {
    isSpeaking = true;
    let currentIndex = 0;

    const speakNextChunk = () => {
      if (currentIndex >= chunks.length) {
        console.log("All chunks spoken, speech complete");
        isSpeaking = false;
        currentUtterance = null;
        if (onSuccess) onSuccess();
        return;
      }

      // Create utterance for current chunk
      const utterance = new SpeechSynthesisUtterance(chunks[currentIndex]);
      currentUtterance = utterance;

      // Configure utterance
      utterance.lang = 'en-US';
      utterance.volume = 1.0;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Set up event handlers
      utterance.onstart = () => {
        console.log(`Started speaking chunk ${currentIndex + 1}/${chunks.length}`);
        isSpeaking = true;
      };

      utterance.onend = () => {
        console.log(`Finished speaking chunk ${currentIndex + 1}/${chunks.length}`);
        currentIndex++;
        speakNextChunk(); // Speak next chunk when this one finishes
      };

      utterance.onerror = (event) => {
        console.error("Speech error:", event);
        isSpeaking = false;
        currentUtterance = null;
        if (onError) onError(event.error || "Speech synthesis error");
      };

      // Start speaking
      console.log(`Speaking chunk ${currentIndex + 1}/${chunks.length}`);
      window.speechSynthesis.speak(utterance);
    };

    // Start with the first chunk
    speakNextChunk();
  };

  // Ensure any existing speech is stopped before starting new speech
  stopLiveAudio(() => {
    try {
      const chunks = splitTextIntoChunks(text);
      console.log(`Split text into ${chunks.length} chunks for speaking`);
      speakChunks(chunks);
    } catch (e) {
      console.error("Error setting up speech:", e);
      if (onError) onError(e.message || "Error preparing speech");
    }
  });
}
function setupAutoResizeTextarea() {
  document.querySelectorAll('textarea').forEach(textarea => {
    // Add this to ensure existing textareas get initialized
    if (!textarea.classList.contains('auto-resize-initialized')) {
      textarea.classList.add('auto-resize-initialized');

      // This handles both manual typing and programmatic changes
      const resize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
      };

      textarea.addEventListener('input', resize);

      // Add this to handle programmatic value changes
      const observer = new MutationObserver(resize);
      observer.observe(textarea, { attributes: true, childList: true, subtree: true });

      // Initial resize
      resize();
    }
  });
}

function startVoiceRecognition(inputElement, statusElement) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    statusElement.textContent = 'Voice input not supported in this browser';
    return;
  }

  // Stop any existing recognition
  if (recognition) {
    recognition.stop();
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    statusElement.textContent = 'Listening...';
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      } else {
        transcript += event.results[i][0].transcript;
      }
    }

    // Update input field with transcript
    inputElement.value = transcript;
    statusElement.textContent = transcript ? 'Got it!' : 'Listening...';

    // Auto-resize textarea
    inputElement.style.height = 'auto';
    inputElement.style.height = Math.min(inputElement.scrollHeight, 200) + 'px';
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    statusElement.textContent = `Error: ${event.error}`;
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 2000);
    isVoiceInputActive = false;
    document.querySelector('#voice-inpu-btn').innerHTML =
      `<img src="${chrome.runtime.getURL('icons/mic.png')}" alt="Voice Input" style="width: 24px; height: 24px;">`;
  };

  recognition.onend = () => {
    if (isVoiceInputActive) {
      recognition.start(); // Restart if still active
    }
  };

  recognition.start();
}



function saveSettings() {
  const name = chatContainer.querySelector('#name').value;
  const age = chatContainer.querySelector('#age').value;
  const classGrade = chatContainer.querySelector('#class').value;
  const language = chatContainer.querySelector('#language').value;
  const role = chatContainer.querySelector('#role').value;
  const image = chatContainer.querySelector('#profile-image').src;
  const autoNavigate = document.querySelector('#auto-navigate').checked;
  if (!name || !age || !classGrade || !language || !role) {
    alert('Please fill in all fields');
    return;
  }

  userProfile = { name, age, class: classGrade, language, role,autoNavigate, image };
  chrome.storage.local.set({ userProfile }, () => {
    console.log('Profile saved:', userProfile);
    showProfileView();
    const homeBtn = chatContainer.querySelector('.home-b');
    if (homeBtn) homeBtn.style.display = 'inline-block';

    // Refresh the toolba buttons when role changes
    const modeContent = chatContainer.querySelector('.vidy-mode-cont');
    const headerTitle = chatContainer.querySelector('#header-title');
    const currentMode = chatContainer.querySelector('.vidy-toolba-btn.active')?.getAttribute('data-mode') || 'support';
    switchMode(currentMode, modeContent, headerTitle);
  });
}
function showProfileView() {
  const profileView = chatContainer.querySelector('.profile-vie');
  const settingsPanel = chatContainer.querySelector('.settings-pane1');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');
  const inputDiv = chatContainer.querySelector('.chat-containe-input');

  profileView.innerHTML = `
    <div class="whatsapp-profile-vie" style="display: flex; flex-direction: column; padding: 15px; height: 100%; box-sizing: border-box; position: relative;">
      <button class="edit-profi" style="position: absolute; top: 10px; left: 80%; background: none; border: none; padding: 5px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: background 0.2s;">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#00a884">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
  <span style="color: #00a884; font-weight: bold; font-size: 20px; display: flex; align-items: center;">Edit</span>
</button>

      <div class="profile-image-container" style="text-align: center; margin: 20px 0; flex-shrink: 0;">
        <img src="${userProfile?.image || chrome.runtime.getURL('icons/default-profile.png')}" 
             alt="Profile" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto;">
      </div>
    <div class="profile-info" style="background: rgba(240, 244, 248, 0.7); padding: 10px 15px; border-radius: 8px; flex-grow: 1; overflow-y: auto; display: inline-block;">
  <h4 style="color: #00a884; margin: 0 0 10px 0; font-size: 16px;">${userProfile.name}</h4>
  <p style="color: #54656f; margin: 5px 0; font-size: 13px;"><strong>Age:</strong> ${userProfile.age}</p>
  <p style="color: #54656f; margin: 5px 0; font-size: 13px;"><strong>Class:</strong> ${userProfile.class}</p>
  <p style="color: #54656f; margin: 5px 0; font-size: 13px;"><strong>Language:</strong> ${userProfile.language}</p>
  <p style="color: #54656f; margin: 5px 0; font-size: 13px;"><strong>Role:</strong> ${userProfile.role}</p>
  <div class="profile-fieldd">
    <strong>Auto Navigation:</strong>
    <p>${userProfile?.autoNavigate !== false ? 'Enabled' : 'Disabled'}</p>
  </div>
</div>

    </div>
  `;

  profileView.style.display = 'flex';
  settingsPanel.style.display = 'none';
  messagesDiv.style.display = 'none';
  inputDiv.style.display = 'none';

  const editBtn = profileView.querySelector('.edit-profi');
  editBtn.addEventListener('click', () => {
    profileView.style.display = 'none';
    toggleSettingsPanel(true);
  });

  editBtn.addEventListener('mouseover', () => editBtn.style.background = '#e0e0e0');
  editBtn.addEventListener('mouseout', () => editBtn.style.background = 'none');
}
function toggleSettingsPanel(populateFields = false) {
  const settingsPanel = chatContainer.querySelector('.settings-pane1');
  const messagesDiv = chatContainer.querySelector('.chat-containe-messages');
  const inputDiv = chatContainer.querySelector('.chat-containe-input');
  const profileView = chatContainer.querySelector('.profile-vie');
  const voiceContainer = chatContainer.querySelector('.voice-inpu-container');

  if (!settingsPanel) {
    console.error('Settings panel not found');
    return;
  }

  if (settingsPanel.style.display === 'flex') {
    settingsPanel.style.display = 'none';
    messagesDiv.style.display = 'block';
    inputDiv.style.display = 'flex';
  } else {
    settingsPanel.innerHTML = `
      <div class="whatsapp-profile-settings" style="display: flex; flex-direction: column; padding: 15px; height: 100%; overflow-y: auto; box-sizing: border-box;">
        <div class="profile-header" style="display: flex; align-items: center; margin-bottom: 15px; flex-shrink: 0;">
          <div class="profile-image-container" style="position: relative; margin-right: 10px;">
            <img id="profile-image" src="${userProfile?.image || chrome.runtime.getURL('icons/default-profile.png')}" 
                 alt="Profile" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
            <input type="file" id="profile-image-input" accept="image/*" style="display: none;">
            <button id="change-image-btn" style="position: absolute; bottom: 0; right: 0; background: #00a884; border: none; 
                   border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
          <h3 style="color: #00a884; font-size: 16px; margin: 0;">Profile</h3>
        </div>
        <div class="profile-fieldd" style="margin-bottom: 10px; flex-shrink: 0;">
          <label style="color: #54656f; font-size: 12px; margin-bottom: 3px; display: block;">Name</label>
          <input type="text" id="name" placeholder="Enter your name" 
                 style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid #e0e0e0; font-size: 14px; outline: none; box-sizing: border-box;"
                 value="${populateFields && userProfile?.name ? userProfile.name : ''}">
        </div>
        <div class="profile-fieldd" style="margin-bottom: 10px; flex-shrink: 0;">
          <label style="color: #54656f; font-size: 12px; margin-bottom: 3px; display: block;">Age</label>
          <input type="number" id="age" placeholder="Enter your age" 
                 style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid #e0e0e0; font-size: 14px; outline: none; box-sizing: border-box;"
                 value="${populateFields && userProfile?.age ? userProfile.age : ''}">
        </div>
        <div class="profile-fieldd" style="margin-bottom: 10px; flex-shrink: 0;">
          <label style="color: #54656f; font-size: 12px; margin-bottom: 3px; display: block;">Class/Grade</label>
          <input type="text" id="class" placeholder="Enter your class" 
                 style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid #e0e0e0; font-size: 14px; outline: none; box-sizing: border-box;"
                 value="${populateFields && userProfile?.class ? userProfile.class : ''}">
        </div>
        <div class="profile-fieldd" style="margin-bottom: 10px; flex-shrink: 0;">
          <label style="color: #54656f; font-size: 12px; margin-bottom: 3px; display: block;">Native Language</label>
          <input type="text" id="language" placeholder="Enter your language" 
                 style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid #e0e0e0; font-size: 14px; outline: none; box-sizing: border-box;"
                 value="${populateFields && userProfile?.language ? userProfile.language : ''}">
        </div>
        <div class="profile-fieldd" style="margin-bottom: 15px; flex-shrink: 0;">
          <label style="color: #54656f; font-size: 12px; margin-bottom: 3px; display: block;">Role</label>
          <select id="role" style="width: 100%; padding: 8px; border: none; border-bottom: 1px solid #e0e0e0; font-size: 14px; outline: none; box-sizing: border-box;">
            <option value="">Select role</option>
            <option value="student" ${populateFields && userProfile?.role === 'student' ? 'selected' : ''}>student</option>
            <option value="teacher" ${populateFields && userProfile?.role === 'teacher' ? 'selected' : ''}>Teacher</option>
          </select>
        </div>
        <div style="margin-top: auto; flex-shrink: 0;">
          <button class="save-settings" style="background: #00a884; color: white; padding: 8px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; width: 100%;">Save</button>
          <button class="voice-setup" style="background: #e0e0e0; color: #54656f; padding: 8px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; width: 100%; margin-top: 10px;display:none;">Voice Setup</button>
        </div>
      </div>
    `;

    settingsPanel.style.display = 'flex';
    messagesDiv.style.display = 'none';
    inputDiv.style.display = 'none';
    profileView.style.display = 'none';
    voiceContainer.style.display = 'none';

    const imageInput = settingsPanel.querySelector('#profile-image-input');
    const imageBtn = settingsPanel.querySelector('#change-image-btn');
    const saveBtn = settingsPanel.querySelector('.save-settings');
    const voiceSetupBtn = settingsPanel.querySelector('.voice-setup');

    imageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = settingsPanel.querySelector('#profile-image');
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    saveBtn.addEventListener('click', saveSettings);
    voiceSetupBtn.addEventListener('click', startVoiceSettings);
  }

}
async function generateAIResponse(prompt, options = {}) {
  const { mode = 'support', type = '', details = {} } = options;

  let fullPrompt = '';
  switch (mode) {
    case 'chat':
      fullPrompt = prompt;
      break;
    case 'writingng':
      fullPrompt = `Generate a ${type} with the following details:\n- Topic: ${prompt}\n- Recipient: ${details.recipient || 'N/A'}`;
      break;
    case 'lessonon-plan':
      fullPrompt = `Create a detailed lessonon plan with:\n- Subject: ${details.subject || 'N/A'}\n- Grade: ${details.grade || 'N/A'}\n- Duration: ${details.duration || 'N/A'}\n- Instructions: ${prompt}`;
      break;
    case 'studydy-plan':
      fullPrompt = `Create a detailed studydy plan in table format with:\n- Class: ${details.class || 'N/A'}\n- Subject: ${details.subject || 'N/A'}\n- Topic: ${details.topic || prompt}\n- Timeline: ${details.timeline || 'N/A'}`;
      break;
    case 'summarizerer':
      fullPrompt = `summarizere the following text to ${details.level || 'intermediate'} level in ${details.paragraphs || 1} paragraph(s):\n${prompt}`;
      break;
  }

  try {
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response format');
    return data.response.trim();
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw error;
  }
}
// Add event listeners for Copy, Speaker, and Edit buttons
function addResponseoptionsListeners(container, includeRetry, retryCallback) {
  const copyBtn = container.querySelector('.cop-btn');
  const speakerBtn = container.querySelector('.speaker-btn');
  const editBtn = container.querySelector('.edit-btn');
  const retryBtn = includeRetry ? container.querySelector('.retry-btn') : null;
  const contentDiv = container.querySelector('.message-conte, .response-ccontent');
  let content = contentDiv.innerText;

  copyBtn.addEventListener('click', () => {
    const content = contentDiv.innerText || contentDiv.textContent;
    copyText(content, copyBtn);
  });

  speakerBtn.addEventListener('click', () => {
    const utterance = new SpeechSynthesisUtterance(content);
    window.speechSynthesis.speak(utterance);
  });

  editBtn.addEventListener('click', () => {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.width = '100%';
    textarea.style.height = 'auto';
    textarea.style.minHeight = '100px';
    contentDiv.replaceWith(textarea);
    textarea.focus();
    textarea.addEventListener('blur', () => {
      const newContent = textarea.value;
      const div = document.createElement('div');
      div.className = container.querySelector('textarea') ? 'message-conte' : 'response-ccontent';
      div.innerHTML = newContent;
      textarea.replaceWith(div);
      content = newContent; // Update content for copy/speak
    });
  });

  if (retryBtn) {
    retryBtn.addEventListener('click', retryCallback);
  }
}
async function sendSupportMessage(question, messagesDiv) {
  if (!question) return;
  addMessageToChat('user', question, messagesDiv);
  pageContentScraper.supportMessages.push({ sender: 'user', message: question });
  pageContentScraper.saveChatState();

  const aiMessageDiv = document.createElement('div');
  aiMessageDiv.className = 'chat-messa ai';
  aiMessageDiv.innerHTML = '<div class="message-conte"><p class="loadi">Generating...</p></div>';
  messagesDiv.appendChild(aiMessageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  //supportInput.dispatchEvent(new Event('input')); 
  try {
    const content = pageContentScraper.scrapePageContent();
    const chatHistory = pageContentScraper.supportMessages
      .slice(-4)
      .map(msg => `${msg.sender}: ${msg.message}`)
      .join('\n');

    const result = await new Promise(resolve => chrome.storage.local.get(['userProfile'], resolve));
    const userProfile = result.userProfile || { language: 'English', supportNeeded: true };

    // Enhanced user context extraction
    const userContext = {
      name: userProfile.username || 'User',
      language: userProfile.language || 'English',
      role: userProfile.role || 'student',
      classLevel: userProfile.class || '',
      age: userProfile.age || '',
      nativeLanguage: userProfile.language || 'English'
    };

    // Enhanced prompt with personalized structure
    const prompt = `
    
You are a support assistant for ${userContext.name}, a ${userContext.role} ${userContext.age ? 'aged ' + userContext.age : ''} 
${userContext.classLevel ? 'in ' + userContext.classLevel : ''} whose native language is ${userContext.nativeLanguage}.
Only say "hi" or "greetings" if the user's message is a related to greetings. Otherwise, do not include any greetings.

Your task is to:

1. FIRST provide a clear, concise answer to the user's question in simple ${userContext.nativeLanguage} that's easy to understand.
2. THEN analyze the webpage content and suggest relevant actions if needed.
3. FINALLY include any relevant links from the page (place these at the end).

Structure your response as follows:
- [Answer for ${userContext.name}]: Provide the main answer first, tailored for a ${userContext.role}
- [Suggested Actions]: Only if relevant, suggest actions like clicking buttons, filling forms, etc.
- [Related Links]: List any relevant links from the page (place these last)

Key requirements:
- Address the user by name if available (${userContext.name})
- Adjust complexity based on user's role (${userContext.role}) and class level (${userContext.classLevel})
- Keep answers simple and easy to understand in ${userContext.nativeLanguage}
- Place links at the end of the response
- For navigation actions, provide the full URL in the 'value' field
- For page elements, provide exact CSS selectors
- Never include markdown formatting
- If redirecting, do it in background without disrupting chat

Current Page Content:
${content}

Conversation History:
${chatHistory}

User Question: ${question}

Response Format (JSON):
{
  "answer": "Your clear, simple answer to the question, personalized for ${userContext.name}",
  "actions": [{
    "type": "click|scroll|highlight|navigate|fill",
    "selector": "CSS selector or null for navigate",
    "value": "Value to fill or URL for navigate",
    "background": true|false // Whether to do this without interrupting chat
  }],
  "links": ["Relevant links from page"],
  "recommendedQuestions": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;

    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    let responseObj;

    try {
      responseObj = JSON.parse(data.response);
      if (!responseObj.answer) throw new Error('Invalid response structure');

      // Format the answer with personalized elements
      let formattedAnswer = `[Answer] ${responseObj.answer}\n\n`;


      if (responseObj.actions?.length) {
        formattedAnswer += `[Suggested Actions]\n`;

        responseObj.actions.forEach(action => {
          formattedAnswer += `- ${action.type}: ${action.selector || action.value}\n`;
        });
        formattedAnswer += '\n';
      }

      if (responseObj.links?.length) {
        formattedAnswer += `[Related Links]\n`;
        responseObj.links.forEach(link => {
          formattedAnswer += `- ${link}\n`;
        });
      }

      responseObj.formattedAnswer = formattedAnswer;
    } catch (e) {
      console.error('Failed to parse API response:', e);
      responseObj = {
        formattedAnswer: data.response || 'Sorry, I encountered an error. Please try again.',
        recommendedQuestions: generateDefaultQuestions(userContext)
      };
    }

    // Generate personalized recommended questions if not provided
    if (!responseObj.recommendedQuestions || responseObj.recommendedQuestions.length === 0) {
      responseObj.recommendedQuestions = await generatePersonalizedQuestions(
        responseObj.answer,
        userContext
      );
    }

    let displayText = responseObj.answer;
    aiMessageDiv.remove();
    addMessageToChat('ai', displayText, messagesDiv, responseObj.recommendedQuestions);

    pageContentScraper.supportMessages.push({ sender: 'assistant', message: displayText });
    pageContentScraper.lastSupportRecommendedQuestions = responseObj.recommendedQuestions || [];
    pageContentScraper.lastAction = responseObj.actions?.[0] || null;
    await pageContentScraper.saveChatState();

    // Handle background actions

if (responseObj.actions?.length) {
  responseObj.actions.forEach(async action => {
    // Check if auto-navigation is enabled
    const shouldExecute = userProfile?.autoNavigate !== false;
    
    if (shouldExecute) {
      try {
        await pageContentScraper.executeAction(action);
      } catch (error) {
        console.error('Background action failed:', error);
      }
    }
  });
}


  } catch (error) {
    console.error('Support response error:', error);
    aiMessageDiv.innerHTML = `<div class="message-conte"><p class="erro">Error generating response: ${error.message}</p></div>`;
  }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  // In the sendSupportMessage function, after processing the message:
supportInput.value = '';
supportInput.style.height = '32px'; // Reset to initial height
supportInput.dispatchEvent(new Event('input')); // Trigger resize if needed
}
function generateDefaultQuestions(userContext) {
  let questions = [
    "Can you explain that in simpler terms?",
    "What should I do next?",
    "Is there more information about this?"
  ];

  // Personalize default questions based on user role
  if (userContext.role === 'student') {
    questions = [
      `Can you explain this like I'm in ${userContext.classLevel || 'school'}?`,
      "How can I use this for my studydies?",
      "Is there an example you can show me?"
    ];
  } else if (userContext.role === 'teacher') {
    questions = [
      "How can I explain this to my students?",
      "Are there teaching resources for this?",
      "What's the best way to demonstrate this?"
    ];
  }

  return questions;
}

async function generatePersonalizedQuestions(responseText, userContext) {
  try {
    const prompt = `
Generate 3 follow-up questions for ${userContext.name}, a ${userContext.role} 
${userContext.classLevel ? 'in ' + userContext.classLevel : ''} whose native language is ${userContext.nativeLanguage}.
The questions should be relevant to this response and tailored for a ${userContext.role}.

Response: "${responseText}"

Format as a JSON array:
["Question 1?", "Question 2?", "Question 3?"]
    `;

    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();

    if (!data || typeof data.response !== 'string') {
      return generateDefaultQuestions(userContext);
    }

    try {
      return JSON.parse(data.response);
    } catch (e) {
      console.error('Failed to parse questions:', e);
      return generateDefaultQuestions(userContext);
    }
  } catch (error) {
    console.error('Error generating personalized questions:', error);
    return generateDefaultQuestions(userContext);
  }
}
function addMessageToChat(role, content, messagesDiv, recommendedQuestions = []) {
  console.log('addMessageToChat called:', { role, content, recommendedQuestions });

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-messa ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-conte';
  contentDiv.innerHTML = content.replace(/\n/g, '<br>');
  messageDiv.appendChild(contentDiv);
  //Adding the response options before the recommended questions
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'response-coptions';
  optionsDiv.innerHTML = `
    <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:14px;height:14px;"></button>
    <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="speak" style="width:14px;height:14px;"></button>
    <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="edit" style="width:14px;height:14px;"></button>
    
  `;
  messageDiv.appendChild(optionsDiv);
  // Check if we have recommended questions either passed directly or from pageContentScraper
  const questionsToShow = recommendedQuestions.length > 0
    ? recommendedQuestions
    : (role === 'assistant' && pageContentScraper.lastSupportRecommendedQuestions?.length > 0)
      ? pageContentScraper.lastSupportRecommendedQuestions
      : [];

  console.log('Final questions to show:', questionsToShow);

  if (questionsToShow.length > 0) {
    console.log('Rendering recommended questions:', questionsToShow);
    const questionsDiv = document.createElement('div');
    questionsDiv.className = 'recommended-questionons';
    questionsDiv.style.marginTop = '10px';
    questionsDiv.style.display = 'block';

    const title = document.createElement('p');
    title.textContent = 'Recommended Questions:';
    title.style.fontSize = '12px';
    title.style.color = '#54656f';
    title.style.margin = '0 0 5px 0';
    questionsDiv.appendChild(title);

    questionsToShow.forEach((question, index) => {
      console.log(`Creating button for recommended question ${index + 1}:`, question);
      const btn = document.createElement('button');
      btn.className = 'recommended-questionon-btn';
      btn.textContent = question;
      btn.style.cssText = `
        display: block;
        width: 100%;
        text-align: left;
        padding: 5px 10px;
        margin: 5px 0;
        background: #f0f2f5;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        color: #54656f;
      `;
      btn.addEventListener('click', async () => {
        console.log(`Recommended question ${index + 1} clicked:`, question);
        questionsDiv.remove();
        await sendSupportMessage(question, messagesDiv);
      });
      questionsDiv.appendChild(btn);
    });

    messageDiv.appendChild(questionsDiv);
    console.log('Recommended questions div inserted:', questionsDiv.outerHTML);
  } else {
    console.log('Not rendering recommended questions:', { role, questionsToShow });
  }


  messagesDiv.appendChild(messageDiv);
  addResponseoptionsListeners(messageDiv, role === 'ai', () => sendChatMessage(null, content, messagesDiv));

  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 0);
}
async function sendChatMessage(role, content, messagesDiv) {
  if (!content) return;
  addMessageToChat('user', content, messagesDiv);
  pageContentScraper.chatMessages.push({ sender: 'user', message: content });
  pageContentScraper.saveChatState();

  const aiMessageDiv = document.createElement('div');
  aiMessageDiv.className = 'chat-messa ai';
  aiMessageDiv.innerHTML = '<div class="message-conte"><p class="loadi">Generating...</p></div>';
  messagesDiv.appendChild(aiMessageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    const response = await generateAIResponse(content, { mode: 'support' });
    const recommendedQuestions = await generateRecommendedQuestions(response); // Generate questions
    aiMessageDiv.innerHTML = `
      <div class="message-conte">${response}</div>
      <div class="response-coptions">
        <button class="cop-btn cop-response" title="Copy"><img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:14px;height:14px;"></button>
        <button class="speaker-btn" title="Speak"><img src="${chrome.runtime.getURL('icons/speak.png')}" alt="copy" style="width:14px;height:14px;"></button>
        <button class="edit-btn" title="Edit"><img src="${chrome.runtime.getURL('icons/edit.png')}" alt="copy" style="width:14px;height:14px;"></button>
        <button class="retry-btn" title="Retry"><img src="${chrome.runtime.getURL('icons/reload.png')}" alt="edit" style="width:14px;height:14px;"></button>
      </div>`;
    addMessageToChat('ai', response, messagesDiv, recommendedQuestions); // Pass recommended questions
    pageContentScraper.chatMessages.push({ sender: 'assistant', message: response });
    pageContentScraper.saveChatState();
  } catch (error) {
    console.error('Chat response error:', error);
    aiMessageDiv.innerHTML = `<div class="message-conte"><p class="erro">Error generating response: ${error.message}</p></div>`;
  }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  chatContainer.querySelector('.chat-containe-input input').value = '';
}

async function callOpenAIApi(selectedText, option) {
  const interactionContainer = toolti.querySelector('#interaction-container');
  interactionContainer.innerHTML = '<div class="loadi">Processing...</div>';

  try {
    // Await the user profile retrieval
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['userProfile'], resolve);
    });
    const userProfile = result.userProfile || {};
    let nativeLanguage = userProfile.language || 'English';
    nativeLanguage = languageMap[nativeLanguage.toLowerCase()] || nativeLanguage; // Normalize

    let prompt;
    switch (option) {
      case 'translate':
        prompt = `Translate this text to ${nativeLanguage}: "${selectedText}"`;
        break;
      case 'summarizere':
        prompt = `summarizere this text: "${selectedText}"`;
        break;
      case 'explain':
        prompt = `Explain this text: "${selectedText}"`;
        break;
      case 'definition':
        prompt = `Provide the definition of this text: "${selectedText}"`;
        break;
      default:
        prompt = `Respond to: "${selectedText}"`;
    }

    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response format');

    const responseContainer = document.createElement('div');
    responseContainer.id = 'response-ccontainer';
    interactionContainer.innerHTML = '';
    interactionContainer.appendChild(responseContainer);
    showResponse(data, selectedText);
  } catch (error) {
    console.error('Fetch error:', error);
    interactionContainer.innerHTML = `<div class="erro">Error: ${error.message}</div>`;
  }
}

// Language mapping (ensure this is defined above the function)
const languageMap = {
  'afrikaans': 'Afrikaans',
  'albanian': 'Albanian',
  'amharic': 'Amharic',
  'arabic': 'Arabic',
  'armenian': 'Armenian',
  'azerbaijani': 'Azerbaijani',
  'basque': 'Basque',
  'belarusian': 'Belarusian',
  'bengali': 'Bengali',
  'bosnian': 'Bosnian',
  'bulgarian': 'Bulgarian',
  'burmese': 'Burmese',
  'catalan': 'Catalan',
  'cebuano': 'Cebuano',
  'chinese_simplified': 'Chinese (Simplified)',
  'chinese_traditional': 'Chinese (Traditional)',
  'corsican': 'Corsican',
  'croatian': 'Croatian',
  'czech': 'Czech',
  'danish': 'Danish',
  'dutch': 'Dutch',
  'english': 'English',
  'esperanto': 'Esperanto',
  'estonian': 'Estonian',
  'finnish': 'Finnish',
  'french': 'French',
  'galician': 'Galician',
  'georgian': 'Georgian',
  'german': 'German',
  'greek': 'Greek',
  'gujarati': 'Gujarati',
  'haitian_creole': 'Haitian Creole',
  'hausa': 'Hausa',
  'hebrew': 'Hebrew',
  'hindi': 'Hindi',
  'hmong': 'Hmong',
  'hungarian': 'Hungarian',
  'icelandic': 'Icelandic',
  'igbo': 'Igbo',
  'indonesian': 'Indonesian',
  'irish': 'Irish',
  'italian': 'Italian',
  'japanese': 'Japanese',
  'javanese': 'Javanese',
  'kannada': 'Kannada',
  'kazakh': 'Kazakh',
  'khmer': 'Khmer',
  'korean': 'Korean',
  'kurdish': 'Kurdish',
  'kyrgyz': 'Kyrgyz',
  'lao': 'Lao',
  'latin': 'Latin',
  'latvian': 'Latvian',
  'lithuanian': 'Lithuanian',
  'luxembourgish': 'Luxembourgish',
  'macedonian': 'Macedonian',
  'malagasy': 'Malagasy',
  'malay': 'Malay',
  'malayalam': 'Malayalam',
  'maltese': 'Maltese',
  'maori': 'Maori',
  'marathi': 'Marathi',
  'mongolian': 'Mongolian',
  'nepali': 'Nepali',
  'norwegian': 'Norwegian',
  'pashto': 'Pashto',
  'persian': 'Persian',
  'polish': 'Polish',
  'portuguese': 'Portuguese',
  'punjabi': 'Punjabi',
  'romanian': 'Romanian',
  'russian': 'Russian',
  'samoan': 'Samoan',
  'serbian': 'Serbian',
  'sesotho': 'Sesotho',
  'shona': 'Shona',
  'sindhi': 'Sindhi',
  'sinhala': 'Sinhala',
  'slovak': 'Slovak',
  'slovenian': 'Slovenian',
  'somali': 'Somali',
  'spanish': 'Spanish',
  'sundanese': 'Sundanese',
  'swahili': 'Swahili',
  'swedish': 'Swedish',
  'tagalog': 'Tagalog',
  'tajik': 'Tajik',
  'tamil': 'Tamil',
  'telugu': 'Telugu',
  'thai': 'Thai',
  'turkish': 'Turkish',
  'ukrainian': 'Ukrainian',
  'urdu': 'Urdu',
  'uzbek': 'Uzbek',
  'vietnamese': 'Vietnamese',
  'welsh': 'Welsh',
  'xhosa': 'Xhosa',
  'yoruba': 'Yoruba',
  'zulu': 'Zulu',
  'other': 'Other'
};


function togglePin(option, selectedText, pinnedoptions) {
  const index = pinnedoptions.indexOf(option);
  const pinnedContainer = toolti.querySelector('.pinned-options');

  if (index === -1) {
    pinnedoptions.push(option);
    pinnedContainer.innerHTML += `
      <button class="pinned-option-btn" data-option="${option}" title="${option.charAt(0).toUpperCase() + option.slice(1)}">
        <img src="${chrome.runtime.getURL(`icons/${option}.png`)}" alt="${option}" style="width: 24px; height: 24px;">
      </button>
    `;
  } else {
    pinnedoptions.splice(index, 1);
    const pinnedBtn = pinnedContainer.querySelector(`[data-option="${option}"]`);
    if (pinnedBtn) pinnedBtn.remove();
  }

  const pinBtn = toolti.querySelector(`.pin-btn[data-option="${option}"]`);
  if (pinBtn) {
    pinBtn.classList.toggle('active');
    pinBtn.innerHTML = pinBtn.classList.contains('active') ?
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="#2196F3"><path d="M16 3l-8 8 4 4-8 8 2 2 8-8 4 4 8-8-2-2-8 8-4-4 8-8z"/></svg>' :
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="#888"><path d="M12 2l-2 8h-4l8 12 2-8h4l-8-12z"/></svg>';
  }

  const pinnedBtns = pinnedContainer.querySelectorAll('.pinned-option-btn');
  pinnedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const opt = btn.getAttribute('data-option');
      callOpenAIApi(selectedText, opt);
    });
  });

  chrome.storage.local.set({ pinnedoptions });
}

function createPinnedoption(option, selectedText) {
  return `
    <div class="pinned-option">
      <button class="option-btn" data-option="${option}">${option.charAt(0).toUpperCase() + option.slice(1)}</button>
      <button class="pin-btn" data-option="${option}" title="Unpin">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#2196F3">
          <path d="M17 3v6h-3l-1 6h-3l-1-6H7V3h10zm-2 14v4h-4v-4H9l3-3 3 3h-2z"/>
        </svg>
      </button>
    </div>
  `;
}
function showtoolti(e, selectedText) {
  if (toolti) toolti.remove();
  if (chatContainer) chatContainer.style.display = 'none';

  chrome.storage.local.get(['pinnedoptions'], (result) => {
    const pinnedoptions = result.pinnedoptions || [];
    toolti = document.createElement('div');
    toolti.className = 'custom-toolti';
    toolti.innerHTML = `
      <div class="button-row">
        <button class="ask-ai-btn" title="Ask AI">
          <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="AI">
        </button>
        <button class="cop-btn cop-response" title="Copy Text">
           <img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy">
        </button>
        <button class="speak-btn" title="Speak Text">
          <img src="${chrome.runtime.getURL('icons/speak.png')}" alt="copy">
        </button>
        <div class="pinned-options"></div>
        <button class="menu-btn" title="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#495057">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>
      <div class="menu-options" style="display: none;"></div>
      <div id="interaction-container" style="margin-bottom:2%;"></div>
    `;
    document.body.appendChild(toolti);

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    requestAnimationFrame(() => {
      const tooltiWidth = Math.min(toolti.offsetWidth, viewportWidth * 0.5);
      const tooltiHeight = toolti.offsetHeight;
      let topPosition = rect.bottom + scrollY + 5;
      let leftPosition = rect.left + scrollX;

      if (leftPosition + tooltiWidth > scrollX + viewportWidth - 10) {
        leftPosition = scrollX + viewportWidth - tooltiWidth - 10;
      }
      if (leftPosition < scrollX + 10) leftPosition = scrollX + 10;
      if (topPosition + tooltiHeight > scrollY + viewportHeight - 10) {
        topPosition = rect.top + scrollY - tooltiHeight - 5;
      }
      if (topPosition < scrollY + 10) topPosition = scrollY + 10;

      toolti.style.top = `${topPosition}px`;
      toolti.style.left = `${leftPosition}px`;
    });

    setupEventListeners(selectedText);
    setupMenuoptions(selectedText, pinnedoptions);

    document.addEventListener('mousedown', (e) => {
      if (toolti && !toolti.contains(e.target)) {
        stopLiveAudio(() => {
          toolti.remove();
          toolti = null;
          if (chatContainer) chatContainer.style.display = 'block';
        });
      }
    }, { once: true });
  });
}
function setupMenuoptions(selectedText, pinnedoptions) {
  const menuBtn = toolti.querySelector('.menu-btn');
  const menuoptions = toolti.querySelector('.menu-options');
  const options = [
    { name: 'Translate', icon: 'icons/translate.png' },
    { name: 'summarizere', icon: 'icons/summarizere.png' },
    { name: 'Explain', icon: 'icons/explain.png' },
    { name: 'Definition', icon: 'icons/definition.png' }
  ];

  if (!menuBtn || !menuoptions) return;

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const isVisible = menuoptions.style.display === 'flex';
    menuoptions.style.display = isVisible ? 'none' : 'flex';

    if (menuoptions.innerHTML === '' && !isVisible) {
      options.forEach(option => {
        const isPinned = pinnedoptions.includes(option.name.toLowerCase());
        menuoptions.innerHTML += `
          <div class="menu-option">
            <button class="option-btn" data-option="${option.name.toLowerCase()}">
              <img src="${chrome.runtime.getURL(option.icon)}" alt="${option.name}">
              ${option.name}
            </button>
            <button class="pin-btn ${isPinned ? 'active' : ''}" data-option="${option.name.toLowerCase()}" title="${isPinned ? 'Unpin' : 'Pin'}">
              ${isPinned ?
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="#2196F3"><path d="M16 3l-8 8 4 4-8 8 2 2 8-8 4 4 8-8-2-2-8 8-4-4 8-8z"/></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="#888"><path d="M12 2l-2 8h-4l8 12 2-8h4l-8-12z"/></svg>'}
            </button>
          </div>
        `;
      });

      // Adjust toolti position when menu-options are shown
      requestAnimationFrame(() => {
        const tooltiWidth = toolti.offsetWidth;
        const menuoptionsWidth = menuoptions.offsetWidth;
        const totalWidth = tooltiWidth + menuoptionsWidth + 8; // Include gap
        const currentLeft = parseFloat(toolti.style.left);

        if (currentLeft + totalWidth > scrollX + viewportWidth) {
          toolti.style.left = `${scrollX + viewportWidth - totalWidth - 5}px`;
        }
      });

      const optionBtns = menuoptions.querySelectorAll('.option-btn');
      optionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const option = btn.getAttribute('data-option');
          callOpenAIApi(selectedText, option);
          menuoptions.style.display = 'none';
        });
      });

      const pinBtns = menuoptions.querySelectorAll('.pin-btn');
      pinBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const option = btn.getAttribute('data-option');
          togglePin(option, selectedText, pinnedoptions);
        });
      });
    }
  };

  document.addEventListener('mousedown', (e) => {
    if (toolti && !toolti.contains(e.target)) {
      menuoptions.style.display = 'none';
    }
  }, { once: true });
}
function updateInteractionContainer(selectedText) {
  if (!toolti) return;
  const container = toolti.querySelector('#interaction-container') || document.createElement('div');
  container.id = 'interaction-container';
  container.innerHTML = `
    <div id="mode-cont"></div>
  `; // Removed mode-togg since text is default
  if (!toolti.querySelector('#interaction-container')) toolti.appendChild(container);
  updateModeContent(selectedText);
}
function updateModeContent(selectedText) {
  if (!toolti) return;
  const modeContent = toolti.querySelector('#mode-cont');
  if (!modeContent) return;

  if (isVoiceMode) {
    modeContent.innerHTML = `
      <div class="live-status-containe">
        <div class="ai-ico-wra">
          <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="AI" class="ai-ico listening">
        </div>
        <div class="live-contro">
          <button class="stop-live-btn" style="display:none !important;">Stop</button>
          <button class="cancel-voice-bt" style="
          background: #f44336;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0 16px;
          height: 40px;
          min-width: 100px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          Cancel
        </button>
        <button class="ask-again-b" style="
          background: #2196F3;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0 16px;
          height: 40px;
          min-width: 100px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          Ask Again
        </button>
        </div>
      </div>
    `;
    startLiveAudio(selectedText);

    // Add event listener for the Cancel button
    const cancelBtn = modeContent.querySelector('.cancel-voice-bt');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        stopLiveAudio(() => {
          isVoiceMode = false;
          updateModeContent(selectedText); // Switch back to text mode
        });
      });
    }
  } else {
    modeContent.innerHTML = `
      <div class="prompt-acti" style="margin-top:2%;">
        <input type="text" id="prompt-inpu" placeholder="Ask about '${selectedText.substring(0, 20)}...'">
        <button class="voice-mode-btn" title="Use Voice">
        <img src="${chrome.runtime.getURL('icons/mic.png')}"
        </button>
        <button class="submit-prompt"><img src="${chrome.runtime.getURL('icons/send.png')}" alt="Send"></button>
      </div>
      <div id="response-ccontainer"></div>
    `;
    setupTextModeListeners(selectedText);

    // Add event listener for the Microphone button
    const voiceBtn = modeContent.querySelector('.voice-mode-btn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        stopLiveAudio(() => {
          isVoiceMode = true;
          updateModeContent(selectedText); // Switch to voice mode
        });
      });
    }
  }
}
function cleanuptoolti() {
  if (!toolti) return;
  const buttons = toolti.querySelectorAll('button');
  buttons.forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  stopLiveAudio(() => {
    toolti.remove();
    toolti = null;
  });
}

function setupEventListeners(selectedText) {
  const askAiBtn = toolti.querySelector('.ask-ai-btn');
  const copyBtn = toolti.querySelector('.cop-btn');
  const speakBtn = toolti.querySelector('.speak-btn');
  const pinnedContainer = toolti.querySelector('.pinned-options');

  askAiBtn.addEventListener('click', () => {
    isVoiceMode = false; // Ensure text mode is default
    updateInteractionContainer(selectedText);
  });
  copyBtn.addEventListener('click', () => copyText(selectedText, copyBtn));
  speakBtn.addEventListener('click', () => speakText(selectedText));

  if (pinnedContainer) {
    const pinnedBtns = pinnedContainer.querySelectorAll('.pinned-option-btn');
    pinnedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const option = btn.getAttribute('data-option');
        callOpenAIApi(selectedText, option);
      });
    });
  }
}

function setupToggleListeners(selectedText) {
  if (!toolti) return;
  const toggleBtns = toolti.querySelectorAll('.toggle-b');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      stopLiveAudio(() => {
        const mode = btn.getAttribute('data-mode');
        isVoiceMode = mode === 'voice';
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateModeContent(selectedText);
      });
    });
  });
}

function setupTextModeListeners(selectedText) {
  if (!toolti) return;
  const submitBtn = toolti.querySelector('.submit-prompt');
  const promptInput = toolti.querySelector('#prompt-inpu');

  submitBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    await askAI(selectedText, prompt);
  });

  promptInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const prompt = promptInput.value.trim();
      if (!prompt) return;
      await askAI(selectedText, prompt);
    }
  });
}

async function startLiveAudio(selectedText) {
  if (!toolti) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const modeContent = toolti.querySelector('#mode-cont');
    if (modeContent) modeContent.innerHTML = '<div class="erro">Speech Recognition not supported</div>';
    return;
  }

  const listen = () => {
    stopLiveAudio(() => {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecording = true;
        if (toolti) updateVoiceUI(selectedText, 'listening');
      };

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('User said:', transcript);
        recognition.stop();
        await processSpeech(selectedText, transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        stopLiveAudio(() => {
          if (toolti) {
            const modeContent = toolti.querySelector('#mode-cont');
            if (modeContent) modeContent.innerHTML = `<div class="erro">Error: ${event.error}</div>`;
          }
        });
      };

      recognition.onend = () => {
        isRecording = false;
        if (!toolti) recognition = null;
      };

      recognition.start();
    });
  };

  listen(); // Start the first listening session
}
function stopLiveAudio(callback) {
  console.log("Stopping all audio and recognition");

  // Stop speech recognition if active
  if (recognition) {
    console.log("Stopping recognition");
    try {
      isRecording = false;
      recognition.abort(); // Force stop immediately
    } catch (e) {
      console.error("Error stopping recognition:", e);
    }
    recognition = null;
  }

  // Stop speech synthesis if active
  if (isSpeaking || window.speechSynthesis.speaking) {
    console.log("Canceling speech synthesis");
    try {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      currentUtterance = null;
    } catch (e) {
      console.error("Error canceling speech:", e);
    }
  }

  // Stop animation if active
  const bars = document.querySelectorAll('.speaking-ba .bar');
  if (bars.length > 0) {
    console.log("Stopping animation");
    bars.forEach(bar => {
      bar.style.transition = 'none';
      bar.style.height = '20px';
    });
  }

  // Allow a small delay for cleanup
  setTimeout(() => {
    if (callback && typeof callback === 'function') {
      console.log("Running callback");
      callback();
    }
  }, 100);
}

function updateVoiceUI(selectedText, state) {
  if (!toolti) return;
  const modeContent = toolti.querySelector('#mode-cont');
  if (!modeContent) return;

  let iconHTML = '';
  if (state === 'listening') {
    iconHTML = `
      <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="AI" class="ai-ico listening">
    `;
  } else if (state === 'loading') {
    iconHTML = `
      <img src="${chrome.runtime.getURL('icons/Vidya4b.png')}" alt="AI" class="ai-ico loading">
    `;
  } else if (state === 'speaking') {
    iconHTML = `
      <div class="speaking-ba">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    `;
  }

  modeContent.innerHTML = `
    <div class="live-status-containe">
      <div class="ai-ico-wra">
        ${iconHTML}
      </div>
      <div class="status-te">${state === 'listening' ? 'Listening...' : state === 'loading' ? 'Processing...' : 'Speaking...'}</div>
      <div class="live-contro">
      <button class="cancel-voice-bt" style="
      background: #f44336;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      height: 40px;
      min-width: 100px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      Cancel
    </button>
    <button class="ask-again-b" style="
      background: #2196F3;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0 16px;
      height: 40px;
      min-width: 100px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      Ask Again
    </button></div>
    </div>
  `;
  setupLiveControls(selectedText);

  if (state === 'speaking') {
    animateSpeakingBars();
  }
}
function animateSpeakingBars() {
  const bars = document.querySelectorAll('.speaking-ba .bar');
  if (!bars || bars.length === 0) {
    console.log("No speaking bars found to animate");
    return;
  }

  let animationFrameId = null;
  isSpeaking = true;

  const animate = () => {
    if (!isSpeaking || !document.contains(bars[0])) {
      console.log("Speech stopped or bars removed, ending animation");
      cancelAnimationFrame(animationFrameId);
      return;
    }

    bars.forEach((bar) => {
      if (document.contains(bar)) {
        const randomHeight = Math.floor(Math.random() * 50) + 10; // Random height between 10-60px
        bar.style.height = `${randomHeight}px`;
        bar.style.transition = 'height 0.15s ease';
      }
    });

    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
}
function setupLiveControls(selectedText) {
  if (!toolti) return;
  const cancelBtn = toolti.querySelector('.cancel-voice-bt');
  const askAgainBtn = toolti.querySelector('.ask-again-b');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      stopLiveAudio(() => {
        isVoiceMode = false;
        updateModeContent(selectedText); // Switch back to text mode
      });
    });
  }
  if (askAgainBtn) {
    askAgainBtn.addEventListener('click', () => {
      stopLiveAudio(() => {
        if (toolti) {
          updateVoiceUI(selectedText, 'listening');
          startLiveAudio(selectedText); // Restart listening
        }
      });
    });
  }
}

async function processSpeech(selectedText, transcript) {
  if (!toolti) return;
  updateVoiceUI(selectedText, 'loading');

  try {
    const fullPrompt = `Based on this text: "${selectedText}", respond to: "${transcript}"`;
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response format');

    if (toolti) {
      updateVoiceUI(selectedText, 'speaking');
      await speakResponse(data.response, selectedText);
      // After speaking, reset to listening
      if (toolti) updateVoiceUI(selectedText, 'listening');
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (toolti) {
      const modeContent = toolti.querySelector('#mode-cont');
      if (modeContent) modeContent.innerHTML = `<div class="erro">Error: ${error.message}</div>`;
    }
  }
}
function speakResponse(text, selectedText) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window) || !toolti) {
      reject('Speech Synthesis not supported or toolti missing');
      return;
    }
    if (!text || typeof text !== 'string') {
      reject('Invalid text');
      return;
    }

    stopLiveAudio(() => {
      const chunkSize = 200;
      const textChunks = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        textChunks.push(text.substring(i, i + chunkSize));
      }

      let chunkIndex = 0;

      function speakNextChunk() {
        if (chunkIndex >= textChunks.length || !toolti) {
          isSpeaking = false;
          currentUtterance = null;
          if (toolti) updateVoiceUI(selectedText, 'listening');
          resolve();
          return;
        }

        currentUtterance = new SpeechSynthesisUtterance(textChunks[chunkIndex]);
        currentUtterance.lang = 'en-US';
        currentUtterance.volume = 1.0;
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;

        currentUtterance.onstart = () => {
          isSpeaking = true;
          if (toolti) updateVoiceUI(selectedText, 'speaking');
        };
        currentUtterance.onend = () => {
          chunkIndex++;
          speakNextChunk();
        };
        currentUtterance.onerror = (event) => {
          console.error('Speech error:', event.error);
          isSpeaking = false;
          currentUtterance = null;
          reject(event.error);
        };

        window.speechSynthesis.speak(currentUtterance);
      }

      speakNextChunk();
    });
  });
}
// Improved speak text function
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    console.error("Speech Synthesis not supported in this browser");
    alert("Speech Synthesis is not supported in your browser");
    return;
  }

  console.log("Speaking text:", text.substring(0, 50) + "...");

  // Always cancel any ongoing speech first
  window.speechSynthesis.cancel();

  // Split text into manageable chunks
  const maxChunkLength = 150;
  const chunks = [];

  // Try to split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  if (sentences.length > 0) {
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    // Add the last chunk if exists
    if (currentChunk) chunks.push(currentChunk.trim());
  } else {
    // If no sentence boundaries, split by max length
    for (let i = 0; i < text.length; i += maxChunkLength) {
      chunks.push(text.substring(i, i + maxChunkLength).trim());
    }
  }

  // If we have no chunks (unlikely), use the whole text
  const textChunks = chunks.length > 0 ? chunks : [text];
  console.log(`Speaking text in ${textChunks.length} chunks`);

  let chunkIndex = 0;

  const speakNextChunk = () => {
    if (chunkIndex >= textChunks.length) {
      isSpeaking = false;
      currentUtterance = null;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textChunks[chunkIndex]);
    utterance.lang = 'en-US';
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      currentUtterance = utterance;
      console.log(`Speaking chunk ${chunkIndex + 1}/${textChunks.length}`);
    };

    utterance.onend = () => {
      console.log(`Finished chunk ${chunkIndex + 1}/${textChunks.length}`);
      chunkIndex++;
      speakNextChunk();
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event.error);
      isSpeaking = false;
      currentUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNextChunk();
}
function copyText(text, button = null) {
  console.log("Copying text to clipboard:", text.substring(0, 20) + "...");

  // Fallback for older browsers
  if (!navigator.clipboard) {
    return fallbackCopyText(text, button);
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      console.log("Text successfully copied");
      if (button) {
        showCopyFeedback(button, true);
      }
    })
    .catch(err => {
      console.error("Failed to copy text:", err);
      if (button) {
        showCopyFeedback(button, false);
      }
      // Fallback if clipboard API fails
      fallbackCopyText(text, button);
    });
}

function showCopyFeedback(button, success) {
  // Store original state
  const originalHTML = button.innerHTML;
  const originalClasses = button.className;

  // Set feedback state - only show icon, no text
  button.innerHTML = success ?
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="#4CAF50">
      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
    </svg>` :
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="#F44336">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>`;

  // Add success/error class
  button.className = originalClasses + (success ? ' cop-success' : ' cop-error');

  // Reset after delay
  setTimeout(() => {
    button.innerHTML = originalHTML;
    button.className = originalClasses;
  }, 1000); // Shorter duration (1 second)
}

function fallbackCopyText(text, button) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';  // Prevent scrolling to bottom
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const successful = document.execCommand('copy');
    if (button) {
      showCopyFeedback(button, successful);
    }
    if (!successful) throw new Error('Fallback copy failed');
  } catch (err) {
    console.error('Fallback copy failed:', err);
    if (button) {
      showCopyFeedback(button, false);
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

async function askAI(selectedText, prompt) {
  if (!toolti) return;
  const responseContainer = toolti.querySelector('#response-ccontainer');
  if (responseContainer) responseContainer.innerHTML = '<div class="loadi">Thinking...</div>';

  try {
    const fullPrompt = `Based on this text: "${selectedText}", respond to: "${prompt}"`;
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response format');

    showResponse(data, selectedText);
  } catch (error) {
    if (toolti && responseContainer) responseContainer.innerHTML = `<div class="erro">Error: ${error.message}</div>`;
  }
}
function showResponse(data, selectedText) {
  if (!toolti) return;
  const responseContainer = toolti.querySelector('#response-ccontainer');
  if (!responseContainer) return;

  const formattedResponse = data.response
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/### (.*?)(?=\n|$)/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  responseContainer.innerHTML = `
      <div class="response-ccontent">${formattedResponse}</div>
      <div class="response-cactio">
          <button class="cop-btn cop-response" title="Copy">
              <img src="${chrome.runtime.getURL('icons/copy.png')}" alt="copy" style="width:14px;height:14px;">
          </button>
          <button class="speak-response">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#495057">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
          </button>
          <button class="retry-response">
              <img src="${chrome.runtime.getURL('icons/reload.png')}" alt="retry" style="width:14px;height:14px;">
          </button>
          
      </div>
  `;

  // Attach listeners directly to ensure DOM is ready
  const copyBtn = responseContainer.querySelector('.cop-btn.cop-response');
  const retryBtn = responseContainer.querySelector('.retry-response');
  const speakBtn = responseContainer.querySelector('.speak-response');
  const responseText = responseContainer.querySelector('.response-ccontent').textContent;

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      console.log('Copy button clicked in showResponse');
      copyText(responseText, copyBtn);
    });
  } else {
    console.error('Copy button not found in showResponse');
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const promptInput = toolti.querySelector('#prompt-inpu');
      if (promptInput) askAI(selectedText, promptInput.value);
      else {
        const lastoption = toolti.querySelector('.menu-option .option-btn:focus')?.getAttribute('data-option') || 'translate';
        callOpenAIApi(selectedText, lastoption);
      }
    });
  }

  if (speakBtn) {
    speakBtn.addEventListener('click', () => speakText(responseText));
  }
}
function setupResponseListeners(selectedText) {
  if (!toolti) return;
  const responseContainer = toolti.querySelector('#response-ccontainer');
  if (!responseContainer) return;
  const copyBtn = toolti.querySelector('.cop-response');
  const retryBtn = toolti.querySelector('.retry-response');
  const speakBtn = toolti.querySelector('.speak-response');
  let continueBtn = toolti.querySelector('.continue-chat');
  const responseText = toolti.querySelector('.response-ccontent').textContent;

  if (continueBtn) {
    const newContinueBtn = continueBtn.cloneNode(true);
    continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
    continueBtn = newContinueBtn;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      console.log('Copy button clicked'); // Debug log
      copyText(responseText, copyBtn);
    });
  } else {
    console.error('Copy button not found in setupResponseListeners');
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const promptInput = toolti.querySelector('#prompt-inpu');
      if (promptInput) askAI(selectedText, promptInput.value);
      else {
        const lastoption = toolti.querySelector('.menu-option .option-btn:focus')?.getAttribute('data-option') || 'translate';
        callOpenAIApi(selectedText, lastoption);
      }
    });
  }
  if (speakBtn) speakBtn.addEventListener('click', () => speakText(responseText));
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      stopLiveAudio(() => {
        if (toolti) {
          toolti.remove();
          toolti = null;
        }
        conversationHistory = [{ role: "assistant", content: responseText }];
        if (chatContainer) {
          chatContainer.remove();
          chatContainer = null;
        }
        createChatContainer(); // Create the chat container
        returnToChatMode(); // Explicitly switch to chat mode
      });
    });
  }
}
function showChatSidebar(selectedText, previousResponse = null) {
  if (chatContainer) {
    conversationHistory = previousResponse ? [{ role: "assistant", content: previousResponse.response }] : [];
    createChatContainer();
    return;
  }

  if (chatSidebar) chatSidebar.remove();
  chatSidebar = document.createElement('div');
  chatSidebar.className = 'chat-sideba';
  conversationHistory = previousResponse ? [{ role: "assistant", content: previousResponse.response }] : [];
  chatSidebar.innerHTML = `
    <div class="chat-heade">
      <h3>AI Chat</h3>
      <button class="close-chat"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="chat-conte">${previousResponse ? `<div class="ai-messag">${previousResponse.response}</div>` : ''}</div>
    <div class="chat-inpu">
      <input type="text" placeholder="Continue the conversation...">
      <button class="send-chat">Send</button>
    </div>
  `;
  document.body.appendChild(chatSidebar);
  const closeBtn = chatSidebar.querySelector('.close-chat');
  const sendBtn = chatSidebar.querySelector('.send-chat');
  const input = chatSidebar.querySelector('input');
  closeBtn.addEventListener('click', () => { chatSidebar.remove(); chatSidebar = null; });
  sendBtn.addEventListener('click', () => sendChatMessage(selectedText, input.value));
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(selectedText, input.value); });
}

document.addEventListener('DOMContentLoaded', () => {
  pageContentScraper.loadChatState().then(() => {
    if (pageContentScraper.isChatOpen && pageContentScraper.currentMode === 'support') {
      createChatContainer();
    }
  });
});


const observer = new MutationObserver(() => {
  const chatContainer = document.querySelector('.vidy-chat-containe');
  if (chatContainer) {
    chatContainer.style.zIndex = '2147483647';
    chatContainer.style.overflow = 'visible';
  }
});
observer.observe(document.body, { attributes: true, childList: true, subtree: true });



async function generateRecommendedQuestions(responseText) {
  try {
    const prompt = `
        Based on the following response, generate 3 short follow-up questions that a user might ask to continue the conversation. Return the questions in JSON format as an array of strings. Ensure the questions are concise, relevant, and encourage further interaction about the response content.
  
        Response: "${responseText}"
  
        Response Format:
        ["Question 1?", "Question 2?", "Question 3?"]
      `;
    const response = await fetch('https://ai.learneng.app/LearnEng/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response format');

    return JSON.parse(data.response);
  } catch (error) {
    console.error('Error generating recommended questions:', error);
    return [
      "Can you provide more details?",
      "What else should I know about this?",
      "How can I proceed further?"
    ];
  }
}

document.addEventListener('DOMContentLoaded', setupAutoResizeTextarea);