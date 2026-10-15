import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import EyadOrb from "@/components/chat/EyadOrb";
import { transcribeEyadAudio } from "@/services/transcribeService";
import "./voice-overlay.css";

/**
 * EYAD Voice Overlay — full-screen immersive voice experience.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onTranscript: (text: string) => void  — called when user speech is final
 *  - voiceState: "idle" | "listening" | "thinking" | "speaking"  — controlled by parent
 *  - liveTranscript: string  — optional, shown while EYAD is speaking/replying
 */
export default function VoiceOverlay({
  open,
  onClose,
  onTranscript,
  voiceState = "idle",
  liveTranscript = "",
  onVoiceGesture,
  choices = [],
  selections = {},
  onChoice,
  showDesignButton = false,
  onDesign,
  errorMessage = "",
  onLogin,
}) {
  const { language } = useI18n();
  const isAr = language !== "en";
  const [closing, setClosing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [localTranscript, setLocalTranscript] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const recordingRef = useRef(false);
  const mountedRef = useRef(true);
  const captureTokenRef = useRef(0);
  const cancelCaptureRef = useRef(false);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const monitorFrameRef = useRef(null);
  const startedAtRef = useRef(0);
  const stopReasonRef = useRef("user");
  const spokeRef = useRef(false);
  const peakRmsRef = useRef(0);
  const silenceStartRef = useRef(0);

  // Status labels
  const statusLabels = {
    idle: isAr ? "إياد جاهز للاستماع..." : "EYAD is ready to listen...",
    listening: isAr ? "إياد يستمع..." : "EYAD is listening...",
    thinking: isAr ? "إياد يفكر..." : "EYAD is thinking...",
    speaking: isAr ? "إياد يتحدث..." : "EYAD is speaking...",
  };

  const cleanup = useCallback(() => {
    if (monitorFrameRef.current) {
      cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = null;
    }
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recordingRef.current = false;
    captureTokenRef.current += 1;
    setRequestingMic(false);
    cleanup();
    try {
      recorder.stop();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[voice-chat] recorder.stop failed", err);
      setError(isAr ? "تعذر إيقاف التسجيل بشكل صحيح. حاول مرة أخرى." : "Could not stop the recording cleanly. Please try again.");
    }
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (recordingRef.current || transcribing || voiceState === "thinking") return;
    setError("");
    setLocalTranscript("");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(isAr ? "المتصفح لا يدعم تسجيل الصوت" : "Voice recording not supported");
      return;
    }

    recordingRef.current = true;
    cancelCaptureRef.current = false;
    const captureToken = ++captureTokenRef.current;
    setRequestingMic(true);
    onVoiceGesture?.();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        audioContextRef.current = new AudioCtx();
        if (audioContextRef.current.state === "suspended") audioContextRef.current.resume().catch(() => {});
      } catch {}
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureToken !== captureTokenRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setRequestingMic(false);
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length || audioTracks.every((track) => track.readyState !== "live" || !track.enabled)) {
        stream.getTracks().forEach((track) => track.stop());
        recordingRef.current = false;
        cleanup();
        setError(isAr ? "لم يتم العثور على مسار صوت نشط من الميكروفون." : "No active microphone audio track was provided.");
        return;
      }
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startedAtRef.current = performance.now();
      stopReasonRef.current = "user";
      spokeRef.current = false;
      peakRmsRef.current = 0;

      if (import.meta.env.DEV) {
        console.info("[voice-chat] recording started", {
          requestedMimeType: mimeType || "browser default",
          recorderMimeType: recorder.mimeType || "(not reported)",
          audioTracks: audioTracks.map((track) => ({
            readyState: track.readyState,
            enabled: track.enabled,
            muted: track.muted,
            settings: track.getSettings?.(),
          })),
        });
      }

      recorder.ondataavailable = (e) => {
        if (e.data?.size) {
          chunksRef.current.push(e.data);
          if (import.meta.env.DEV) console.debug("[voice-chat] audio chunk", { size: e.data.size, mimeType: e.data.type || "(empty)" });
        }
      };

      recorder.onerror = (event) => {
        if (import.meta.env.DEV) console.error("[voice-chat] MediaRecorder error", event.error || event);
        if (mountedRef.current) setError(isAr ? `حدث خطأ أثناء التسجيل: ${event.error?.message || "خطأ غير معروف"}` : `Recording failed: ${event.error?.message || "unknown error"}`);
      };

      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        const actualType = recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || mimeType || "";
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingRef.current = false;
        const durationMs = Math.max(0, performance.now() - startedAtRef.current);
        const activeTrackCount = stream.getAudioTracks().filter((track) => track.readyState === "live" && track.enabled).length;
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: actualType });
        if (import.meta.env.DEV) {
          console.info("[voice-chat] recording stopped", {
            reason: stopReasonRef.current,
            durationMs: Math.round(durationMs),
            chunkCount: chunks.length,
            blobSize: blob.size,
            mimeType: blob.type || "(empty)",
            activeAudioTracksAtStop: activeTrackCount,
            speechDetectedByAnalyser: spokeRef.current,
            peakAnalyserRms: Number(peakRmsRef.current.toFixed(4)),
          });
        }
        if (cancelCaptureRef.current) return;

        if (!chunks.length || !blob.size) {
          if (mountedRef.current) setError(isAr ? `التسجيل فارغ (${blob.size} بايت، ${Math.round(durationMs)} مللي ثانية). تحقق من الميكروفون وحاول مجددًا.` : `Recording is empty (${blob.size} bytes, ${Math.round(durationMs)} ms). Check the microphone and try again.`);
          return;
        }
        if (!blob.type) {
          if (mountedRef.current) setError(isAr ? "لم يحدد المتصفح صيغة التسجيل، لذلك لم يُرسل." : "The browser did not report an audio format, so the recording was not sent.");
          return;
        }

        try {
          const reader = new FileReader();
          reader.onerror = () => {
            if (import.meta.env.DEV) console.error("[voice-chat] failed to read recorded audio", reader.error);
            if (mountedRef.current) {
              setTranscribing(false);
              setError(isAr ? "تعذرت قراءة التسجيل. حاول مرة أخرى." : "Could not read the recording. Please try again.");
            }
          };
          reader.onload = async () => {
            const result = String(reader.result || "");
            const comma = result.indexOf(",");
            const audioBase64 = comma >= 0 ? result.slice(comma + 1) : result;
            try {
              if (mountedRef.current) setTranscribing(true);
              if (import.meta.env.DEV) console.info("[voice-chat] transcription request started", {
                language,
                mimeType: blob.type,
                blobSize: blob.size,
                durationMs: Math.round(durationMs),
                base64Length: audioBase64.length,
              });
              const res = await transcribeEyadAudio({ audioBase64, mimeType: actualType, language, durationMs });
              const transcript = String(res?.text || "").trim();
              const isPromptEcho = /transcribe the user's (arabic|english) speech accurately|(?:###\s*:context|context\s*:\s*###)/i.test(transcript);
              if (import.meta.env.DEV) console.info("[voice-chat] transcription response", {
                hasText: Boolean(transcript),
                textLength: transcript.length,
                model: res?.model || "(not reported)",
                isPromptEcho,
                responseKeys: Object.keys(res || {}),
              });
              if (transcript && !isPromptEcho) {
                if (mountedRef.current) {
                  setLocalTranscript(transcript);
                  if (import.meta.env.DEV) console.info("[voice-chat] transcript delivered to Chat", { textLength: transcript.length });
                  onTranscript?.(transcript);
                }
              } else if (isPromptEcho && mountedRef.current) {
                setError(isAr
                  ? "أعادت خدمة التفريغ نص التعليمات بدل كلامك. لم يُرسل هذا النص إلى المحادثة؛ حاول التسجيل مرة أخرى."
                  : "The transcription service returned instruction text instead of your speech. It was not sent to the chat; please record again.");
              } else if (mountedRef.current) {
                setError(isAr ? "لم أستطع فهم الكلام. حاول مرة أخرى." : "Could not understand the speech. Please try again.");
              }
            } catch (err) {
              if (import.meta.env.DEV) console.error("[voice-chat] transcription error", err);
              if (mountedRef.current) {
                const message = String(err?.message || "");
                setError(message.includes("AUTH_LOGIN_REQUIRED")
                  ? (isAr ? "تعذر تفعيل الجلسة لإرسال التسجيل. سجّل الدخول ثم حاول مجددًا." : "Could not start a session for transcription. Sign in and try again.")
                  : message.includes("NotAllowedError") || message.includes("Permission")
                    ? (isAr ? "تم رفض صلاحية الميكروفون. اسمح بها من إعدادات الموقع ثم حاول مجددًا." : "Microphone permission was denied. Allow it in site settings and try again.")
                    : (isAr ? `تعذر تحويل التسجيل إلى نص (${message || "خطأ غير معروف"}).` : `Transcription failed (${message || "unknown error"}).`));
              }
            } finally {
              if (mountedRef.current) setTranscribing(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          if (import.meta.env.DEV) console.error("[voice-chat] could not prepare transcription request", err);
          if (mountedRef.current) setError(isAr ? `تعذر تجهيز التسجيل للتفريغ: ${err?.message || "خطأ غير معروف"}` : `Could not prepare audio for transcription: ${err?.message || "unknown error"}`);
        }
      };

      recorder.start(250);
      setRecording(true);

      // Auto-stop with silence detection
      spokeRef.current = false;
      silenceStartRef.current = 0;

      try {
        if (audioContextRef.current) {
          const ctx = audioContextRef.current;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.85;
          src.connect(analyser);
          audioContextRef.current = ctx;
          sourceRef.current = src;
          analyserRef.current = analyser;

          const samples = new Uint8Array(analyser.fftSize);
          const monitor = () => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
              const n = (samples[i] - 128) / 128;
              sum += n * n;
            }
            const rms = Math.sqrt(sum / samples.length);
            peakRmsRef.current = Math.max(peakRmsRef.current, rms);
            const now = performance.now();
            const elapsed = now - startedAtRef.current;
            const speaking = rms > 0.012;

            if (speaking) {
              spokeRef.current = true;
              silenceStartRef.current = 0;
            } else {
              if (!silenceStartRef.current) silenceStartRef.current = now;
              const silenceMs = now - silenceStartRef.current;
              const requiredSilence = spokeRef.current ? 1500 : 10000;
              const minElapsed = spokeRef.current ? 1200 : 10000;
              if (silenceMs >= requiredSilence && elapsed >= minElapsed) {
                stopReasonRef.current = spokeRef.current ? "post-speech-silence" : "no-speech-timeout";
                stopRecording();
                return;
              }
            }
            if (elapsed >= 30000) {
              stopReasonRef.current = "maximum-duration";
              stopRecording();
              return;
            }
            monitorFrameRef.current = requestAnimationFrame(monitor);
          };
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
          monitorFrameRef.current = requestAnimationFrame(monitor);
        }
      } catch {}
    } catch (err) {
      recordingRef.current = false;
      setRequestingMic(false);
      cleanup();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      setError(denied
        ? (isAr ? "تم رفض صلاحية الميكروفون. اسمح بها من إعدادات الموقع ثم حاول مجددًا." : "Microphone permission was denied. Allow it in site settings and try again.")
        : (isAr ? "تعذر الوصول للميكروفون. تحقق من صلاحية الموقع." : "Could not access the microphone. Check site permissions."));
    }
  }, [transcribing, isAr, language, onTranscript, onVoiceGesture, stopRecording, cleanup, voiceState]);

  // Auto Listen: open voice chat with the microphone ready, then resume listening after each EYAD reply.
  useEffect(() => {
    if (!open || errorMessage || voiceState === "thinking" || voiceState === "speaking" || recordingRef.current || transcribing || requestingMic) return;
    startRecording();
  }, [open, errorMessage, voiceState, transcribing, requestingMic, startRecording]);

  useEffect(() => {
    if (!errorMessage) return;
    if (recordingRef.current || transcribing) stopRecording();
  }, [errorMessage, transcribing, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingRef.current = false;
      cancelCaptureRef.current = true;
      captureTokenRef.current += 1;
      cleanup();
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cleanup]);

  const handleClose = () => {
    cancelCaptureRef.current = true;
    stopRecording();
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 280);
  };

  if (!open) return null;

  const showLiveTranscript = Boolean(localTranscript || liveTranscript);
  const transcriptText = liveTranscript || localTranscript;

  return (
    <div className={`eyad-voice-overlay ${closing ? "is-closing" : ""}`}>
      {/* Top bar */}
      <div className="eyad-voice__top">
        <button type="button" className="eyad-voice__close" onClick={handleClose} aria-label={isAr ? "إغلاق" : "Close"}>
          <X />
        </button>
        <div className="eyad-voice__title">
          <strong>{isAr ? "محادثة إياد" : "EYAD Chat"}</strong>
          <small>{isAr ? "مساعدك الإبداعي" : "Your creative assistant"}</small>
        </div>
        <div className="eyad-voice__spacer" />
      </div>

      {/* Center: Orb + status */}
      <div className="eyad-voice__center">
        <div className="eyad-voice__orb-wrap">
          <EyadOrb state={recording ? "listening" : voiceState} size={200} />
        </div>

        <div className="eyad-voice__status">
          <span className="eyad-voice__status-label">
            {requestingMic ? (isAr ? "بانتظار صلاحية الميكروفون..." : "Waiting for microphone permission...") : recording ? statusLabels.listening : transcribing ? "" : statusLabels[voiceState]}
          </span>
        </div>

        {showLiveTranscript && (
          <div className="eyad-voice__live-transcript is-visible">
            {transcriptText || (recording ? (isAr ? "يتكلم..." : "Speaking...") : "")}
          </div>
        )}

        {(error || errorMessage) && (
          <div className="eyad-voice__limit-alert" dir={isAr ? "rtl" : "ltr"}>
            <div className="eyad-voice__live-transcript is-visible" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
              {error || errorMessage}
            </div>
            {onLogin && (errorMessage || error === "AUTH_LOGIN_REQUIRED") && (
              <button type="button" className="eyad-voice__login-button" onClick={onLogin}>
                {isAr ? "تسجيل الدخول / إنشاء حساب" : "Log in / Create account"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive creative choices stay visible inside Voice Chat too.
          The same structured choices used by the text chat are rendered here,
          so voice mode never requires closing the overlay to continue a wizard. */}
      {choices.length > 0 && voiceState !== "thinking" && voiceState !== "speaking" && (
        <div className="eyad-voice__choices" dir={isAr ? "rtl" : "ltr"}>
          {choices.map((group) => (
            <div className="eyad-voice__choice-group" key={group.id}>
              <div className="eyad-voice__choice-title">{group.title}</div>
              <div className="eyad-voice__choice-options">
                {group.options?.map((option) => {
                  const active = selections[group.id] === option.label;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={active ? "is-active" : ""}
                      onClick={() => onChoice?.(group.id, option)}
                    >
                      {active ? "✓ " : ""}{option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDesignButton && voiceState !== "thinking" && (
        <button
          type="button"
          className="eyad-voice__design-btn"
          onClick={onDesign}
        >
          {isAr ? "✨ ابدأ التصميم" : "✨ Start design"}
        </button>
      )}

      {/* Bottom controls */}
      <div className="eyad-voice__bottom">
        <div className="eyad-voice__hint">
          {requestingMic ? (isAr ? "بانتظار صلاحية الميكروفون..." : "Waiting for microphone permission...") : recording ? (isAr ? "إياد يستمع الآن..." : "EYAD is listening...") : transcribing ? "" : voiceState === "speaking" ? (isAr ? "استمع إلى إياد..." : "Listening to EYAD...") : (isAr ? "تحدث بشكل طبيعي — سيبدأ التسجيل تلقائيًا" : "Speak naturally — recording starts automatically")}
        </div>
      </div>
    </div>
  );
}
