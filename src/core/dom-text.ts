export function extractNodePlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return Array.from(node.childNodes).map(extractNodePlainText).join("");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  if (element.tagName === "BR") {
    return "\n";
  }

  return Array.from(element.childNodes).map(extractNodePlainText).join("");
}

export function extractRootPlainText(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .filter((node) => node.nodeType !== Node.TEXT_NODE || (node.textContent?.trim() ?? "") !== "")
    .map(extractNodePlainText)
    .join("\n");
}
