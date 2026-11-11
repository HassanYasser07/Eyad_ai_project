import React from "react";
import { ArrowUp, ChevronDown, FileText, Layers, LayoutTemplate, Loader2, Plus, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { extractFileText } from "@/services/fileTextService";
import { fileErrorMessage } from "./presentationMessages";
import { FILE_ACCEPT_ATTR, LIMITS } from "@/config/presentationOptions";

const pillClass = "group inline-flex h-9 w-full min-w-0 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-[13px] font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-primary/50 data-[state=open]:bg-primary/10";

/** One toolbar dropdown: optional small label ("Pages"), the current value, a chevron. */
function ToolbarSelect({ testId, icon: Icon, label, aria, options, value, onChange, loc }) {
  const current = options.find((option) => option.value === value) || options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger type="button" data-testid={testId} aria-label={`${aria}: ${loc(current)}`} className={pillClass}>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
        {label && <span className="shrink-0 font-medium text-muted-foreground">{label}</span>}
        <span className="min-w-0 flex-1 truncate text-start">{loc(current)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-[10rem] overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} data-testid={`${testId}-${option.value}`}>
              {loc(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const formatKb = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * The prompt box: a text area with four tools underneath (Add File, detail level, Pages, Language),
 * a character counter and the send button. Selected template and attached file show as chips.
 */
export default function PromptComposer({
  settings, onChange, error, busy, loc,
  detailOptions, slideOptions, languageOptions,
  file, onFileChange, template, onClearTemplate,
}) {
  const fileInputRef = React.useRef(null);
  const [reading, setReading] = React.useState(false);
  const [fileError, setFileError] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const attach = async (picked) => {
    if (!picked || busy) return;
    setFileError("");
    setReading(true);
    try {
      onFileChange(await extractFileText(picked));
    } catch (err) {
      // keep the previously attached file; only report why the new one was refused
      setFileError(fileErrorMessage(err?.code, loc));
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const hasChips = file || template;
  return (
    <div
      onDragOver={(event) => { if (event.dataTransfer?.types?.includes("Files")) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); attach(event.dataTransfer?.files?.[0]); }}
      className={`overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-float)] transition-colors focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${dragging ? "border-primary ring-2 ring-primary/30" : error ? "border-destructive" : "border-border"}`}
    >
      <label htmlFor="topic" className="sr-only">{loc({ ar: "موضوع العرض التقديمي", en: "Presentation topic" })}</label>
      <textarea
        id="topic" data-field="topic" rows={3} maxLength={LIMITS.topicMax} value={settings.topic} disabled={busy}
        onChange={(event) => onChange("topic", event.target.value)} onKeyDown={onKeyDown}
        aria-invalid={Boolean(error)} aria-describedby={error ? "topic-error" : undefined}
        placeholder={loc({ ar: "صف ما تريد إنشاءه", en: "Describe what you'd like to make" })}
        className="block min-h-[84px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
      />

      <div className="px-4 pb-2 text-end">
        <span className="text-[11px] tabular-nums text-muted-foreground" dir="ltr" aria-live="off">{settings.topic.length}/{LIMITS.topicMax}</span>
      </div>

      {hasChips && (
        <div className="flex flex-wrap gap-2 px-4 pb-2" data-testid="composer-chips">
          {template && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 ps-3 pe-1 text-xs font-bold text-foreground" data-testid="selected-template">
              <LayoutTemplate className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="truncate">{loc({ ar: "القالب: ", en: "Template: " })}{loc({ ar: template.title_ar, en: template.title_en })}</span>
              <button type="button" onClick={onClearTemplate} disabled={busy} aria-label={loc({ ar: "إزالة القالب", en: "Remove template" })} className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )}
          {file && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 ps-3 pe-1 text-xs font-bold text-foreground" data-testid="attached-file">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="truncate" dir="auto">{file.name}</span>
              <span className="shrink-0 font-medium text-muted-foreground">
                {formatKb(file.size)}{file.truncated ? ` · ${loc({ ar: "تم اقتطاع النص الطويل", en: "long text trimmed" })}` : ""}
              </span>
              <button type="button" onClick={() => { setFileError(""); onFileChange(null); }} disabled={busy} aria-label={loc({ ar: "إزالة الملف", en: "Remove file" })} className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 items-center gap-2 border-t border-border/70 bg-muted/40 p-2.5 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <input ref={fileInputRef} type="file" accept={FILE_ACCEPT_ATTR} className="sr-only" tabIndex={-1} data-testid="file-input" onChange={(event) => attach(event.target.files?.[0])} />
        <button type="button" data-testid="add-file" disabled={busy || reading} onClick={() => fileInputRef.current?.click()} className={pillClass}>
          {reading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate text-start">{loc({ ar: "إضافة ملف", en: "Add File" })}</span>
        </button>
        <ToolbarSelect testId="detail" icon={Layers} aria={loc({ ar: "مستوى التفصيل", en: "Detail level" })} options={detailOptions} value={settings.detail} onChange={(v) => onChange("detail", v)} loc={loc} />
        <ToolbarSelect testId="pages" label={loc({ ar: "الصفحات", en: "Pages" })} aria={loc({ ar: "عدد الصفحات", en: "Pages" })} options={slideOptions} value={settings.slideCount} onChange={(v) => onChange("slideCount", v)} loc={loc} />
        <ToolbarSelect testId="language" label={loc({ ar: "اللغة", en: "Language" })} aria={loc({ ar: "اللغة", en: "Language" })} options={languageOptions} value={settings.language} onChange={(v) => onChange("language", v)} loc={loc} />

        <button type="submit" data-testid="generate-presentation" disabled={busy || reading} aria-label={loc({ ar: "إنشاء العرض التقديمي", en: "Generate presentation" })}
          className="col-span-2 grid h-9 w-full place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-primary-foreground shadow-md shadow-primary/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {(fileError || error) && (
        <div className="space-y-1 border-t border-border px-5 py-3">
          {error && <p id="topic-error" role="alert" className="text-xs font-bold text-destructive">{error}</p>}
          {fileError && <p role="alert" data-testid="file-error" className="text-xs font-bold text-destructive">{fileError}</p>}
        </div>
      )}
    </div>
  );
}
