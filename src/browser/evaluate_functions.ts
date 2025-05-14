export function getTextContent(element: Element): string | undefined {
  if (typeof element !== "object" || element === null || !("textContent" in element)) {
    return undefined;
  }
  return element.textContent ?? undefined;
}
