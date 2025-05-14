export function elementBySelectorAndTextContent(selector: string, expectedTextContent: string): Element | null {
  const elements = document.querySelectorAll(selector)
  for (const element of elements) {
    if (element.textContent === expectedTextContent) {
      return element;
    }
  }
  return null;
}
