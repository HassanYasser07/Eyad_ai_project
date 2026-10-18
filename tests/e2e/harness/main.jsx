// Dev-only harness: mounts the real editor dialog without the Base44 auth shell. Not part of the build.
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { I18nProvider } from "@/i18n/I18nContext";
import PptxEditorDialog from "@/components/pptxEditor/PptxEditorDialog";

function Harness() {
  const [open, setOpen] = React.useState(true);
  return (
    <I18nProvider>
      <button data-testid="reopen" onClick={() => setOpen(true)}>reopen</button>
      {open && <PptxEditorDialog onClose={() => setOpen(false)} />}
    </I18nProvider>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
