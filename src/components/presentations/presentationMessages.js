/** User-facing messages for backend / Gamma error codes. */
const MESSAGES = {
  AUTH_LOGIN_REQUIRED: { ar: "سجّل الدخول بحساب دائم لإنشاء العروض التقديمية.", en: "Sign in with a permanent account to create presentations." },
  ACCOUNT_REQUIRED: { ar: "إنشاء العروض متاح للحسابات المسجلة فقط.", en: "Presentation generation is available to registered accounts only." },
  INVALID_SESSION: { ar: "انتهت الجلسة. أعد تسجيل الدخول ثم حاول مرة أخرى.", en: "Your session expired. Sign in again and retry." },
  NETWORK_ERROR: { ar: "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.", en: "Could not reach the server. Check your connection and retry." },
  REQUEST_TIMEOUT: { ar: "استغرق الطلب وقتًا طويلًا. أعد المحاولة.", en: "The request took too long. Please retry." },
  GAMMA_API_KEY_MISSING: { ar: "خدمة إنشاء العروض غير مفعّلة بعد (مفتاح Gamma غير مضبوط على الخادم).", en: "Presentation service is not configured yet (Gamma key missing on the server)." },
  GAMMA_AUTH_FAILED: { ar: "رفضت Gamma مفتاح الخدمة. يجب مراجعة إعدادات المفتاح على الخادم.", en: "Gamma rejected the service key. The server key needs to be checked." },
  GAMMA_CREDITS_EXHAUSTED: { ar: "رصيد حساب Gamma لا يكفي حاليًا. حاول لاحقًا.", en: "The Gamma account has no credits left right now. Try again later." },
  GAMMA_RATE_LIMITED: { ar: "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.", en: "Too many requests. Wait a moment and retry." },
  GAMMA_REJECTED_REQUEST: { ar: "رفضت Gamma بعض إعدادات الطلب.", en: "Gamma rejected some of the request settings." },
  GAMMA_UNAVAILABLE: { ar: "خدمة Gamma غير متاحة مؤقتًا. أعد المحاولة بعد قليل.", en: "Gamma is temporarily unavailable. Please retry shortly." },
  GAMMA_GENERATION_FAILED: { ar: "لم تتمكن Gamma من إنهاء العرض.", en: "Gamma could not finish the presentation." },
  GENERATION_TIMEOUT: { ar: "استغرق إنشاء العرض وقتًا أطول من الحد المسموح.", en: "The presentation took longer than the allowed time." },
  GENERATION_NOT_FOUND: { ar: "لم يعد طلب التوليد موجودًا لدى Gamma. أعد إنشاء العرض.", en: "Gamma no longer has this generation. Create the presentation again." },
  TOO_MANY_ACTIVE_JOBS: { ar: "لديك عروض قيد الإنشاء بالفعل. انتظر اكتمالها ثم حاول مجددًا.", en: "You already have presentations being created. Wait for them to finish." },
  REQUEST_IN_PROGRESS: { ar: "هذا الطلب قيد المعالجة بالفعل.", en: "This request is already being processed." },
  VALIDATION_FAILED: { ar: "راجع الحقول المحددة وصحّحها.", en: "Please review and fix the highlighted fields." },
  JOB_CREATE_FAILED: { ar: "تعذر تسجيل طلب الإنشاء. أعد المحاولة.", en: "Could not register the request. Please retry." },
};

const FIELD_MESSAGES = {
  REQUIRED: { ar: "هذا الحقل مطلوب.", en: "This field is required." },
  TOO_LONG: { ar: "النص أطول من الحد المسموح.", en: "This text is too long." },
  INVALID: { ar: "قيمة غير صالحة.", en: "Invalid value." },
  UNSUPPORTED_LANGUAGE: { ar: "هذه اللغة غير مدعومة في Gamma. جرّب اسمًا آخر (مثل: الإيطالية، التركية، اليابانية).", en: "This language is not supported by Gamma. Try another (e.g. Italian, Turkish, Japanese)." },
};

export function errorMessage(code, loc, detail = "") {
  const entry = MESSAGES[code] || { ar: "تعذر إنشاء العرض التقديمي. حاول مرة أخرى.", en: "Could not create the presentation. Please try again." };
  const base = loc(entry);
  return detail && (code === "GAMMA_REJECTED_REQUEST") ? `${base} (${detail})` : base;
}

export function fieldMessage(code, loc) {
  return loc(FIELD_MESSAGES[code] || FIELD_MESSAGES.INVALID);
}
