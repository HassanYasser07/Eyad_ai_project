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
  TEMPLATE_NOT_FOUND: { ar: "هذا القالب لم يعد متاحًا. اختر قالبًا آخر أو أنشئ العرض بدونه.", en: "This template is no longer available. Pick another or create without one." },
  INVALID_TEMPLATE_ID: { ar: "قالب غير صالح.", en: "Invalid template." },
  PROJECT_CREATE_FAILED: { ar: "تعذر إنشاء مشروع للعرض. أعد المحاولة.", en: "Could not create a project for the presentation. Please retry." },
  FILE_UNAVAILABLE: { ar: "تعذر تحميل ملف العرض. أعد المحاولة بعد قليل.", en: "The presentation file could not be loaded. Please retry shortly." },
  FILE_INVALID: { ar: "ملف العرض غير صالح أو تالف.", en: "The presentation file is invalid or damaged." },
  FILE_TOO_LARGE: { ar: "ملف العرض كبير جدًا (الحد 100 ميجابايت).", en: "The presentation file is too large (100 MB max)." },
  VERSION_NOT_FOUND: { ar: "هذه النسخة لم تعد موجودة.", en: "This version no longer exists." },
  VERSIONS_LOAD_FAILED: { ar: "تعذر تحميل نسخ العرض.", en: "Could not load the presentation versions." },
  TOO_MANY_VERSIONS: { ar: "وصلت للحد الأقصى من النسخ لهذا العرض. استبدل نسخة موجودة بدل إنشاء نسخة جديدة.", en: "This presentation reached its version limit. Replace an existing version instead of creating a new one." },
  UPLOAD_FAILED: { ar: "تعذر رفع الملف. تحقق من الاتصال وأعد المحاولة.", en: "The file could not be uploaded. Check your connection and retry." },
  UPLOAD_NOT_AVAILABLE: { ar: "خدمة الحفظ غير متاحة الآن. أعد المحاولة.", en: "Saving is unavailable right now. Please retry." },
  UPLOAD_NOT_FOUND: { ar: "لم يصل الملف إلى الخادم. أعد المحاولة.", en: "The file did not reach the server. Please retry." },
  VERSION_CREATE_FAILED: { ar: "تعذر تسجيل النسخة. أعد المحاولة.", en: "Could not register the version. Please retry." },
  VERSION_UPDATE_FAILED: { ar: "تعذر استبدال النسخة. أعد المحاولة.", en: "Could not replace the version. Please retry." },
  PROJECT_NOT_FOUND: { ar: "المشروع غير موجود.", en: "The project was not found." },
  JOB_CREATE_FAILED: { ar: "تعذر تسجيل طلب الإنشاء. أعد المحاولة.", en: "Could not register the request. Please retry." },
};

const FIELD_MESSAGES = {
  REQUIRED: { ar: "هذا الحقل مطلوب.", en: "This field is required." },
  TOO_LONG: { ar: "النص أطول من الحد المسموح.", en: "This text is too long." },
  INVALID: { ar: "قيمة غير صالحة.", en: "Invalid value." },
  UNSUPPORTED_LANGUAGE: { ar: "هذه اللغة غير مدعومة.", en: "This language is not supported." },
  TOPIC_REQUIRED: { ar: "اكتب موضوع العرض أو أرفق ملفًا.", en: "Write a topic or attach a file." },
};

/** File-attachment errors raised by src/services/fileTextService.js */
const FILE_MESSAGES = {
  UNSUPPORTED_FILE: { ar: "نوع الملف غير مدعوم. المتاح: TXT وMD وCSV وJSON وDOCX وPPTX.", en: "This file type is not supported. Use TXT, MD, CSV, JSON, DOCX or PPTX." },
  FILE_TOO_LARGE: { ar: "الملف كبير جدًا (الحد 10 ميجابايت).", en: "The file is too large (10 MB max)." },
  EMPTY_FILE: { ar: "الملف فارغ أو لا يحتوي على نص يمكن قراءته.", en: "The file is empty or has no readable text." },
  FILE_UNREADABLE: { ar: "تعذّرت قراءة الملف. تأكد أنه غير تالف ثم حاول مرة أخرى.", en: "The file could not be read. Make sure it is not corrupted and try again." },
};

export function fileErrorMessage(code, loc) {
  return loc(FILE_MESSAGES[code] || FILE_MESSAGES.FILE_UNREADABLE);
}

export function errorMessage(code, loc, detail = "") {
  const entry = MESSAGES[code] || { ar: "تعذر إنشاء العرض التقديمي. حاول مرة أخرى.", en: "Could not create the presentation. Please try again." };
  const base = loc(entry);
  return detail && (code === "GAMMA_REJECTED_REQUEST") ? `${base} (${detail})` : base;
}

export function fieldMessage(code, loc) {
  return loc(FIELD_MESSAGES[code] || FIELD_MESSAGES.INVALID);
}
