// ==UserScript==
// @name           Drag from Web Content
// @description    Allows dragging the browser window from the top portion of web content
// @author         Zen Community
// @version        1.0.0
// @namespace      https://github.com/zen-browser/desktop
// ==/UserScript==

/* eslint-env es6, browser */
/* global Services, gBrowser */

(function() {
  'use strict';

  // Preferences
  const PREF_ENABLED = 'zen.dragwebcontent.enabled';
  const PREF_HEIGHT = 'zen.dragwebcontent.height';
  const PREF_THRESHOLD = 'zen.dragwebcontent.drag-threshold';
  const PREF_DISABLE_FULLSCREEN = 'zen.dragwebcontent.disable-in-fullscreen';

  // Interactive elements that should NOT trigger window dragging
  const INTERACTIVE_ELEMENTS = new Set([
    'a', 'button', 'input', 'textarea', 'select', 'label',
    'video', 'audio', 'canvas', 'iframe', 'object', 'embed'
  ]);

  // Interactive roles that should NOT trigger window dragging
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio',
    'slider', 'spinbutton', 'textbox', 'searchbox', 'switch'
  ]);

  // State
  let dragState = null;

  // Wait for the window to be ready
  if (window.gBrowserInit && window.gBrowserInit.delayedStartupFinished) {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }

  function init() {
    console.log('[DragFromWebContent] Initializing');

    // Add event listeners to each browser as tabs are created/selected
    setupBrowserListeners();

    // Listen for tab events
    gBrowser.tabContainer.addEventListener('TabOpen', handleTabEvent);
    gBrowser.tabContainer.addEventListener('TabSelect', handleTabEvent);

    // Cleanup on window unload
    window.addEventListener('unload', cleanup, { once: true });
  }

  function setupBrowserListeners() {
    const browsers = document.querySelectorAll('browser[type="content"]');
    browsers.forEach(browser => {
      attachBrowserListeners(browser);
    });
  }

  function handleTabEvent(event) {
    setTimeout(() => {
      const browser = gBrowser.getBrowserForTab(event.target);
      if (browser) {
        attachBrowserListeners(browser);
      }
    }, 100);
  }

  function attachBrowserListeners(browser) {
    if (!browser || browser._zenDragListenersAttached) {
      return;
    }

    try {
      // Mark as attached to avoid duplicates
      browser._zenDragListenersAttached = true;

      // We need to add listeners to the content window
      // Use a message manager approach for e10s compatibility
      if (browser.messageManager) {
        injectContentScript(browser);
      }
    } catch (e) {
      console.error('[DragFromWebContent] Error attaching listeners:', e);
    }
  }

  function injectContentScript(browser) {
    // Inject a frame script that will handle content-side events
    const frameScript = `
      (function() {
        const INTERACTIVE_ELEMENTS = new Set([
          'a', 'button', 'input', 'textarea', 'select', 'label',
          'video', 'audio', 'canvas', 'iframe', 'object', 'embed'
        ]);

        const INTERACTIVE_ROLES = new Set([
          'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio',
          'slider', 'spinbutton', 'textbox', 'searchbox', 'switch'
        ]);

        let dragStartPos = null;

        function isInteractiveElement(element) {
          if (!element || element === document.documentElement || element === document.body) {
            return false;
          }

          // Check element tag
          const tagName = element.tagName?.toLowerCase();
          if (INTERACTIVE_ELEMENTS.has(tagName)) {
            return true;
          }

          // Check role attribute
          const role = element.getAttribute('role');
          if (role && INTERACTIVE_ROLES.has(role)) {
            return true;
          }

          // Check if element has click handlers or is contenteditable
          if (element.onclick || element.hasAttribute('onclick')) {
            return true;
          }

          if (element.isContentEditable) {
            return true;
          }

          // Check if element has cursor pointer (usually clickable)
          const computedStyle = content.getComputedStyle(element);
          if (computedStyle.cursor === 'pointer') {
            return true;
          }

          // Check parent elements (up to 3 levels)
          let parent = element.parentElement;
          let depth = 0;
          while (parent && depth < 3) {
            const parentTag = parent.tagName?.toLowerCase();
            if (INTERACTIVE_ELEMENTS.has(parentTag)) {
              return true;
            }
            const parentRole = parent.getAttribute('role');
            if (parentRole && INTERACTIVE_ROLES.has(parentRole)) {
              return true;
            }
            parent = parent.parentElement;
            depth++;
          }

          return false;
        }

        function handleMouseDown(event) {
          // Only handle left mouse button
          if (event.button !== 0) {
            return;
          }

          // Get preferences from parent
          sendAsyncMessage('ZenDragWebContent:GetPrefs', {});
          
          addMessageListener('ZenDragWebContent:Prefs', function onPrefs(msg) {
            removeMessageListener('ZenDragWebContent:Prefs', onPrefs);
            
            const { enabled, height, threshold, disableInFullscreen } = msg.data;

            if (!enabled) {
              return;
            }

            // Check if in fullscreen
            if (disableInFullscreen && content.fullScreen) {
              return;
            }

            // Check if click is in the top draggable area
            const clickY = event.clientY;
            if (clickY > height) {
              return;
            }

            // Check if clicking on an interactive element
            if (isInteractiveElement(event.target)) {
              return;
            }

            // Store initial position for threshold check
            dragStartPos = {
              x: event.screenX,
              y: event.screenY,
              threshold: threshold
            };

            // Add temporary listeners for movement and release
            content.addEventListener('mousemove', handleMouseMove, true);
            content.addEventListener('mouseup', handleMouseUp, true);
          });
        }

        function handleMouseMove(event) {
          if (!dragStartPos) {
            return;
          }

          const deltaX = Math.abs(event.screenX - dragStartPos.x);
          const deltaY = Math.abs(event.screenY - dragStartPos.y);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Check if movement exceeds threshold
          if (distance >= dragStartPos.threshold) {
            // Threshold exceeded, initiate window drag
            event.preventDefault();
            event.stopPropagation();

            sendAsyncMessage('ZenDragWebContent:StartDrag', {
              screenX: event.screenX,
              screenY: event.screenY
            });

            // Clean up
            cleanup();
          }
        }

        function handleMouseUp(event) {
          // Mouse released before threshold, don't drag
          cleanup();
        }

        function cleanup() {
          dragStartPos = null;
          content.removeEventListener('mousemove', handleMouseMove, true);
          content.removeEventListener('mouseup', handleMouseUp, true);
        }

        // Add main mousedown listener
        content.addEventListener('mousedown', handleMouseDown, true);

      })();
    `;

    try {
      // Load the frame script
      browser.messageManager.loadFrameScript(
        'data:application/javascript;charset=utf-8,' + encodeURIComponent(frameScript),
        false
      );

      // Listen for messages from content
      browser.messageManager.addMessageListener('ZenDragWebContent:GetPrefs', (msg) => {
        const enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
        const height = Services.prefs.getIntPref(PREF_HEIGHT, 60);
        const threshold = Services.prefs.getIntPref(PREF_THRESHOLD, 5);
        const disableInFullscreen = Services.prefs.getBoolPref(PREF_DISABLE_FULLSCREEN, true);

        browser.messageManager.sendAsyncMessage('ZenDragWebContent:Prefs', {
          enabled,
          height,
          threshold,
          disableInFullscreen
        });
      });

      browser.messageManager.addMessageListener('ZenDragWebContent:StartDrag', (msg) => {
        // Initiate window drag from chrome
        try {
          const { screenX, screenY } = msg.data;
          
          // Create a synthetic mouse event to trigger window drag
          const mouseEvent = new MouseEvent('mousedown', {
            screenX: screenX,
            screenY: screenY,
            clientX: screenX,
            clientY: screenY,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true
          });

          // Use window drag API
          if (typeof window.beginWindowMove === 'function') {
            window.beginWindowMove(mouseEvent);
          } else if (window.windowUtils) {
            // Fallback method
            try {
              window.windowUtils.beginWindowMove(mouseEvent);
            } catch (e) {
              console.warn('[DragFromWebContent] Could not start window drag:', e);
            }
          }
        } catch (e) {
          console.error('[DragFromWebContent] Error starting drag:', e);
        }
      });

    } catch (e) {
      console.error('[DragFromWebContent] Error injecting content script:', e);
    }
  }

  function cleanup() {
    console.log('[DragFromWebContent] Cleaning up');
    
    const browsers = document.querySelectorAll('browser[type="content"]');
    browsers.forEach(browser => {
      if (browser._zenDragListenersAttached) {
        browser._zenDragListenersAttached = false;
      }
    });
  }

})();
