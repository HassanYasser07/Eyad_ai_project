import React from "react";
import "./typewriterHint.css";

const TYPE_MS = 28;
const ERASE_MS = 10;
const HOLD_MS = 2000;
const GAP_MS = 450;

/**
 * Returns the text currently shown by the animation. While `active` is false the animation
 * stops and the text is cleared; when it turns active again the current sentence restarts.
 */
export function useTypewriterHint(active, sentences) {
  const [text, setText] = React.useState("");
  const indexRef = React.useRef(0);
  React.useEffect(() => {
    if (!active || !sentences?.length) { setText(""); return undefined; }
    let cancelled = false;
    let timer = null;
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const later = (fn, ms) => { timer = window.setTimeout(() => { if (!cancelled) fn(); }, ms); };

    const typeSentence = () => {
      const sentence = sentences[indexRef.current % sentences.length];
      if (reduceMotion) {
        setText(sentence);
        later(() => { indexRef.current += 1; typeSentence(); }, HOLD_MS * 2);
        return;
      }
      let i = 0;
      const typeStep = () => {
        i += 1;
        setText(sentence.slice(0, i));
        if (i < sentence.length) later(typeStep, TYPE_MS);
        else later(eraseStep, HOLD_MS);
      };
      const eraseStep = () => {
        i -= 1;
        setText(sentence.slice(0, Math.max(0, i)));
        if (i > 0) later(eraseStep, ERASE_MS);
        else later(() => { indexRef.current = (indexRef.current + 1) % sentences.length; typeSentence(); }, GAP_MS);
      };
      later(typeStep, GAP_MS);
    };
    typeSentence();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [active, sentences]);
  return text;
}

const px = (value) => Number.parseFloat(value) || 0;

/**
 * Wrap a <textarea> to give it an animated example-prompt hint.
 * The hint shows only while the field is empty, not focused, not hovered and not disabled.
 * Typography/padding are copied from the wrapped textarea so it works with any styling.
 * The wrapper reserves enough height for the longest sentence, so nothing is ever clipped.
 */
export default function TypewriterHint({ value, sentences, disabled = false, children }) {
  const rootRef = React.useRef(null);
  const [focused, setFocused] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [textStyle, setTextStyle] = React.useState(null);

  React.useLayoutEffect(() => {
    const textarea = rootRef.current?.querySelector("textarea");
    if (!textarea) return undefined;
    const read = () => {
      const cs = window.getComputedStyle(textarea);
      setTextStyle({
        paddingTop: px(cs.paddingTop) + px(cs.borderTopWidth),
        paddingBottom: px(cs.paddingBottom) + px(cs.borderBottomWidth),
        paddingLeft: px(cs.paddingLeft) + px(cs.borderLeftWidth),
        paddingRight: px(cs.paddingRight) + px(cs.borderRightWidth),
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
      });
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const longest = React.useMemo(
    () => (sentences || []).reduce((a, b) => (b.length > a.length ? b : a), ""),
    [sentences],
  );
  const active = !value && !focused && !hovered && !disabled;
  const text = useTypewriterHint(active, sentences);

  return (
    <div
      ref={rootRef}
      className="twh"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="twh-sizer" dir="auto" aria-hidden="true" style={textStyle || undefined}>{longest}</div>
      {children}
      {active && text ? (
        <div className="twh-hint" dir="auto" aria-hidden="true" style={textStyle || undefined}>
          {text}<i className="twh-caret" />
        </div>
      ) : null}
    </div>
  );
}
