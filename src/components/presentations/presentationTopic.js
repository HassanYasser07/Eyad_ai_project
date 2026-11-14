/**
 * Turns the raw chat request into the actual presentation TOPIC.
 *   "عايز اعمل بريزنتيشن عن الذكاء الاصطناعي في التعليم" -> "الذكاء الاصطناعي في التعليم"
 *   "I want to make a presentation about solar energy"   -> "solar energy"
 * When the message is only a command with no real topic ("عايز اعمل عرض تقديمي", "... عن كذا"), is a QUESTION about the
 * feature ("عايز اعمل اسلايدات هل دا متاح عندكم"), or has no presentation word at all, the result is "", so the topic
 * box stays empty instead of being filled with the command/question itself.
 */
const L = "\\p{L}\\p{M}";
// Longest alternatives first. Covers common Arabic spellings (بريزنتيشن / برزنتيشن / بوربوينت / باوربوينت ...).
const NOUN = "(?:ال)?(?:عرض(?:\\s+ال)?\\s*تقديمي|عروض\\s+تقديمية|بر[ي]?زنت[ي]?ش[ي]?ن|بريزنتيشن|بور\\s?بوينت|باور\\s?بوينت|اسلايدات|سلايدات|شرائح|power\\s?point|presentations?|slide\\s?deck|slides?|deck|pptx?)";
const NOUN_RE = new RegExp(`(?<![${L}])${NOUN}(?![${L}])`, "iu");
const LEADING_CONNECTOR_RE = new RegExp(`^(?:(?:عن|حول|بخصوص|عن\\s+موضوع|في\\s+موضوع|موضوعه|موضوعها|يتكلم\\s+عن|يتحدث\\s+عن|about|on|regarding|covering|for|of|to)(?![${L}])\\s*[:\\-–—،,]?\\s*)+`, "iu");
// Availability / how-to wording after the noun means a question about the feature, not a topic.
const QUESTION_RE = new RegExp(`[؟?]|(?<![${L}])(?:هل|ازاي|إزاي|ازاى|كيف|كيفية|فين|أين|اين|متاح[ةه]?|متوفر[ةه]?|موجود[ةه]?|عندكم|how|where|available|do\\s+you)(?![${L}])`, "iu");
const PLACEHOLDER_RE = /^(?:كذا|كده|كدا|موضوع|something|xyz|x)?$/iu;

export function extractPresentationTopic(text = "") {
  const input = String(text || "").replace(/\s+/g, " ").trim();
  if (!input) return "";
  const m = NOUN_RE.exec(input);
  // No "presentation" word at all: this is not a command about a deck, so there is no topic to extract.
  if (!m) return "";
  let rest = input.slice(m.index + m[0].length).trim();
  rest = rest.replace(LEADING_CONNECTOR_RE, "").replace(/^[\s:\-–—،,.]+|[\s:\-–—،,]+$/gu, "").trim();
  // Ignore trailing/leading dots, dashes and symbols before deciding whether anything meaningful is left ("عن كذا ...").
  const core = rest.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  if (core.length < 3 || PLACEHOLDER_RE.test(core) || QUESTION_RE.test(rest)) return "";
  return rest;
}
