import { Action } from "../types";

export class ElementFinder {
  private isDebugMode = false;

  constructor(options?: { debug?: boolean }) {
    this.isDebugMode = options?.debug ?? false;
  }

  public setDebugMode(enable: boolean): void {
    this.isDebugMode = enable;
  }

  public async findElement(
    action: Action,
    retryCount = 0
  ): Promise<Element | null> {
    console.log(
      `Attempting to find element (attempt ${retryCount + 1})`,
      action
    );

    let element: Element | null = null;

    if (action.element_id) {
      element = document.getElementById(action.element_id);
      console.log(
        `Searching by ID "${action.element_id}": ${
          element ? "Found" : "Not found"
        }`
      );
    }

    if (!element && action.selector && action.selector.includes("#")) {
      try {
        const escapedSelector = this.escapeSelector(action.selector);
        element = document.querySelector(escapedSelector);
        console.log(
          `Searching by ID selector "${escapedSelector}": ${
            element ? "Found" : "Not found"
          }`
        );
      } catch (error) {
        console.error(`Error with ID selector "${action.selector}":`, error);
      }
    }

    if (!element && action.xpath_ref) {
      try {
        const result = document.evaluate(
          action.xpath_ref,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue as Element;
        console.log(
          `Searching by XPath "${action.xpath_ref}": ${
            element ? "Found" : "Not found"
          }`
        );
      } catch (error) {
        console.error(`Error evaluating XPath "${action.xpath_ref}":`, error);
      }
    }

    if (!element && action.selector && !action.selector.includes("#")) {
      try {
        const escapedSelector = this.escapeSelector(action.selector);
        element = document.querySelector(escapedSelector);
        console.log(
          `Searching by selector "${escapedSelector}": ${
            element ? "Found" : "Not found"
          }`
        );

        if (!element) {
          const genericSelector = action.selector.replace(/#[^.#\s[\]]+/g, "*");
          if (genericSelector !== action.selector) {
            const escapedGenericSelector = this.escapeSelector(genericSelector);
            console.log(`Trying generic selector: ${escapedGenericSelector}`);
            element = document.querySelector(escapedGenericSelector);
          }
        }
      } catch (error) {
        console.error(`Error with selector "${action.selector}":`, error);
      }
    }

    if (!element && (action.text || action.type === "click")) {
      const textToFind =
        action.text ||
        (action.selector?.includes("repositories") ? "Repositories" : "") ||
        (action.element_id?.includes("repositories") ? "Repositories" : "");

      if (textToFind) {
        console.log(`Trying to find element by text: "${textToFind}"`);

        const elementsWithText = Array.from(
          document.querySelectorAll(
            'a, button, [role="tab"], [role="button"], input[type="submit"], input[type="button"], .btn, nav li, [aria-label*="' +
              textToFind +
              '"], [title*="' +
              textToFind +
              '"]'
          )
        ).filter((el) => {
          const content = el.textContent?.trim().toLowerCase() || "";
          if (content.includes(textToFind.toLowerCase())) return true;

          for (const child of Array.from(el.children)) {
            if (
              child.textContent
                ?.trim()
                .toLowerCase()
                .includes(textToFind.toLowerCase())
            ) {
              return true;
            }
          }

          const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";
          const title = el.getAttribute("title")?.toLowerCase() || "";
          const alt = el.getAttribute("alt")?.toLowerCase() || "";
          const placeholder =
            el.getAttribute("placeholder")?.toLowerCase() || "";

          return (
            ariaLabel.includes(textToFind.toLowerCase()) ||
            title.includes(textToFind.toLowerCase()) ||
            alt.includes(textToFind.toLowerCase()) ||
            placeholder.includes(textToFind.toLowerCase())
          );
        });

        if (elementsWithText.length > 0) {
          const visibleElements = elementsWithText.filter((el) =>
            this.isElementVisible(el as Element)
          );
          element =
            visibleElements.length > 0
              ? (visibleElements[0] as Element)
              : (elementsWithText[0] as Element);
          console.log(`Found element by text content:`, element);
        }
      }
    }

    if (!element) {
      const iframes = document.querySelectorAll("iframe");
      for (let i = 0; i < iframes.length; i++) {
        try {
          const iframe = iframes[i];
          if (
            iframe &&
            (iframe.contentDocument || iframe.contentWindow?.document)
          ) {
            const iframeDoc =
              iframe.contentDocument || iframe.contentWindow?.document;

            if (iframeDoc) {
              if (action.element_id) {
                element = iframeDoc.getElementById(action.element_id);
                if (element) break;
              }

              if (action.selector) {
                try {
                  element = iframeDoc.querySelector(
                    this.escapeSelector(action.selector)
                  );
                  if (element) break;
                } catch (e) {
                  console.log(`Error with selector in iframe:`, e);
                }
              }
            }
          }
        } catch (error) {
          console.log(
            `Cannot access iframe content due to security restrictions`
          );
        }
      }
    }

    if (element && !this.isElementVisible(element)) {
      console.log("Element found but not visible, looking for alternatives");

      if (action.type === "click") {
        const parent = element.parentElement;
        if (parent) {
          const nearbyElements = Array.from(
            parent.querySelectorAll(
              'a, button, [role="button"], input[type="submit"]'
            )
          ).filter((el) => this.isElementVisible(el as Element));

          if (nearbyElements.length > 0) {
            element = nearbyElements[0] as Element;
            console.log(
              "Found nearby visible interactive element instead:",
              element
            );
          }
        }
      }
    }

    if (!element && retryCount < 3) {
      console.log(
        `Element not found, waiting and retrying (attempt ${retryCount + 1}/3)`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1))
      );
      return this.findElement(action, retryCount + 1);
    }

    return element;
  }

  public isElementVisible(element: Element): boolean {
    if (!element || !(element instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    const isInViewport =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    return true;
  }

  public async scrollToElement(element: Element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private escapeSelector(selector: string): string {
    if (
      selector.includes(":") ||
      selector.includes(".") ||
      selector.includes("#")
    ) {
      try {
        if (typeof CSS !== "undefined" && CSS.escape) {
          return selector
            .split(/\s+/)
            .map((part) => {
              if (part.startsWith("#") || part.startsWith(".")) {
                const prefix = part.charAt(0);
                const value = part.substring(1);
                return prefix + CSS.escape(value);
              }
              return part;
            })
            .join(" ");
        } else {
          return selector.replace(/(:)/g, "\\$1");
        }
      } catch (e) {
        console.error("Error escaping selector:", e);
        return selector;
      }
    }
    return selector;
  }
}
