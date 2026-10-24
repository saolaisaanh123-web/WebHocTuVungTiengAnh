// These are display labels for existing metadata, not inferred word classes.
// Keep the stored label and vocabulary content version unchanged.
const labels = new Map<string, string>([
  ["noun", "Danh từ"],
  ["verb", "Động từ"],
  ["adjective", "Tính từ"],
  ["adverb", "Trạng từ"],
  ["pronoun", "Đại từ"],
  ["preposition", "Giới từ"],
  ["conjunction", "Liên từ"],
  ["determiner", "Từ hạn định"],
  ["article", "Mạo từ"],
  ["number", "Số từ"],
  ["interjection", "Thán từ"],
  ["exclamation", "Thán từ"],
  ["modal verb", "Động từ khuyết thiếu"],
  ["phrasal verb", "Cụm động từ"],
  ["noun phrase", "Cụm danh từ"],
  ["verb phrase", "Cụm động từ"],
  ["prepositional phrase", "Cụm giới từ"],
  ["phrase", "Cụm từ"],
  ["idiom", "Thành ngữ"],
  ["clause", "Mệnh đề"],
  ["abbreviation", "Từ viết tắt"],
  ["expression", "Cách diễn đạt"],
]);

const aliases = new Map<string, string>([
  ["n.", "noun"],
  ["v.", "verb"],
  ["adj.", "adjective"],
  ["adv.", "adverb"],
  ["pron.", "pronoun"],
  ["prep.", "preposition"],
  ["conj.", "conjunction"],
  ["det.", "determiner"],
  ["num.", "number"],
  ["interj.", "interjection"],
  ["exclam.", "exclamation"],
]);

// A phrasal verb is a verb category. The other phrase/idiom labels describe
// a construction or expression, rather than claiming a single part of speech.
const expressionKinds = new Set([
  "noun phrase",
  "verb phrase",
  "prepositional phrase",
  "phrase",
  "idiom",
  "clause",
  "abbreviation",
  "expression",
]);

function displayKey(value?: string): string {
  const normalized = (value || "").trim().replace(/\s+/g, " ").toLowerCase();
  return aliases.get(normalized) || normalized;
}

export function formatPartOfSpeech(value?: string): string {
  const original = (value || "").trim();
  if (!original) return "Chưa khai báo từ loại";
  const key = displayKey(original);
  const label = labels.get(key);
  // Custom or mixed labels remain the author's text; never guess or split.
  return label ? `${label} · ${key}` : original;
}

export function partOfSpeechCaption(value?: string): string {
  return expressionKinds.has(displayKey(value)) ? "Dạng từ / cụm" : "Từ loại";
}
