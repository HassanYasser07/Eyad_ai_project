/**
 * Turns the Company Profile form into the generation request used by the existing presentation pipeline
 * (usePresentationGeneration -> eyad-presentation edge function). Nothing here talks to the network:
 * it only builds the `topic` text (a full brief + slide-by-slide plan) and the settings payload.
 */
import { AUTO, LIMITS } from "@/config/presentationOptions";
import { PROFILE_GROUPS, PROFILE_TONES, PROFILE_AUDIENCES, clampSlideCount } from "@/config/companyProfileOptions";

const FIELD_CAP = 4000;
const val = (form, key) => String(form?.[key] ?? "").trim().slice(0, FIELD_CAP);
const lines = (text) => String(text || "").split(/\r?\n|[؛;]/).map((l) => l.replace(/^[\s\-•*·\d.)]+/, "").trim()).filter(Boolean);
const has = (form, ...keys) => keys.some((key) => val(form, key));

/**
 * Slide catalog. `order` = position in the finished deck, `priority` = which slides survive when the
 * requested count is small (lower = kept first). `needs` = the slide is only planned when one of these fields is filled.
 */
const CATALOG = [
  { id: "cover", titleAr: "الغلاف", order: 0, priority: 0, title: "Cover", brief: "Company name, tagline, industry line and a strong hero visual. Leave a clear area for the logo." },
  { id: "about", titleAr: "من نحن", order: 1, priority: 1, title: "About Us", brief: "Who the company is, what it does, since when, where it is based and how large the team is." },
  { id: "vmv", titleAr: "الرؤية والرسالة والقيم", order: 2, priority: 5, title: "Vision, Mission & Values", brief: "Vision and mission statements with the core values as icon cards.", needs: ["vision", "mission", "values"], soft: true },
  { id: "timeline", titleAr: "مسيرتنا", order: 3, priority: 14, title: "Our Journey", brief: "Milestones as a clean timeline.", needs: ["story"] },
  { id: "services", titleAr: "خدماتنا", order: 4, priority: 2, title: "Our Services", brief: "Overview grid of all main services, each with an icon and a one-line description.", softNeeds: ["services", "industry"] },
  { id: "products", titleAr: "المنتجات والحلول", order: 6, priority: 17, title: "Products & Solutions", brief: "The company's products or solutions with short benefit statements.", needs: ["products"] },
  { id: "process", titleAr: "منهجية العمل", order: 7, priority: 8, title: "How We Work", brief: "The work methodology as numbered steps.", needs: ["process"] },
  { id: "sectors", titleAr: "القطاعات التي نخدمها", order: 8, priority: 9, title: "Sectors We Serve", brief: "Sectors or industries served, as an image-led grid.", needs: ["sectors"] },
  { id: "technology", titleAr: "الأدوات والتقنيات", order: 9, priority: 15, title: "Tools & Technology", brief: "Software, tools and technology used.", needs: ["technology"] },
  { id: "projects", titleAr: "أبرز المشاريع", order: 10, priority: 7, title: "Selected Projects", brief: "Notable projects with name, location and a short description.", needs: ["projects"] },
  { id: "stats", titleAr: "أرقام تتحدث", order: 11, priority: 6, title: "Numbers That Matter", brief: "Key numbers as large stat cards. Use ONLY the numbers provided.", needs: ["stats"] },
  { id: "clients", titleAr: "العملاء والشركاء", order: 12, priority: 11, title: "Clients & Partners", brief: "Clients and partners the company works with.", needs: ["clients", "partners"] },
  { id: "team", titleAr: "فريق القيادة", order: 13, priority: 12, title: "Leadership Team", brief: "Leadership names and roles.", needs: ["team"] },
  { id: "certs", titleAr: "الشهادات والجوائز", order: 14, priority: 10, title: "Certifications & Awards", brief: "Certifications, licences, accreditations and awards.", needs: ["certifications", "awards"] },
  { id: "testimonials", titleAr: "آراء العملاء", order: 15, priority: 16, title: "What Clients Say", brief: "Client testimonials exactly as provided.", needs: ["testimonials"] },
  { id: "why", titleAr: "لماذا نحن؟", order: 16, priority: 3, title: "Why Choose Us", brief: "The differentiators as 4–6 benefit cards.", softNeeds: ["differentiators"] },
  { id: "offices", titleAr: "مواقعنا", order: 17, priority: 18, title: "Our Locations", brief: "Headquarters and other offices.", needs: ["offices"] },
  { id: "contact", titleAr: "تواصل معنا", order: 99, priority: 4, title: "Contact Us", brief: "Phone, email, website, address and social links, with a short closing line.", contact: true },
];

// Extra slides to reach a high slide count without inventing facts: deeper treatment of real material.
const FILLERS = [
  { id: "quality", titleAr: "التزامنا بالجودة", title: "Our Commitment to Quality", brief: "How the company safeguards quality, based only on the provided data (no invented claims)." },
  { id: "approach", titleAr: "قيمتنا المضافة", title: "Our Value Proposition", brief: "What the client gains from working with the company, derived from the provided data." },
  { id: "partnership", titleAr: "كيف نبدأ معًا", title: "Working With Us", brief: "How a client engagement typically starts and what to expect, kept generic and truthful." },
];

/** Ordered slide plan for exactly `count` slides. */
export function buildSlidePlan(form, countInput) {
  const count = clampSlideCount(countInput);
  const wantContact = form?.includeContactSlide !== false;
  const serviceLines = lines(val(form, "services"));

  const candidates = CATALOG.filter((item) => {
    if (item.contact) return wantContact;
    if (item.needs) return has(form, ...item.needs) || false;
    if (item.softNeeds) return true; // core slides are always planned, even with thin data
    return true;
  }).map((item) => ({ ...item }));

  // one dedicated slide per service line (max 12), ranked just after the core slides
  serviceLines.slice(0, 12).forEach((line, index) => {
    const [name, ...rest] = line.split(/[:：—–]/);
    candidates.push({
      id: `service-${index + 1}`,
      order: 5 + index * 0.01,
      priority: 6.5 + index * 0.05,
      title: `Service: ${name.trim()}`,
      titleAr: `الخدمة: ${name.trim()}`,
      brief: rest.join(" ").trim() ? `Details provided: ${rest.join(" ").trim()}. Expand into scope, deliverables and benefits without inventing facts.` : "Scope, key deliverables and benefits of this service, kept truthful to the provided description.",
    });
  });

  const picked = [...candidates].sort((a, b) => a.priority - b.priority).slice(0, count);

  // too few real topics for the requested count -> add safe filler slides
  let fillerIndex = 0;
  while (picked.length < count && fillerIndex < FILLERS.length) {
    const filler = FILLERS[fillerIndex++];
    picked.push({ ...filler, order: 50 + fillerIndex, priority: 99 });
  }

  // still short (very high counts with thin data) -> a second, deeper slide for the richest topics, never new facts
  const expandable = picked.filter((item) => !["cover", "contact"].includes(item.id) && !String(item.id).startsWith("deep-"));
  let deepIndex = 0;
  const partOf = {};
  while (picked.length < count && expandable.length) {
    const parent = expandable[deepIndex % expandable.length];
    deepIndex += 1;
    partOf[parent.id] = (partOf[parent.id] || 1) + 1;
    const part = partOf[parent.id];
    picked.push({
      id: `deep-${parent.id}-${deepIndex}`,
      order: parent.order + 0.001 * deepIndex,
      priority: 100,
      title: `${parent.title} — Part ${part}`,
      titleAr: parent.titleAr ? `${parent.titleAr} — الجزء ${part}` : undefined,
      brief: `A deeper follow-up slide for "${parent.title}": expand the same provided facts with a different layout, never repeating the previous slide and never adding new facts.`,
    });
    if (deepIndex > 60) break;
  }

  const plan = picked.sort((a, b) => a.order - b.order);
  // a contact slide always closes the deck
  const contactAt = plan.findIndex((item) => item.contact);
  if (contactAt >= 0 && contactAt !== plan.length - 1) plan.push(plan.splice(contactAt, 1)[0]);
  return plan;
}

const labelOf = (list, value) => list.find((item) => item.value === value)?.en || value;

function dataSections(form) {
  const out = [];
  PROFILE_GROUPS.forEach((group) => {
    const rows = group.fields
      .map((field) => ({ field, text: val(form, field.key) }))
      .filter((row) => row.text);
    if (!rows.length) return;
    out.push(`## ${group.en}`);
    rows.forEach(({ field, text }) => {
      out.push(text.includes("\n") ? `${field.en}:\n${text}` : `${field.en}: ${text}`);
    });
    out.push("");
  });
  return out.join("\n");
}

/** The full brief sent as the presentation `topic`. */
export function buildProfileTopic(form, { brand = null, palette = null, arabicFont = null, englishFont = null } = {}) {
  const count = clampSlideCount(form?.slideCount);
  const plan = buildSlidePlan(form, count);
  const name = val(form, "companyName") || brand?.brand_name || "the company";
  const language = form?.language || "ar";
  const useBrand = form?.useBrand !== false;
  const swatches = useBrand && Array.isArray(palette?.swatches) ? palette.swatches.slice(0, 5) : [];

  const languageRule = language === "bilingual"
    ? "Language: bilingual. Every heading and key sentence appears in Arabic AND English, Arabic first and right-to-left, English underneath or beside it."
    : language === "en" ? "Language: write everything in English." : "Language: write everything in Arabic (right-to-left). Keep proper names and technical abbreviations in their original form.";

  const design = [
    `Design direction: a polished corporate COMPANY PROFILE brochure-style deck, ${labelOf(PROFILE_TONES, form?.tone).toLowerCase()} in tone, written for ${labelOf(PROFILE_AUDIENCES, form?.audience).toLowerCase()}.`,
    "Use a consistent grid, strong typographic hierarchy, large industry-relevant photography on the hero slides, icon-led cards for lists and big numbers for statistics. Keep text short and scannable; never fill a slide with long paragraphs.",
    "Keep a clean area on the cover and on the closing slide where the company logo will be placed.",
  ];
  if (swatches.length) design.push(`Brand colors (use these as the deck palette, primary first): ${swatches.join(", ")}.`);
  if (useBrand && (arabicFont?.name || englishFont?.name)) {
    design.push(`Brand typography: ${[englishFont?.name && `English — ${englishFont.name}`, arabicFont?.name && `Arabic — ${arabicFont.name}`].filter(Boolean).join("; ")}.`);
  }

  const rules = [
    "Content rules:",
    "- Use ONLY the company data below. Never invent numbers, client names, projects, certificates, awards, addresses or contact details.",
    "- When a topic has little data, write truthful, descriptive wording from what is known; never leave placeholders such as [insert] or lorem ipsum.",
    `- Produce exactly ${count} slides, one per line of the slide plan, in that order.`,
  ];
  if (val(form, "mustInclude")) rules.push(`- Must include: ${val(form, "mustInclude")}`);
  if (val(form, "avoid")) rules.push(`- Avoid: ${val(form, "avoid")}`);
  if (val(form, "extraInstructions")) rules.push(`- Additional instructions: ${val(form, "extraInstructions")}`);

  const planText = plan.map((item, index) => `${index + 1}. ${item.title} — ${item.brief}`).join("\n");

  return [
    `Create a professional company profile presentation for "${name}".`,
    "",
    languageRule,
    ...design,
    "",
    rules.join("\n"),
    "",
    "# SLIDE PLAN",
    planText,
    "",
    "# COMPANY DATA",
    dataSections(form),
  ].join("\n").trim().slice(0, LIMITS.topicMax);
}

export const PRESET_SLIDE_VALUES = [5, 10, 15, 20];
/** Nearest value the standard presentation settings accept (used only if the backend rejects a custom count). */
export const nearestPresetCount = (count) => String(PRESET_SLIDE_VALUES.reduce((best, v) => (Math.abs(v - count) < Math.abs(best - count) ? v : best), PRESET_SLIDE_VALUES[0]));

/** Settings in the exact shape the presentation service expects. */
export function buildProfileSettings(form, context, { file = null, presetCount = false } = {}) {
  const count = clampSlideCount(form?.slideCount);
  const language = form?.language === "bilingual" ? "ar" : (form?.language || AUTO);
  return {
    topic: buildProfileTopic(form, context),
    fileName: file?.name ? String(file.name).slice(0, 200) : "",
    fileText: file?.text ? String(file.text).slice(0, LIMITS.fileTextMax) : "",
    detail: form?.detail || "detailed",
    slideCount: presetCount ? nearestPresetCount(count) : String(count),
    language,
  };
}
