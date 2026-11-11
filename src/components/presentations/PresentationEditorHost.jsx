import React from "react";

// The editor is large: load it only when a presentation is actually opened.
const createEditorComponent = () => React.lazy(() => import("@/components/pptxEditor/PptxEditorDialog"));

class EditorLoadBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("Presentation editor failed to load:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    const { onRetry, onClose, loc } = this.props;
    return (
      <div className="fixed inset-0 z-[10001] grid place-items-center bg-slate-950/55 p-4" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-black text-slate-900">{loc({ ar: "تعذر فتح محرر العروض", en: "The presentation editor could not open" })}</h2>
          <p className="mt-2 text-sm text-slate-600">{loc({ ar: "حدث خطأ أثناء تحميل المحرر. يمكنك إعادة المحاولة.", en: "An error occurred while loading the editor. You can try again." })}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">{loc({ ar: "إغلاق", en: "Close" })}</button>
            <button type="button" onClick={onRetry} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{loc({ ar: "إعادة المحاولة", en: "Try again" })}</button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Opens a saved presentation in the Eyad PPTX editor (lazy-loaded, with a failure boundary).
 * file: { bytes, name, projectId, versionId, versionNo } · onSaved(result) fires after a save to Projects.
 */
export default function PresentationEditorHost({ file, onClose, onSaved, loc }) {
  const [attempt, setAttempt] = React.useState(0);
  const [Editor, setEditor] = React.useState(() => createEditorComponent());
  const retry = () => { setAttempt((n) => n + 1); setEditor(() => createEditorComponent()); };
  return (
    <EditorLoadBoundary key={attempt} loc={loc} onClose={onClose} onRetry={retry}>
      <React.Suspense fallback={
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/35 p-4" role="status" aria-live="polite">
          <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-slate-700 shadow-xl">{loc({ ar: "جاري تحميل محرر العروض…", en: "Loading the presentation editor…" })}</div>
        </div>
      }>
        <Editor onClose={onClose} initialFile={file} onSaved={onSaved} />
      </React.Suspense>
    </EditorLoadBoundary>
  );
}
