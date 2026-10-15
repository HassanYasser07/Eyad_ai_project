/**
 * Splits text into complete sentences based on sentence-ending punctuation.
 *
 * Rules:
 * - Splits on: . ? ! … ؟ (Arabic ?) ! (Arabic !)
 * - Does NOT split on commas (Arabic ، or English ,) — commas stay inside the sentence.
 * - Protects decimal numbers (3.14) and dotted abbreviations (U.S.A.) from being split.
 * - Quotes and internal punctuation stay within their sentence.
 * - A long text with no sentence-ending punctuation is treated as one sentence.
 *
 * This is a pure local function — no AI requests, no credits.
 *
 * @param {string} text - The text to segment.
 * @returns {string[]} Array of complete sentences.
 */
export function splitIntoSentences(text) {
  const value = String(text || "").trim();
  if (!value) return [];

  // Protect decimal numbers (3.14, 2.5) and dotted abbreviations (U.S.A.)
  // by temporarily replacing dots that sit between digits or word characters.
  const protectedText = value
    .replace(/(\d)\.(\d)/g, "$1\u0000$2")
    .replace(/([A-Za-z])\.(?=[A-Za-z])/g, "$1\u0000");

  // Split on sentence-ending punctuation (. ? ! … ؟) followed by whitespace.
  // Commas (، ,) are intentionally NOT included — they do not end a sentence.
  const parts = protectedText.split(/([.?!…؟]+)\s+/);

  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const segment = (parts[i] || "") + (parts[i + 1] || "");
    const restored = segment.replace(/\u0000/g, ".").trim();
    if (restored) sentences.push(restored);
  }

  return sentences;
}

export default splitIntoSentences;