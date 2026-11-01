import React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Presentation, RefreshCw } from "lucide-react";
import { errorMessage } from "./presentationMessages";

/** Result panel: shows the real state reported by the backend (never a simulated one). */
export default function PresentationResult({ phase, job, error, timedOut, onRetry, onRecheck, loc }) {
  if (phase === "idle") {
    return (
      <div className="grid min-h-64 place-items-center text-center text-muted-foreground">
        <div className="max-w-xs">
          <Presentation className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm">{loc({ ar: "اختر الإعدادات واضغط «إنشاء العرض التقديمي». ستظهر النتيجة هنا بعد اكتمال التوليد.", en: "Pick your settings and press “Generate Presentation”. The result appears here once generation finishes." })}</p>
        </div>
      </div>
    );
  }

  if (phase === "starting" || (phase === "polling" && !timedOut)) {
    return (
      <div role="status" aria-live="polite" className="grid min-h-64 place-items-center text-center">
        <div className="max-w-xs">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-primary" aria-hidden="true" />
          <p className="font-bold text-foreground">{phase === "starting" ? loc({ ar: "جاري إرسال الطلب…", en: "Sending your request…" }) : loc({ ar: "جاري إنشاء العرض التقديمي…", en: "Creating your presentation…" })}</p>
          <p className="mt-2 text-sm text-muted-foreground">{loc({ ar: "قد يستغرق ذلك من دقيقة إلى بضع دقائق. يمكنك البقاء في هذه الصفحة.", en: "This can take from one to a few minutes. Please stay on this page." })}</p>
        </div>
      </div>
    );
  }

  if (phase === "completed" && job?.gamma_url) {
    const themed = job.color_application === "theme";
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black text-foreground">{loc({ ar: "تم إنشاء العرض التقديمي", en: "Your presentation is ready" })}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{loc({ ar: "أنشأته Gamma وهو متاح الآن للفتح والتعديل.", en: "Gamma created it and it is ready to open and edit." })}</p>
          </div>
        </div>
        <a href={job.gamma_url} target="_blank" rel="noopener noreferrer" data-testid="open-presentation"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {loc({ ar: "فتح العرض التقديمي", en: "Open presentation" })}
        </a>
        {job.export_url && (
          <a href={job.export_url} target="_blank" rel="noopener noreferrer" className="ms-3 text-sm font-bold text-primary underline-offset-4 hover:underline">
            {loc({ ar: "تنزيل الملف", en: "Download file" })}
          </a>
        )}
        <ul className="space-y-1.5 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
          <li>
            {themed
              ? loc({ ar: "الألوان: طُبّقت الباكدج عبر ثيم Gamma المربوط بها.", en: "Colors: the package was applied through its linked Gamma theme." })
              : job.theme_rejected
                ? loc({ ar: "الألوان: رفضت Gamma الثيم المربوط، فأُرسلت ألوان الباكدج كتوجيه للتصميم. قد لا تتطابق الألوان تمامًا.", en: "Colors: Gamma rejected the linked theme, so the package colors were sent as design guidance. They may not match exactly." })
                : loc({ ar: "الألوان: Gamma لا تقبل ألوانًا مخصصة مباشرة، فأُرسلت ألوان الباكدج كتوجيه للتصميم. قد لا تتطابق الألوان تمامًا.", en: "Colors: Gamma has no direct custom-color option, so the package colors were sent as design guidance. They may not match exactly." })}
          </li>
          {job.slide_count_note === "gamma-default" && (
            <li>{loc({ ar: "عدد الشرائح: اختيار «تلقائي» يترك العدد لـ Gamma، وقيمتها الافتراضية 10 شرائح تقريبًا.", en: "Slides: “Auto” leaves the count to Gamma, whose default is about 10 slides." })}</li>
          )}
        </ul>
      </div>
    );
  }

  if (phase === "polling" && timedOut) {
    return (
      <div role="alert" className="space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div>
            <h2 className="font-black text-foreground">{loc({ ar: "ما زال العرض قيد الإنشاء", en: "Still creating your presentation" })}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error ? errorMessage(error.code, loc, error.detail) : loc({ ar: "يستغرق وقتًا أطول من المعتاد. لم يفشل الطلب.", en: "It is taking longer than usual. The request has not failed." })}</p>
          </div>
        </div>
        <button type="button" onClick={onRecheck} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />{loc({ ar: "تحقق مرة أخرى", en: "Check again" })}
        </button>
      </div>
    );
  }

  return (
    <div role="alert" className="space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <h2 className="font-black text-foreground">{loc({ ar: "تعذر إنشاء العرض التقديمي", en: "Could not create the presentation" })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error?.code, loc, error?.detail)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{loc({ ar: "إعداداتك محفوظة كما هي، يمكنك المحاولة مرة أخرى.", en: "Your settings are kept as they are. You can try again." })}</p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />{loc({ ar: "إعادة المحاولة", en: "Try again" })}
      </button>
    </div>
  );
}
