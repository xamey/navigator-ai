// Logger helper
const logger = {
  debug: (message: string, ...data: any[]) =>
    console.debug(`[Filters] ${message}`, ...data),
  error: (message: string, error?: any) =>
    console.error(`[Filters] ${message}`, error),
};

export const unAcceptedLeafElementTagsSet = new Set<string>([
  "script",
  "style",
  "meta",
  "link",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
]);

export const tagWiseFilter = (elementTag: string) => {
  try {
    if (!elementTag) {
      logger.debug("Empty element tag provided to tagWiseFilter");
      return false;
    }

    const normalizedTag = elementTag.toLowerCase();
    logger.debug(`Checking tag filter for: ${normalizedTag}`);

    if (unAcceptedLeafElementTagsSet.has(normalizedTag)) {
      logger.debug(`Tag ${normalizedTag} is in unaccepted set`);
      return false;
    }

    logger.debug(`Tag ${normalizedTag} is accepted`);
    return true;
  } catch (error) {
    logger.error("Error in tagWiseFilter", error);
    return false; // Fail safe - reject elements that cause errors
  }
};

export function isElementVisible(element: Element): boolean {
  try {
    if (!element) {
      logger.debug("Null element provided to isElementVisible");
      return false;
    }

    logger.debug(`Checking visibility for ${element.tagName.toLowerCase()}`);

    if (!window) {
      logger.error("Window object not available");
      return false;
    }

    const style = window.getComputedStyle(element);

    const isVisible =
      element.clientWidth > 0 &&
      element.clientHeight > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none";

    logger.debug(`Element visibility result: ${isVisible}`);
    return isVisible;
  } catch (error) {
    logger.error("Error in isElementVisible", error);
    return false; // Fail safe - consider problematic elements as not visible
  }
}

/**
 * Checks if an element is the top element at its position.
 */
export const isTopElement = (element: Element) => {
  try {
    if (!element) {
      logger.debug("Null element provided to isTopElement");
      return false;
    }

    logger.debug(`Checking if ${element.tagName.toLowerCase()} is top element`);

    // Find the correct document context and root element
    let doc = element.ownerDocument;
    if (!doc) {
      logger.error("Unable to find owner document");
      return false;
    }

    // If we're in an iframe, elements are considered top by default
    if (doc !== window.document) {
      logger.debug("Element is in iframe - considering as top element");
      return true;
    }

    // For shadow DOM, we need to check within its own root context
    const shadowRoot = element.getRootNode();
    if (shadowRoot instanceof ShadowRoot) {
      logger.debug("Element is in shadow DOM");

      try {
        const rect = element.getBoundingClientRect();
        const point = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        logger.debug(`Checking point (${point.x}, ${point.y}) in shadow root`);

        // Use shadow root's elementFromPoint to check within shadow DOM context
        const topEl = shadowRoot.elementFromPoint(point.x, point.y);
        if (!topEl) {
          logger.debug("No element found at point in shadow DOM");
          return false;
        }

        // Check if the element or any of its parents match our target element
        let current: Element | null = topEl;
        while (current && !(current instanceof ShadowRoot)) {
          if (current === element) {
            logger.debug("Element is top element in shadow DOM");
            return true;
          }
          current = current.parentElement;
        }

        logger.debug("Element is not top element in shadow DOM");
        return false;
      } catch (e) {
        logger.error("Error checking element in shadow DOM", e);
        return true; // If we can't determine, consider it visible
      }
    }

    // Regular DOM elements
    try {
      const rect = element.getBoundingClientRect();
      const viewportExpansion = 0;

      // Calculate expanded viewport boundaries including scroll position
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const viewportTop = -viewportExpansion + scrollY;
      const viewportLeft = -viewportExpansion + scrollX;
      const viewportBottom = window.innerHeight + viewportExpansion + scrollY;
      const viewportRight = window.innerWidth + viewportExpansion + scrollX;

      // Get absolute element position
      const absTop = rect.top + scrollY;
      const absLeft = rect.left + scrollX;
      const absBottom = rect.bottom + scrollY;
      const absRight = rect.right + scrollX;

      // Skip if element is completely outside expanded viewport
      if (
        absBottom < viewportTop ||
        absTop > viewportBottom ||
        absRight < viewportLeft ||
        absLeft > viewportRight
      ) {
        logger.debug("Element is outside viewport");
        return false;
      }

      // For elements within expanded viewport, check if they're the top element
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Only clamp the point if it's outside the actual document
      const point = {
        x: centerX,
        y: centerY,
      };

      logger.debug(`Checking point (${point.x}, ${point.y}) in document`);

      if (
        point.x < 0 ||
        point.x >= window.innerWidth ||
        point.y < 0 ||
        point.y >= window.innerHeight
      ) {
        logger.debug("Element center is outside viewport - considering as top");
        return true; // Consider elements with center outside viewport as visible
      }

      const topEl = document.elementFromPoint(point.x, point.y);
      if (!topEl) {
        logger.debug("No element found at point");
        return false;
      }

      let current = topEl;
      while (current && current !== document.documentElement) {
        if (current === element) {
          logger.debug("Element is top element");
          return true;
        }
        current = current.parentElement as Element;
      }

      logger.debug("Element is not top element");
      return false;
    } catch (e) {
      logger.error("Error checking if regular DOM element is top", e);
      return true; // If we can't determine, consider it visible
    }
  } catch (error) {
    logger.error("Fatal error in isTopElement", error);
    return true; // Default to visible in case of errors
  }
};

/**
 * Checks if a text node is visible.
 */
export const isTextNodeVisible = (textNode: Text): boolean => {
  try {
    if (!textNode) {
      logger.debug("Null text node provided");
      return false;
    }

    logger.debug("Checking text node visibility");

    if (!document) {
      logger.error("Document object not available");
      return false;
    }

    // Create a range and get its bounding rect
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = range.getBoundingClientRect();

    if (!rect || !textNode.parentElement) {
      logger.debug("No bounding rect or parent element for text node");
      return false;
    }

    // Check visibility based on several factors
    const hasSize = rect.width !== 0 && rect.height !== 0;
    const isInViewport = rect.top >= 0 && rect.top <= window.innerHeight;

    let parentVisible = false;
    try {
      parentVisible = textNode.parentElement.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      });
    } catch (e) {
      logger.error("Error checking parent visibility", e);
      // Fall back to basic parent check if checkVisibility isn't supported
      const parentStyle = window.getComputedStyle(textNode.parentElement);
      parentVisible =
        parentStyle.display !== "none" &&
        parentStyle.visibility !== "hidden" &&
        parentStyle.opacity !== "0";
    }

    const isVisible = hasSize && isInViewport && parentVisible;

    logger.debug(
      `Text node visibility: ${isVisible} (hasSize: ${hasSize}, inViewport: ${isInViewport}, parentVisible: ${parentVisible})`
    );
    return isVisible;
  } catch (error) {
    logger.error("Error in isTextNodeVisible", error);
    return false; // Fail safe - consider problematic text nodes as not visible
  }
};

// Referred from browser-use (https://github.com/browser-use/browser-use)
export const isInteractiveElement = (element: Element) => {
  try {
    if (!element) {
      logger.debug("Null element provided to isInteractiveElement");
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    logger.debug(`Checking if ${tagName} is interactive`);

    // Immediately return false for body tag
    if (tagName === "body") {
      logger.debug("Body tag is not interactive");
      return false;
    }

    // Base interactive elements and roles
    const interactiveElements = new Set([
      "a",
      "button",
      "details",
      "embed",
      "input",
      "label",
      "menu",
      "menuitem",
      "object",
      "select",
      "textarea",
      "summary",
    ]);

    const interactiveRoles = new Set([
      "button",
      "menu",
      "menuitem",
      "link",
      "checkbox",
      "radio",
      "slider",
      "tab",
      "tabpanel",
      "textbox",
      "combobox",
      "grid",
      "listbox",
      "option",
      "progressbar",
      "scrollbar",
      "searchbox",
      "switch",
      "tree",
      "treeitem",
      "spinbutton",
      "tooltip",
      "a-button-inner",
      "a-dropdown-button",
      "click",
      "menuitemcheckbox",
      "menuitemradio",
      "a-button-text",
      "button-text",
      "button-icon",
      "button-icon-only",
      "button-text-icon-only",
      "dropdown",
      "combobox",
    ]);

    const role = element.getAttribute("role");
    const ariaRole = element.getAttribute("aria-role");
    const tabIndex = element.getAttribute("tabindex");

    // Add check for specific class
    const hasAddressInputClass = element.classList.contains(
      "address-input__container__input"
    );

    // Basic role/attribute checks
    const hasInteractiveRole =
      hasAddressInputClass ||
      interactiveElements.has(tagName) ||
      interactiveRoles.has(role || "") ||
      interactiveRoles.has(ariaRole || "") ||
      (tabIndex !== null &&
        tabIndex !== "-1" &&
        element.parentElement?.tagName.toLowerCase() !== "body") ||
      element.getAttribute("data-action") === "a-dropdown-select" ||
      element.getAttribute("data-action") === "a-dropdown-button";

    if (hasInteractiveRole) {
      logger.debug(`Element has interactive role: ${tagName}`);
      return true;
    }

    // Get computed style
    let style;
    try {
      style = window.getComputedStyle(element);
    } catch (styleError) {
      logger.error("Error getting computed style", styleError);
      // Continue with partial checks if style can't be retrieved
    }

    // Check for event listeners
    const hasClickHandler =
      element.getAttribute("onclick") !== null ||
      element.hasAttribute("ng-click") ||
      element.hasAttribute("@click") ||
      element.hasAttribute("v-on:click");

    // Helper function to safely get event listeners
    function getEventListeners(el: Element) {
      try {
        // Try to get listeners using Chrome DevTools API
        return (window as any).getEventListeners?.(el) || {};
      } catch (e) {
        logger.debug("getEventListeners not available, using fallback");
        // Fallback: check for common event properties
        const listeners = {};

        // List of common event types to check
        const eventTypes = [
          "click",
          "mousedown",
          "mouseup",
          "touchstart",
          "touchend",
          "keydown",
          "keyup",
          "focus",
          "blur",
        ];

        for (const type of eventTypes) {
          const handlerProp = `on${type}` as keyof Element;
          const handler = el[handlerProp];
          if (handler) {
            (listeners as Record<string, any>)[type] = [
              {
                listener: handler,
                useCapture: false,
              },
            ];
          }
        }

        return listeners as Record<
          string,
          Array<{ listener: any; useCapture: boolean }>
        >;
      }
    }

    // Check for click-related events on the element itself
    let listeners: Record<
      string,
      Array<{ listener: any; useCapture: boolean }> | undefined
    > = {};
    try {
      listeners = getEventListeners(element);
    } catch (listenerError) {
      logger.error("Error getting event listeners", listenerError);
      // Continue with partial checks if listeners can't be retrieved
    }

    const hasClickListeners =
      (typeof listeners["click"] !== "undefined" &&
        listeners["click"]?.length > 0) ||
      (typeof listeners["mousedown"] !== "undefined" &&
        listeners["mousedown"]?.length > 0) ||
      (typeof listeners["mouseup"] !== "undefined" &&
        listeners["mouseup"]?.length > 0) ||
      (typeof listeners["touchstart"] !== "undefined" &&
        listeners["touchstart"]?.length > 0) ||
      (typeof listeners["touchend"] !== "undefined" &&
        listeners["touchend"]?.length > 0);

    // Check for ARIA properties that suggest interactivity
    const hasAriaProps =
      element.hasAttribute("aria-expanded") ||
      element.hasAttribute("aria-pressed") ||
      element.hasAttribute("aria-selected") ||
      element.hasAttribute("aria-checked");

    // Check for form-related functionality
    const isFormRelated =
      element.hasAttribute("contenteditable") ||
      (style && style.userSelect !== "none");

    // Check if element is draggable
    const isDraggable = element.getAttribute("draggable") === "true";

    // Additional check to prevent body from being marked as interactive
    if (
      tagName === "body" ||
      element.parentElement?.tagName.toLowerCase() === "body"
    ) {
      logger.debug("Element is body or direct child of body - not interactive");
      return false;
    }

    const isInteractive =
      hasAriaProps || hasClickHandler || hasClickListeners || isDraggable;

    logger.debug(
      `Element interactivity: ${isInteractive} (ariaProps: ${hasAriaProps}, clickHandler: ${hasClickHandler}, clickListeners: ${hasClickListeners}, draggable: ${isDraggable})`
    );
    return isInteractive;
  } catch (error) {
    logger.error("Error in isInteractiveElement", error);
    return false; // Fail safe - consider problematic elements as not interactive
  }
};
