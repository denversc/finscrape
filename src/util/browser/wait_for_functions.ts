export function elementBySelectorAndTextContent(
  selector: string,
  expectedTextContent: string,
): Element | undefined {
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (
      typeof element.textContent === "string" &&
      element.textContent.trim() === expectedTextContent
    ) {
      return element;
    }
  }
  return undefined;
}
