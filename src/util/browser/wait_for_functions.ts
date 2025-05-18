export function elementBySelectorAndTextContent(
  selector: string,
  expectedTextContent: string,
): Element | undefined {
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (
      typeof element.textContent === "string" &&
      element.textContent.toLowerCase().trim() === expectedTextContent.toLowerCase().trim()
    ) {
      return element;
    }
  }
  return undefined;
}
