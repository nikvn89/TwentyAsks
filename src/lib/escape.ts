// React already escapes text children. Contract text is still passed through
// this before it is used anywhere outside a text child (titles, aria labels,
// copied summaries). The app never injects raw HTML (checked by tests/js/static.test.ts).
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
