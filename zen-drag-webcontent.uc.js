// ==UserScript==
// @name           Drag from Web Content
// @description    Allows dragging the browser window from the top portion of web content
// @author         Bxth
// @version        1.0.0
// @namespace      https://github.com/Zylaah/zen-drag-from-webcontent
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
  const INTERACTIVE_SELECTORS = [
    'a', 'button', 'input', 'textarea', 'select', 'label',
    'video', 'audio', 'canvas', 'iframe', 'object', 'embed',
    '[contenteditable="true"]', '[onclick]', '[role="button"]',
    '[role="link"]', '[role="menuitem"]', '[role="tab"]',
    '[role="checkbox"]', '[role="radio"]', '[role="slider"]',
    '[role="spinbutton"]', '[role="textbox"]', '[role="searchbox"]',
    '[role="switch"]'
  ].join(',');

  // Track overlays per browser
  const overlayMap = new WeakMap();
  let dragState = null;

  // Wait for the window to be ready
  if (window.gBrowserInit && window.gBrowserInit.delayedStartupFinished) {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }

  function init() {
    console.log('[DragFromWebContent] Initializing');

    // Setup overlays for existing browsers
    updateAllBrowsers();

    // Listen for tab events
    gBrowser.tabContainer.addEventListener('TabOpen', handleTabEvent);
    gBrowser.tabContainer.addEventListener('TabSelect', handleTabEvent);

    // Listen for preference changes
    Services.prefs.addObserver('zen.dragwebcontent.', handlePrefChange);

    // Listen for fullscreen changes
    window.addEventListener('fullscreen', updateAllBrowsers);
    window.addEventListener('sizemodechange', updateAllBrowsers);

    // Cleanup on window unload
    window.addEventListener('unload', cleanup, { once: true });
  }

  function handlePrefChange() {
    updateAllBrowsers();
  }

  function handleTabEvent(event) {
    setTimeout(() => {
      const browser = gBrowser.getBrowserForTab(event.target);
      if (browser) {
        addOverlayToBrowser(browser);
      }
    }, 100);
  }

  function updateAllBrowsers() {
    const browsers = document.querySelectorAll('browser[type="content"]');
    browsers.forEach(browser => {
      addOverlayToBrowser(browser);
    });
  }

  function addOverlayToBrowser(browser) {
    if (!browser) return;

    // Check if enabled
    const enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
    if (!enabled) {
      removeOverlayFromBrowser(browser);
      return;
    }

    // Check if in fullscreen and should disable
    const disableInFullscreen = Services.prefs.getBoolPref(PREF_DISABLE_FULLSCREEN, true);
    if (disableInFullscreen && window.fullScreen) {
      removeOverlayFromBrowser(browser);
      return;
    }

    // Get or create overlay
    let overlay = overlayMap.get(browser);
    
    if (!overlay) {
      overlay = createOverlay(browser);
      overlayMap.set(browser, overlay);
    }

    // Update overlay properties
    updateOverlay(overlay);
  }

  function removeOverlayFromBrowser(browser) {
    const overlay = overlayMap.get(browser);
    if (overlay && overlay.parentNode) {
      overlay.remove();
      overlayMap.delete(browser);
    }
  }

  function createOverlay(browser) {
    console.log('[DragFromWebContent] Creating overlay for browser');

    // Find the browser's container
    const browserContainer = browser.closest('.browserContainer') || browser.parentNode;
    if (!browserContainer) {
      console.error('[DragFromWebContent] Could not find browser container');
      return null;
    }

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'zen-drag-webcontent-overlay';
    
    // Style the overlay
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: transparent;
      pointer-events: auto;
      cursor: grab;
    `;

    // Add event listener
    overlay.addEventListener('mousedown', (e) => handleOverlayMouseDown(e, browser, overlay));

    // Ensure container has position: relative
    const containerStyle = window.getComputedStyle(browserContainer);
    if (containerStyle.position === 'static') {
      browserContainer.style.position = 'relative';
    }

    // Insert overlay
    browserContainer.appendChild(overlay);

    return overlay;
  }

  function updateOverlay(overlay) {
    if (!overlay) return;

    const height = Services.prefs.getIntPref(PREF_HEIGHT, 60);
    overlay.style.height = `${height}px`;
  }

  function handleOverlayMouseDown(event, browser, overlay) {
    // Only handle left mouse button
    if (event.button !== 0) return;

    console.log('[DragFromWebContent] Overlay mousedown');

    // Get the threshold
    const threshold = Services.prefs.getIntPref(PREF_THRESHOLD, 5);

    // Check what element is underneath the overlay at this position
    const elementUnderneath = getElementUnderOverlay(browser, event.clientX, event.clientY);
    
    if (!elementUnderneath) {
      console.log('[DragFromWebContent] No element underneath, starting drag');
      startDragWithThreshold(event, overlay, threshold);
      return;
    }

    // Check if element is interactive
    if (isInteractiveElement(elementUnderneath)) {
      console.log('[DragFromWebContent] Interactive element detected, passing through');
      passEventToElement(event, elementUnderneath, overlay);
      return;
    }

    // Not interactive, start drag with threshold
    console.log('[DragFromWebContent] Non-interactive element, starting drag');
    startDragWithThreshold(event, overlay, threshold);
  }

  function getElementUnderOverlay(browser, clientX, clientY) {
    try {
      // Get the browser's content window
      const contentWindow = browser.contentWindow;
      if (!contentWindow) return null;

      // Convert client coordinates to content coordinates
      const rect = browser.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Get element at position in content
      const element = contentWindow.document.elementFromPoint(x, y);
      
      console.log('[DragFromWebContent] Element at point:', element?.tagName, element?.className);
      return element;
    } catch (e) {
      console.error('[DragFromWebContent] Error getting element at point:', e);
      return null;
    }
  }

  function isInteractiveElement(element) {
    if (!element || element === element.ownerDocument.documentElement || 
        element === element.ownerDocument.body) {
      return false;
    }

    try {
      // Check if element matches interactive selectors
      if (element.matches && element.matches(INTERACTIVE_SELECTORS)) {
        return true;
      }

      // Check computed style cursor
      const computedStyle = element.ownerDocument.defaultView.getComputedStyle(element);
      if (computedStyle.cursor === 'pointer') {
        return true;
      }

      // Check if contenteditable
      if (element.isContentEditable) {
        return true;
      }

      // Check parent elements (up to 3 levels)
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 3) {
        if (parent.matches && parent.matches(INTERACTIVE_SELECTORS)) {
          return true;
        }
        parent = parent.parentElement;
        depth++;
      }

      return false;
    } catch (e) {
      console.error('[DragFromWebContent] Error checking interactive element:', e);
      return false;
    }
  }

  function passEventToElement(event, element, overlay) {
    try {
      // Temporarily disable overlay pointer events
      overlay.style.pointerEvents = 'none';

      // Create and dispatch click event to the element
      const clickEvent = new element.ownerDocument.defaultView.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: element.ownerDocument.defaultView,
        detail: event.detail,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });

      element.dispatchEvent(clickEvent);

      // Re-enable overlay after a short delay
      setTimeout(() => {
        overlay.style.pointerEvents = 'auto';
      }, 100);

    } catch (e) {
      console.error('[DragFromWebContent] Error passing event to element:', e);
      overlay.style.pointerEvents = 'auto';
    }
  }

  function startDragWithThreshold(event, overlay, threshold) {
    // Store initial position
    dragState = {
      startX: event.screenX,
      startY: event.screenY,
      threshold: threshold,
      overlay: overlay
    };

    // Add temporary listeners for movement and release
    overlay.addEventListener('mousemove', handleDragMove, true);
    overlay.addEventListener('mouseup', handleDragEnd, true);
    overlay.style.cursor = 'grabbing';

    // Prevent default
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragMove(event) {
    if (!dragState) return;

    const deltaX = Math.abs(event.screenX - dragState.startX);
    const deltaY = Math.abs(event.screenY - dragState.startY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check if movement exceeds threshold
    if (distance >= dragState.threshold) {
      console.log('[DragFromWebContent] Threshold exceeded, starting window drag');
      
      // Start window drag
      try {
        if (typeof window.beginWindowMove === 'function') {
          window.beginWindowMove(event);
        } else if (window.windowUtils) {
          window.windowUtils.beginWindowMove(event);
        } else {
          console.warn('[DragFromWebContent] Window drag API not available');
        }
      } catch (e) {
        console.error('[DragFromWebContent] Error starting window drag:', e);
      }

      // Clean up
      cleanupDragState();
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnd(event) {
    console.log('[DragFromWebContent] Mouse released before threshold');
    cleanupDragState();
  }

  function cleanupDragState() {
    if (dragState && dragState.overlay) {
      dragState.overlay.removeEventListener('mousemove', handleDragMove, true);
      dragState.overlay.removeEventListener('mouseup', handleDragEnd, true);
      dragState.overlay.style.cursor = 'grab';
    }
    dragState = null;
  }

  function cleanup() {
    console.log('[DragFromWebContent] Cleaning up');
    
    // Remove all overlays
    const browsers = document.querySelectorAll('browser[type="content"]');
    browsers.forEach(browser => {
      removeOverlayFromBrowser(browser);
    });

    // Remove preference observer
    Services.prefs.removeObserver('zen.dragwebcontent.', handlePrefChange);

    // Cleanup any active drag state
    cleanupDragState();
  }

})();
