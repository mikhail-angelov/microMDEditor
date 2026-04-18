const CHARS = "abcdefghijklmnopqrstuvwxyz";

export function generateId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => CHARS[b % 26])
    .join("");
}
