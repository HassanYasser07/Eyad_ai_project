import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, FileText, Image as ImageIcon, Loader2, Menu, Palette, Pencil, Plus, Presentation, RefreshCw, Send, Sparkles, Wand2, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/I18nContext";
import { runEyadEngine } from "@/services/eyadEngineService";
import { conversationService } from "@/services/conversationService";
import { jobService } from "@/services/jobService";
import { buildEyadVoiceInstructions, synthesizeEyadVoice } from "@/services/voiceService";
import { getCreativeActions } from "@/core/creativeActionRegistry";
import { projectService } from "@/services/projectService";
import { assetService } from "@/services/assetService";
import { saveBrandIdentity } from "@/services/brandService";
import { getProjectContext } from "@/services/projectContextService";

import { appConfig } from "@/config/app.config";
import { useAuth } from "@/lib/AuthContext";
import { guestUsageService, storePendingAction, getPendingAction, clearPendingAction } from "@/services/guestUsageService";
import GeneratingCanvas from "@/components/chat/GeneratingCanvas";
import EyadMiniOrb from "@/components/chat/EyadMiniOrb";
import VoiceOverlay from "@/components/chat/VoiceOverlay";
import { splitIntoSentences } from "@/utils/sentenceSegmenter";
import { getStudioById } from "@/studios/studioRegistry";
import "./chat.css";

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useI18n();
  const isAr = language !== "en";
  const { user, isAnonymous, authChecked } = useAuth();
  const isGuest = !user || isAnonymous;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(/** @type {Array<any>} */ ([]));
  const [sending, setSending] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  // Selected OpenAI voice for EYAD.
  const [voiceName] = useState("alloy");
  const streamAudioContextRef = useRef(null);
  const voiceSourceRef = useRef(null);
  const voiceRunRef = useRef(0);
  const spokenVoiceKeysRef = useRef(new Set());
  const pendingVoiceJobRef = useRef(null);
  const pendingVoiceSpeechRef = useRef("");
  const lastRevealedReplyRef = useRef(null);
  const pendingVoiceRouteRef = useRef(null);
  const [projectId, setProjectId] = useState(null);
  const [studioId, setStudioId] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectContext, setProjectContext] = useState(null);
  const [backgroundJobs, setBackgroundJobs] = useState([]);
  const [executionJobId, setExecutionJobId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasCompleting, setCanvasCompleting] = useState(false);
  const showCanvasRef = useRef(false);
  const [choices, setChoices] = useState([]);
  const [selections, setSelections] = useState({});
  const [revealedChoiceKeys, setRevealedChoiceKeys] = useState(new Set());
  const logoWizardGroupsRef = React.useRef([]);
  const [designButtonReady, setDesignButtonReady] = useState(false);
  const [lastImage, setLastImage] = useState(null);
  const [approvingLogoAssetId, setApprovingLogoAssetId] = useState(null);
  const [approvedLogoAssetId, setApprovedLogoAssetId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProjects, setHistoryProjects] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [voiceOverlayTranscript, setVoiceOverlayTranscript] = useState("");
  const [voicePlaybackError, setVoicePlaybackError] = useState("");
  const [voiceLimitNotice, setVoiceLimitNotice] = useState("");
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const eyadIconSrc = appConfig.assets.logoIcon;
  const requestedProjectId = searchParams.get("project");

  const unlockVoicePlayback = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!streamAudioContextRef.current || streamAudioContextRef.current.state === "closed") {
      streamAudioContextRef.current = new AudioCtx();
    }
    if (streamAudioContextRef.current.state === "suspended") {
      streamAudioContextRef.current.resume().catch(() => {});
    }
  };

  const stopVoicePlayback = ({ completeReply = true } = {}) => {
    voiceRunRef.current += 1;
    setVoiceLoading(false);
    if (completeReply) {
      setMessages((items) => items.map((item) => item.progressiveTargetText
        ? { ...item, text: item.progressiveTargetText, streaming: false }
        : item));
      const revealKeys = messages.map((item) => item.choiceRevealKey).filter(Boolean);
      if (revealKeys.length) setRevealedChoiceKeys((current) => new Set([...current, ...revealKeys]));
      setProcessing(false);
      setGeneratingImage(false);
    }
    try { voiceSourceRef.current?.stop(); } catch {}
    voiceSourceRef.current = null;
  };

  const playVoiceAudio = async (audioBase64, runId) => {
    let context = streamAudioContextRef.current;
    if (!context || context.state === "closed") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error("VOICE_AUDIO_CONTEXT_UNSUPPORTED");
      context = new AudioCtx();
      streamAudioContextRef.current = context;
    }
    // Mobile Chrome can suspend an AudioContext again after recording/transcription.
    // The context was already unlocked by the Voice Chat tap; resume it before
    // decoding/playing the returned TTS audio.
    if (context.state === "suspended") {
      try { await context.resume(); } catch {}
    }
    if (context.state !== "running") throw new Error("VOICE_AUDIO_CONTEXT_SUSPENDED");
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const buffer = await context.decodeAudioData(bytes.buffer);
    if (runId !== voiceRunRef.current) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    voiceSourceRef.current = source;
    await new Promise((resolve, reject) => {
      source.onended = resolve;
      try { source.start(); } catch (error) { reject(error); }
    });
    if (voiceSourceRef.current === source) voiceSourceRef.current = null;
  };

  const startNewChat = () => {
    // A project/conversation is already persisted server-side. Starting a new
    // chat must also fully close the immersive Voice Chat so its old recording,
    // transcript, TTS state, and "EYAD is speaking" UI cannot leak into the new
    // conversation.
    stopVoicePlayback({ completeReply: false });
    pendingVoiceJobRef.current = null;
    pendingVoiceSpeechRef.current = "";
    setVoiceOverlayOpen(false);
    setVoiceOverlayTranscript("");
    setVoicePlaybackError("");
    setVoiceLimitNotice("");
    setInput("");
    setAttachments([]);
    navigate("/chat");
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    if (historyProjects.length || historyLoading) return;
    setHistoryLoading(true);
    try {
      const projects = await projectService.listForHistory(30);
      setHistoryProjects(projects || []);
    } catch (error) {
      console.error("EYAD history load failed", error);
      setHistoryProjects([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Sentence-based progressive voice: each complete sentence is one TTS request.
  // No word-level splitting. Each sentence is spoken fully before the next begins.
  // onSentence(visibleText, isStreaming) is called once per sentence with the
  // accumulated text so the UI reveals sentence-by-sentence, not word-by-word.
  const speakTextProgressive = async (text, key = "progressive", userSpeech = "", onSentence = null, onFinished = null) => {
    const value = String(text || "").trim();
    if (!value) return;
    if (import.meta.env.DEV) console.info("[voice-chat] assistant reply queued for TTS", {
      voiceJobKey: key,
      assistantReplyLength: value.length,
      originalSpeechLength: String(userSpeech || "").length,
      replyMatchesOriginalSpeech: value === String(userSpeech || "").trim(),
      replyHasInternalContextMarker: /(?:###\s*:context|context\s*:\s*###)/i.test(value),
    });
    if (spokenVoiceKeysRef.current.has(key)) {
      onFinished?.();
      return;
    }
    spokenVoiceKeysRef.current.add(key);

    const sentences = splitIntoSentences(value);
    if (!sentences.length) {
      onFinished?.();
      return;
    }

    stopVoicePlayback({ completeReply: false });
    const runId = voiceRunRef.current;

    const makeAudio = async (sentence) => {
      const speechContext = userSpeech || [...messages].reverse().find((item) => item.role === "user")?.text || "";
      const instructions = buildEyadVoiceInstructions({ text: sentence, language, userSpeech: speechContext });
      if (import.meta.env.DEV) console.info("[voice-chat] TTS request started", {
        voiceJobKey: key,
        ttsTextLength: sentence.length,
        speechContextLength: speechContext.length,
        ttsTextIsOriginalSpeech: sentence === String(userSpeech || "").trim(),
      });
      const data = await synthesizeEyadVoice({
        text: sentence,
        language,
        voice: voiceName,
        speed: 1.25,
        instructions,
      });
      return data.audio;
    };

    try {
      setVoicePlaybackError("");
      setVoiceLoading(true);

      // Pre-fetch the first sentence's audio so EYAD starts speaking quickly.
      let nextAudioPromise = makeAudio(sentences[0]);
      let visible = "";

      for (let i = 0; i < sentences.length; i += 1) {
        const audio = await nextAudioPromise;
        if (runId !== voiceRunRef.current) break;

        // Start preparing the next sentence's audio while this one plays.
        nextAudioPromise = sentences[i + 1] ? makeAudio(sentences[i + 1]) : null;

        // Reveal this complete sentence as a single unit.
        visible += (i ? " " : "") + sentences[i];
        onSentence?.(visible, i < sentences.length - 1);

        // Play the full sentence audio to completion before moving on.
        await playVoiceAudio(audio, runId);
      }

      if (runId === voiceRunRef.current) {
        setVoiceLoading(false);
      }
      onFinished?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        const safeErrorMessage = [value, String(userSpeech || "")].filter(Boolean).reduce(
          (message, sensitiveText) => message.split(sensitiveText).join("[redacted user text]"),
          String(error?.message || "Unknown TTS error")
        ).replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
        console.error("[voice-chat] TTS request failed", {
          voiceJobKey: key,
          errorName: error?.name || "Error",
          errorMessage: safeErrorMessage,
        });
      }
      if (runId === voiceRunRef.current) {
        setVoiceLoading(false);
        setVoicePlaybackError(
          String(error?.message || "").includes("VOICE_AUDIO_CONTEXT")
            ? (isAr ? "تم استلام رد إياد، لكن تشغيل الصوت توقف بسبب المتصفح. اضغط داخل محادثة إياد مرة واحدة ثم حاول مرة أخرى." : "EYAD replied, but the browser suspended audio playback. Tap inside EYAD Voice Chat once and try again.")
            : (isAr ? "تم استلام رد إياد لكن تعذر تشغيل الصوت. حاول مرة أخرى." : "EYAD replied, but audio playback failed. Please try again.")
        );
      }
      onFinished?.();
      throw error;
    }
  };

  useEffect(() => {
    let active = true;
    if (!requestedProjectId) {
      // New chat: keep the previous project saved in History, but reset all
      // conversation-local state. In particular, Voice Chat must never remain
      // visually open or keep an old microphone/TTS session alive.
      stopVoicePlayback({ completeReply: false });
      pendingVoiceJobRef.current = null;
      pendingVoiceSpeechRef.current = "";
      setVoiceOverlayOpen(false);
      setVoiceOverlayTranscript("");
      setVoicePlaybackError("");
      setVoiceLimitNotice("");
      setProjectId(null);
      setStudioId(null);
      setProjectContext(null);
      setMessages([]);
      setChoices([]);
      setSelections({});
      setDesignButtonReady(false);
      setLastImage(null);
      return () => { active = false; };
    }

    setProjectLoading(true);
    setProjectId(requestedProjectId);
    getProjectContext(requestedProjectId).then((context) => {
      if (active) setProjectContext(context);
    }).catch(() => {
      if (active) setProjectContext(null);
    });
    conversationService.getActive(requestedProjectId)
      .then(async (conversation) => {
        if (!active || !conversation) return;
        const [history, activeJobs] = await Promise.all([
          conversationService.listMessages(conversation.id, 100),
          jobService.activeForProject(requestedProjectId),
        ]);
        if (!active) return;
        setBackgroundJobs(activeJobs || []);
        const mappedHistory = (history || []).map((item) => ({
          role: item.role,
          messageId: item.id,
          text: item.content || "",
          image: item.metadata?.image_data_url || null,
          images: Array.isArray(item.metadata?.images) ? item.metadata.images : null,
          selectedAssetId: item.metadata?.selected_asset_id || null,
          studioId: item.metadata?.studio_id || null,
          assetId: item.metadata?.asset_id || null,
          asset: item.metadata?.asset_id ? { id: item.metadata.asset_id, url: item.metadata?.asset_url || item.metadata?.image_data_url || null } : null,
          choices: item.metadata?.choices || null,
        }));
        setMessages(mappedHistory);
        // Restore the latest generated image as lastImage so modification requests
        // automatically include it as a reference image for edits.
        const lastAssistantWithImage = [...mappedHistory].reverse().find((item) => item.role === "assistant" && item.image);
        if (lastAssistantWithImage?.image) setLastImage(lastAssistantWithImage.image);
        const contextStudio = conversation.context?.studio_id || null;
        if (contextStudio) setStudioId(contextStudio);
      })
      .catch(() => {
        if (active) setMessages([]);
      })
      .finally(() => active && setProjectLoading(false));

    return () => { active = false; };
  }, [requestedProjectId]);

  useEffect(() => {
    if (!requestedProjectId) return undefined;
    let active = true;
    let lastSyncedJobKey = "";

    const loadHistoryAndReveal = async (job, isVoiceJob) => {
      const conversation = await conversationService.getActive(requestedProjectId);
      if (!conversation || !active) return;
      const history = await conversationService.listMessages(conversation.id, 100);
      if (!active) return;

      const mappedHistory = (history || []).map((item) => ({
        role: item.role,
        messageId: item.id,
        jobId: item.job_id || null,
        error: Boolean(item.metadata?.error),
        text: item.content || "",
        image: item.metadata?.image_data_url || null,
        images: Array.isArray(item.metadata?.images) ? item.metadata.images : null,
        selectedAssetId: item.metadata?.selected_asset_id || null,
        studioId: item.metadata?.studio_id || null,
        assetId: item.metadata?.asset_id || null,
        asset: item.metadata?.asset_id ? { id: item.metadata.asset_id, url: item.metadata?.asset_url || item.metadata?.image_data_url || null } : null,
        choices: item.metadata?.choices || null,
      }));
      const latestAssistantIndex = mappedHistory.map((item) => item.role === "assistant" && !item.error && !item.background).lastIndexOf(true);
      const replyIndex = isVoiceJob
        ? mappedHistory.findLastIndex((item) => item.role === "assistant" && item.jobId === job.id && !item.error)
        : latestAssistantIndex;
      const replyMessage = replyIndex >= 0 ? mappedHistory[replyIndex] : null;
      const isCompletedReply = job.status === "completed" && Boolean(replyMessage?.text);

      if (!isCompletedReply) {
        if (job?.status === "completed" || job?.status === "failed") {
          setExecutionJobId(null);
          setProcessing(false); setGeneratingImage(false);
          if (isVoiceJob) {
            pendingVoiceJobRef.current = null;
            pendingVoiceSpeechRef.current = "";
          }
        }
        setMessages(mappedHistory);
        return;
      }

      setExecutionJobId(null);

      // Put the final reply in the UI immediately, then reveal it sentence by sentence.
      // This does not call the AI again and does not consume credits.
      // Choices are deferred until the ENTIRE reply (text + voice) finishes.
      const fullReply = replyMessage.text;
      // If the inline send() already revealed this exact reply (non-queued
      // response with TTS), don't re-reveal it from the polling path. This
      // prevents the duplicate handoff message in Voice Chat.
      if (lastRevealedReplyRef.current?.reply === fullReply) {
        setMessages(mappedHistory);
        setProcessing(false); setGeneratingImage(false);
        if (isVoiceJob) {
          pendingVoiceJobRef.current = null;
          pendingVoiceSpeechRef.current = "";
        }
        return;
      }
      const pendingChoices = replyMessage.choices || null;
      const choiceRevealKey = pendingChoices?.length ? `choices-job-${job.id}` : null;
      const displayHistory = [...mappedHistory];
      displayHistory[replyIndex] = {
        ...displayHistory[replyIndex],
        text: "",
        streaming: true,
        progressiveTargetText: fullReply,
        deferChoices: Boolean(pendingChoices?.length),
        choiceRevealKey,
      };
      setMessages(displayHistory);
      if (choiceRevealKey) {
        setRevealedChoiceKeys((current) => {
          const next = new Set(current);
          next.delete(choiceRevealKey);
          return next;
        });
      }

      const revealChoicesAfterReply = () => {
        if (choiceRevealKey) setRevealedChoiceKeys((current) => new Set([...current, choiceRevealKey]));
        setProcessing(false); setGeneratingImage(false);
        // Voice Chat (queued response): after TTS finishes, navigate to the
        // routed studio if one was pending. This handles the case where send()
        // returned early with a job_id before the routing decision could fire.
        const pendingRoute = pendingVoiceRouteRef.current;
        if (isVoiceJob && pendingRoute) {
          pendingVoiceRouteRef.current = null;
          const studio = getStudioById(pendingRoute.studioId);
          const studioRoute = studio?.route || `/studios/${encodeURIComponent(pendingRoute.studioId)}`;
          const studioPath = `${studioRoute}?project=${encodeURIComponent(pendingRoute.projectId)}&from=chat`;
          stopVoicePlayback({ completeReply: false });
          setVoiceOverlayOpen(false);
          setVoiceOverlayTranscript("");
          window.location.assign(studioPath);
        }
      };

      const speechContext = pendingVoiceSpeechRef.current;
      pendingVoiceJobRef.current = null;
      pendingVoiceSpeechRef.current = "";

      if (isVoiceJob) {
        // Voice: each complete sentence is one TTS request. The sentence appears
        // on screen as a unit when its audio starts, and the next sentence waits
        // until the current one finishes playing. Choices appear only after the
        // last sentence's audio finishes completely (onFinished), never during.
        void speakTextProgressive(
          fullReply,
          `voice-job-${job.id}`,
          speechContext,
          (visibleText, isStreaming) => {
            setMessages((items) => {
              const next = [...items];
              const index = next.findIndex((item) => item.progressiveTargetText === fullReply && item.role === "assistant");
              if (index >= 0) next[index] = { ...next[index], text: visibleText, streaming: isStreaming };
              return next;
            });
          },
          revealChoicesAfterReply
        ).catch(() => {
          // TTS failure: reveal full text silently, then reveal choices.
          setMessages((items) => {
            const next = [...items];
            const index = next.findIndex((item) => item.progressiveTargetText === fullReply && item.role === "assistant");
            if (index >= 0) next[index] = { ...next[index], text: fullReply, streaming: false };
            return next;
          });
          revealChoicesAfterReply();
        });
      } else {
        // Text: reveal sentence by sentence, no TTS, no extra AI request.
        // Choices appear only after the last sentence is fully rendered.
        const sentences = splitIntoSentences(fullReply);
        let visible = "";
        for (let i = 0; i < sentences.length; i += 1) {
          if (!active) return;
          visible += (i ? " " : "") + sentences[i];
          setMessages((items) => {
            const next = [...items];
            const index = next.findIndex((item) => item.progressiveTargetText === fullReply && item.role === "assistant");
            if (index >= 0) next[index] = { ...next[index], text: visible, streaming: i < sentences.length - 1 };
            return next;
          });
          if (i < sentences.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
        revealChoicesAfterReply();
      }
    };

    const syncConversation = async () => {
      try {
        let jobs = await jobService.activeForProject(requestedProjectId);
        if (!active) return;

        // Only a confirmed OpenAI image-generation stage may show "جاري التوليد".
        // Normal chat jobs never trigger the image-generation indicator.
        let hasExternalImageGeneration = false;
        for (const activeJob of (jobs || [])) {
          if (activeJob?.result?.status === "waiting_external") {
            hasExternalImageGeneration = true;
            try { await jobService.pollGeneration(activeJob.id); } catch {}
          }
        }

        jobs = await jobService.activeForProject(requestedProjectId);
        if (!active) return;
        const stillGeneratingImage = hasExternalImageGeneration ||
          (jobs || []).some((job) => job?.result?.status === "waiting_external");
        setGeneratingImage(stillGeneratingImage);
        setBackgroundJobs(jobs || []);

        // If we're waiting for a specific voice job, poll that exact job_id.
        // Never use "latest completed job" in general to determine the voice reply.
        const pendingJobId = pendingVoiceJobRef.current;
        if (pendingJobId) {
          const pendingJob = await jobService.get(pendingJobId);
          if (!active || !pendingJob) return;
          if (pendingJob.status === "completed" || pendingJob.status === "failed") {
            const jobKey = `${pendingJob.id}:${pendingJob.status}:${pendingJob.completed_at || ""}`;
            if (jobKey !== lastSyncedJobKey) {
              lastSyncedJobKey = jobKey;
              setSending(false);
              await loadHistoryAndReveal(pendingJob, true);
            }
          }
          return;
        }

        // No pending voice job: watch the latest durable job for text replies and re-entry.
        const latestJob = await jobService.latestForProject(requestedProjectId);
        if (!active) return;
        if (latestJob?.status === "completed" || latestJob?.status === "failed") {
          const jobKey = `${latestJob.id}:${latestJob.status}:${latestJob.completed_at || ""}`;
          if (jobKey !== lastSyncedJobKey) {
            lastSyncedJobKey = jobKey;
            setSending(false);
            await loadHistoryAndReveal(latestJob, false);
          }
        }
      } catch {
        // Keep the normal chat UI quiet; durable jobs remain on the server.
      }
    };

    syncConversation();
    const timer = setInterval(syncConversation, 1800);
    return () => { active = false; clearInterval(timer); };
  }, [requestedProjectId]);

  const send = async (
    text = input,
    { action = "chat", designOptions = selections, choiceLabel = null, referenceImageOverride = null, voiceReply = false } = {}
  ) => {
    const value = String(text || "").trim();
    if (import.meta.env.DEV && voiceReply) console.info("[voice-chat] transcript passed to send", {
      textLength: value.length,
      action,
      isSending: sending,
      hasAttachments: attachments.length > 0,
      hasInternalContextMarker: /(?:###\s*:context|context\s*:\s*###)/i.test(value),
    });
    if ((!value && attachments.length === 0) || sending) {
      if (import.meta.env.DEV && voiceReply) console.warn("[voice-chat] voice send skipped", {
        emptyMessage: !value && attachments.length === 0,
        alreadySending: sending,
      });
      return;
    }

    stopVoicePlayback();

    const sentAttachments = attachments;
    setInput("");
    setAttachments([]);
    setMessages((items) => [
      ...items,
      { role: "user", text: choiceLabel || value, attachments: sentAttachments }
    ]);
    setSending(true);
    if (action === "generate") setGeneratingImage(true);

    // Guest trial: creative generation always requires a permanent account.
    // No engine call, no credits consumed.
    if (isGuest && action === "generate") {
      storePendingAction({ action, message: value, designOptions, choiceLabel, voiceReply });
      setMessages((items) => [...items, {
        role: "assistant",
        text: isAr
          ? "لإنشاء تصاميم أو شعارات تحتاج تسجيل الدخول. سجل الدخول أو أنشئ حساب للمتابعة."
          : "Creative generation requires login. Sign in or create an account to continue.",
        loginPrompt: true,
      }]);
      setSending(false);
      setGeneratingImage(false);
      return;
    }

    // Guest trial: enforce the configurable free chat limit.
    // No engine call, no credits consumed for the blocked message.
    if (isGuest && action === "chat" && guestUsageService.hasReachedLimit()) {
      storePendingAction({ action, message: value, designOptions, voiceReply });
      const limitNotice = isAr
        ? `وصلت للحد المجاني للرسائل (${appConfig.guestChatLimit}). سجل الدخول أو أنشئ حساب للمتابعة.`
        : `You've reached the free guest limit (${appConfig.guestChatLimit}). Sign in or create an account to continue.`;
      setMessages((items) => [...items, {
        role: "assistant",
        text: limitNotice,
        loginPrompt: true,
      }]);
      if (voiceReply) setVoiceLimitNotice(limitNotice);
      setSending(false);
      return;
    }

    let isQueued = false;
    const streamedAssistantKey = action === "chat" ? `assistant-stream-${Date.now()}` : null;

    if (streamedAssistantKey) {
      setMessages((items) => [...items, { role: "assistant", text: "", streaming: true, streamKey: streamedAssistantKey }]);
    }

    try {
      // Use the durable JSON engine for normal text chat. The browser SSE transport
      // was intermittently losing its terminal frame on mobile/Cloudflare, producing
      // EYAD_STREAM_FINAL_MISSING even when the backend had already completed.
      // We keep the same single AI request/credit cost and reveal the returned text
      // smoothly in the UI, so the user still sees a natural typing effect.
      const data = await runEyadEngine({

        message: value,
        language,
        projectId,
        studioId,
        action,
        designOptions,
        referenceImage: referenceImageOverride || lastImage,
        attachments: sentAttachments,
      });
      if (import.meta.env.DEV && voiceReply) console.info("[voice-chat] engine response received", {
        action,
        status: data?.status || "(missing)",
        replyLength: String(data?.reply || "").length,
        hasReply: Boolean(data?.reply),
        hasJobId: Boolean(data?.job_id),
        replyHasInternalContextMarker: /(?:###\s*:context|context\s*:\s*###)/i.test(String(data?.reply || "")),
      });

      // The engine creates the durable Project + Conversation on the first
      // message. Persist that returned project id in Chat state and the URL so
      // subsequent messages and History reopen the same conversation.
      const durableProjectId = data?.project?.id || null;
      if (!projectId && durableProjectId) {
        setProjectId(durableProjectId);
        navigate(`/chat?project=${encodeURIComponent(durableProjectId)}`, { replace: true });
      }

      // Chat is the intelligent distribution hub: when the router has confidently
      // identified a creative studio, move the user into that specialized workspace
      // after the current message/project has been durably saved. This keeps the
      // conversation attached to the same project so the studio can continue from
      // the exact context later.
      // Track the inline-processed reply so the polling effect doesn't re-reveal
      // the same message (the root cause of the duplicate handoff sentence).
      if (data?.reply && data?.status !== "queued") {
        lastRevealedReplyRef.current = { reply: data.reply, timestamp: Date.now() };
      }

      const routedStudioId = data?.route?.studio_id || null;
      const routeAction = data?.router?.route_action || data?.router?.action || null;
      // Use the project id from this response OR the one already in state. The
      // backend may not return project.id on subsequent messages once the project
      // already exists, which previously left shouldOpenStudio false and blocked
      // the automatic Voice Chat handoff.
      const effectiveProjectId = durableProjectId || projectId;
      const shouldOpenStudio =
        Boolean(effectiveProjectId && routedStudioId) &&
        (routeAction === "route" || routeAction === "continue") &&
        routedStudioId !== "marketplace";
      const openRoutedStudio = () => {
        const studio = getStudioById(routedStudioId);
        const studioRoute = studio?.route || `/studios/${encodeURIComponent(routedStudioId)}`;
        const handoffParams = new URLSearchParams({ project: effectiveProjectId, from: "chat" });
        // Desktop Logo Studio should receive the exact brief typed in Chat.
        // Keep this scoped to desktop + Logo Studio so mobile and other studios
        // retain their existing routing behavior.
        const isDesktopHandoff = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
        if (isDesktopHandoff && routedStudioId === "logo" && value) {
          handoffParams.set("brief", value);
        }
        const studioPath = `${studioRoute}?${handoffParams.toString()}`;
        // Voice Chat: stop all TTS/listening and close the overlay before the
        // final handoff so VoiceOverlay cannot reclaim the Chat route or start
        // a new listening session during navigation. Use a real browser navigation
        // (full page load) so async listeners are destroyed cleanly.
        if (voiceReply) {
          stopVoicePlayback({ completeReply: false });
          setVoiceOverlayOpen(false);
          setVoiceOverlayTranscript("");
          window.location.assign(studioPath);
          return;
        }
        navigate(studioPath, { replace: true });
      };
      if (shouldOpenStudio && !voiceReply) {
        openRoutedStudio();
        return;
      }
      // In Voice Chat, let EYAD finish speaking the handoff sentence first,
      // then move automatically to the specialized studio. This avoids cutting
      // off the spoken response while still keeping Chat as a true router.

      // Guest trial: count this successful normal chat toward the limit.
      if (isGuest && action === "chat") {
        guestUsageService.increment();
      }

      // A queued background response contains only a transport acknowledgement, not the final assistant reply. Never send that acknowledgement to TTS; the polling path will load the real reply.
      if (streamedAssistantKey && data?.status !== "queued") {
        const streamedReply = data?.reply || "";
        const responseChoices = Array.isArray(data?.choices) ? data.choices : null;
        const choiceRevealKey = responseChoices?.length ? `choices-${Date.now()}-${Math.random().toString(36).slice(2)}` : null;
        const shouldRevealDesignButton = ["style", "colors", "logo_type"].every((key) => designOptions?.[key]);
        setMessages((items) => {
          const next = [...items];
          const targetIndex = next.findIndex((item) => item.streamKey === streamedAssistantKey);
          if (targetIndex >= 0) {
            next[targetIndex] = {
              ...next[targetIndex],
              text: "",
              streaming: true,
              progressiveTargetText: streamedReply,
              image: data?.image?.data_url || null,
              images: Array.isArray(data?.images) ? data.images : (data?.image?.data_url ? [{ data_url: data.image.data_url, format: "png", asset_id: data.image.asset_id }] : null),
              selectedAssetId: data?.selected_asset_id || null,
              studioId: data?.route?.studio_id || studioId || null,
              assetId: data?.image?.asset_id || null,
              asset: data?.image?.asset_id ? { id: data.image.asset_id, url: data.image.data_url || null } : null,
              choices: responseChoices,
              deferChoices: Boolean(responseChoices?.length),
              choiceRevealKey,
            };
          }
          return next;
        });
        if (responseChoices?.length) setRevealedChoiceKeys((current) => {
          const next = new Set(current);
          next.delete(choiceRevealKey);
          return next;
        });

        // Reveal sentence by sentence for text chat. Local UI only — no extra
        // AI/TTS request, no credits consumed.
        if (streamedReply && !voiceReply) {
          const sentences = splitIntoSentences(streamedReply);
          let visible = "";
          for (let i = 0; i < sentences.length; i += 1) {
            visible += (i ? " " : "") + sentences[i];
            setMessages((items) => {
              const next = [...items];
              const targetIndex = next.findIndex((item) => item.streamKey === streamedAssistantKey);
              if (targetIndex >= 0) {
                next[targetIndex] = { ...next[targetIndex], text: visible, streaming: i < sentences.length - 1 };
              }
              return next;
            });
            if (i < sentences.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 350));
          }
        }

        const revealChoicesAndButton = () => {
          if (choiceRevealKey) setRevealedChoiceKeys((current) => new Set([...current, choiceRevealKey]));
          if (shouldRevealDesignButton) setDesignButtonReady(true);
          setGeneratingImage(false);
        };
        if (data?.status === "generated") {
          setSelections({});
          setDesignButtonReady(false);
        }
        if (streamedReply && voiceReply) {
          // Voice input: sentence-based TTS with synchronized sentence reveal.
          // Each sentence is one TTS request; the sentence appears on screen as
          // a unit when its audio starts. No extra AI request or credits.
          await new Promise((resolve) => {
            speakTextProgressive(
              streamedReply,
              `voice-stream-${streamedAssistantKey}`,
              value,
              (visibleText, isStreaming) => {
                setMessages((items) => {
                  const next = [...items];
                  const targetIndex = next.findIndex((item) => item.streamKey === streamedAssistantKey);
                  if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], text: visibleText, streaming: isStreaming };
                  return next;
                });
              },
              resolve
            ).catch(() => {
              // TTS failure: reveal full text silently, don't fail the conversation.
              setMessages((items) => {
                const next = [...items];
                const targetIndex = next.findIndex((item) => item.streamKey === streamedAssistantKey);
                if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], text: streamedReply, streaming: false };
                return next;
              });
              resolve();
            });
          });
          revealChoicesAndButton();
          if (shouldOpenStudio && voiceReply) {
            openRoutedStudio();
            return;
          }
        } else {
          revealChoicesAndButton();
        }
        if (data?.project?.id) {
          setProjectId(data.project.id);
          if (!requestedProjectId) navigate(`/chat?project=${encodeURIComponent(data.project.id)}`, { replace: true });
        }
        if (data?.route?.studio_id) setStudioId(data.route.studio_id);
        if (Array.isArray(data?.choices)) {
          setChoices(data.choices);
          const logoGroups = data.choices.filter((group) => ["style", "colors", "logo_type"].includes(group?.id));
          if (logoGroups.length) logoWizardGroupsRef.current = logoGroups;
        }
        if (data?.image?.data_url) setLastImage(data.image.data_url);
        return;
      }

      if (data?.project?.id) {
        setProjectId(data.project.id);
        if (!requestedProjectId) navigate(`/chat?project=${encodeURIComponent(data.project.id)}`, { replace: true });
      }
      if (data?.job_id) {
        setBackgroundJobs((jobs) => [...jobs, { id: data.job_id, status: data.status || "queued" }]);
        setExecutionJobId(data.job_id);
      }
      if (data?.route?.studio_id) setStudioId(data.route.studio_id);
      if (Array.isArray(data?.choices)) {
        setChoices(data.choices);
        const logoGroups = data.choices.filter((group) => ["style", "colors", "logo_type"].includes(group?.id));
        if (logoGroups.length) logoWizardGroupsRef.current = logoGroups;
      }
      if (data?.image?.data_url) setLastImage(data.image.data_url);
      if (data?.status === "generated") {
        setSelections({});
        setDesignButtonReady(false);
      }
      if (data?.status === "queued") {
        isQueued = true;
        setExecutionJobId(data.job_id || null);
        setProcessing(true);
        setGeneratingImage(action === "generate");
        if (voiceReply) {
          // Store the exact job id so completion polling cannot accidentally speak an older completed reply or the queued acknowledgement.
          pendingVoiceJobRef.current = data.job_id || null;
          pendingVoiceSpeechRef.current = value;
          // Remember the routing decision so the polling path can navigate
          // after TTS finishes (send() returns early for queued responses).
          if (shouldOpenStudio) {
            pendingVoiceRouteRef.current = { studioId: routedStudioId, projectId: effectiveProjectId };
          }
        }
        // Keep the thinking indicator visible while the durable job runs on the server.
        // The polling effect will set sending=false when the job completes.
        // Safety: release the lock after 90s so the user can try again if the job stalls.
        setTimeout(() => setSending(false), 90000);
        return;
      }

      const assistantReply = data?.reply || (isAr ? "تم استلام طلبك." : "Your request was received.");
      const responseChoices = Array.isArray(data?.choices) ? data.choices : null;
      const choiceRevealKey = responseChoices?.length ? `choices-${Date.now()}-${Math.random().toString(36).slice(2)}` : null;
      const shouldRevealDesignButton = ["style", "colors", "logo_type"].every((key) => designOptions?.[key]);

      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: "",
          image: data?.image?.data_url || null,
          images: Array.isArray(data?.images) ? data.images : (data?.image?.data_url ? [{ data_url: data.image.data_url, format: "png", asset_id: data.image.asset_id }] : null),
          selectedAssetId: data?.selected_asset_id || null,
          studioId: data?.route?.studio_id || studioId || null,
          assetId: data?.image?.asset_id || null,
          asset: data?.image?.asset_id ? { id: data.image.asset_id, url: data.image.data_url || null } : null,
          choices: responseChoices,
          deferChoices: Boolean(responseChoices?.length),
          choiceRevealKey,
          progressiveTargetText: assistantReply,
        }
      ]);
      if (responseChoices?.length) {
        setRevealedChoiceKeys((current) => {
          const next = new Set(current);
          next.delete(choiceRevealKey);
          return next;
        });
      }
      if (shouldRevealDesignButton) setDesignButtonReady(false);
      const revealChoicesAndButton = () => {
        if (choiceRevealKey) setRevealedChoiceKeys((current) => new Set([...current, choiceRevealKey]));
        if (shouldRevealDesignButton) setDesignButtonReady(true);
        setGeneratingImage(false);
      };
      if (assistantReply && voiceReply) {
        // Voice input: sentence-based TTS with synchronized sentence reveal.
        const finishVoice = revealChoicesAndButton;
        const messageKey = Date.now();
        await new Promise((resolve) => {
          speakTextProgressive(
            assistantReply,
            `assistant-voice-${messageKey}`,
            value,
            (visibleText, isStreaming) => {
              setMessages((items) => {
                const next = [...items];
                const targetIndex = next.map((item) => item.role === "assistant" && item.progressiveTargetText === assistantReply).lastIndexOf(true);
                if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], text: visibleText, streaming: isStreaming };
                return next;
              });
            },
            () => {
              finishVoice();
              resolve();
            }
          ).catch(() => {
            setMessages((items) => {
              const next = [...items];
              const targetIndex = next.map((item) => item.role === "assistant" && item.progressiveTargetText === assistantReply).lastIndexOf(true);
              if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], text: assistantReply, streaming: false };
              return next;
            });
            finishVoice();
            resolve();
          });
        });
        if (shouldOpenStudio && voiceReply) {
          openRoutedStudio();
          return;
        }
      } else {
        // Text input: reveal sentence by sentence, no voice / no TTS call.
        if (assistantReply) {
          const sentences = splitIntoSentences(assistantReply);
          let visible = "";
          for (let i = 0; i < sentences.length; i += 1) {
            visible += (i ? " " : "") + sentences[i];
            setMessages((items) => {
              const next = [...items];
              const targetIndex = next.map((item) => item.role === "assistant" && item.progressiveTargetText === assistantReply).lastIndexOf(true);
              if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], text: visible, streaming: i < sentences.length - 1 };
              return next;
            });
            if (i < sentences.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 350));
          }
        }
        revealChoicesAndButton();
      }
    } catch (error) {
      // A durable EYAD job can keep running even when the browser reports "Failed to fetch".
      // Re-attach to the newest job instead of showing a false permanent chat error.
      if (action === "chat") {
        try {
          // On the first message projectId can still be null because the backend
          // creates the project and job during the same request. Recover by user
          // instead of requiring a project id that the browser does not have yet.
          const latestJob = projectId
            ? await jobService.latestForProject(projectId)
            : await jobService.latestForUser();
          const recentEnough = latestJob?.created_at
            ? (Date.now() - new Date(latestJob.created_at).getTime()) < 120000
            : false;
          if (latestJob && recentEnough && ["queued", "processing"].includes(latestJob.status)) {
            setExecutionJobId(latestJob.id);
            setProcessing(true);
            setGeneratingImage(false);
            if (latestJob.project_id) {
              setProjectId(latestJob.project_id);
              if (!requestedProjectId) navigate("/chat?project=" + encodeURIComponent(latestJob.project_id), { replace: true });
            }
            return;
          }
        } catch {}
      }

      setExecutionJobId(null);
      setProcessing(false); setGeneratingImage(false);

      // Guest-first app, but anonymous Supabase auth is disabled in the
      // current config — so a guest with no session must be sent to login
      // instead of seeing a raw "AUTH_LOGIN_REQUIRED" error in the chat.
      if (error?.message === "AUTH_LOGIN_REQUIRED") {
        storePendingAction({ action, message: value, designOptions, voiceReply });
        const currentPath = `/chat${requestedProjectId ? `?project=${encodeURIComponent(requestedProjectId)}` : ""}`;
        navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
        return;
      }

      const errorCode = String(error?.message || "");
      let errorText;
      if (errorCode === "INSUFFICIENT_CREDITS") {
        errorText = isAr
          ? "الرصيد غير كافٍ لتنفيذ الطلب. سجّل الدخول أو رقّي حسابك للمتابعة."
          : "Your balance is not sufficient to complete this request. Sign in or upgrade your account to continue.";
      } else if (errorCode === "AI_PLANNER_ERROR") {
        errorText = isAr ? "تعذر معالجة الطلب بالذكاء الاصطناعي. حاول مرة أخرى." : "AI processing failed. Please try again.";
      } else if (errorCode === "IMAGE_PROVIDER_ERROR") {
        errorText = isAr ? "تعذر إنشاء الصورة. حاول مرة أخرى." : "Image generation failed. Please try again.";
      } else if (errorCode === "NETWORK_TIMEOUT") {
        errorText = isAr ? "انتهت مهلة الطلب. حاول مرة أخرى." : "Request timed out. Please try again.";
      } else if (errorCode === "NETWORK_ERROR") {
        errorText = isAr ? "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت." : "Connection failed. Check your internet connection.";
      } else if (errorCode === "INVALID_RESPONSE") {
        errorText = isAr ? "استجابة غير صالحة من الخادم. حاول مرة أخرى." : "Invalid server response. Please try again.";
      } else if (errorCode === "MESSAGE_TOO_LONG") {
        errorText = isAr ? "الرسالة طويلة جدًا. اختصرها وحاول مرة أخرى." : "Message is too long. Please shorten it.";
      } else {
        errorText = isAr ? "تعذر تنفيذ الطلب حاليًا. حاول مرة أخرى." : "Could not process your request right now. Please try again.";
      }
      if (voiceReply && errorCode === "INSUFFICIENT_CREDITS") {
        // Voice Chat must surface credit failures inside the Voice Overlay immediately.
        // Stop the current playback/listening cycle and keep the user in the voice UI
        // with a clear action instead of silently continuing in the background chat.
        stopVoicePlayback({ completeReply: false });
        setVoiceLimitNotice(errorText);
        setVoiceOverlayTranscript("");
      }

      setMessages((items) => {
        const next = [...items];
        const targetIndex = streamedAssistantKey
          ? next.findIndex((item) => item.streamKey === streamedAssistantKey)
          : -1;
        if (targetIndex >= 0) {
          next[targetIndex] = { ...next[targetIndex], text: errorText, error: true, streaming: false };
          return next;
        }
        return [...next, { role: "assistant", error: true, text: errorText }];
      });
    } finally {
      if (!isQueued) {
        setSending(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  useEffect(() => () => {
    if (streamAudioContextRef.current) {
      streamAudioContextRef.current.close().catch(() => {});
      streamAudioContextRef.current = null;
    }
  }, []);

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const MAX_FILE_SIZE = 8 * 1024 * 1024;
    Promise.all(files.slice(0, 4).map((file) => new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(isAr ? `الملف ${file.name} أكبر من 8 ميجابايت.` : `${file.name} is larger than 8 MB.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", dataUrl: reader.result, size: file.size });
      reader.onerror = () => reject(new Error(isAr ? `تعذر قراءة ${file.name}.` : `Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    }))).then((items) => {
      setAttachments((current) => [...current, ...items].slice(0, 4));
    }).catch((error) => {
      setMessages((items) => [...items, { role: "assistant", error: true, text: error.message }]);
    }).finally(() => {
      event.target.value = "";
    });
  };

  const removeAttachment = (index) => setAttachments((items) => items.filter((_, i) => i !== index));

  const normalizeArabic = (text) => String(text || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  // Voice-based choice selection: if the user's voice transcript matches one
  // of the currently visible choice options, auto-select it instead of
  // sending a plain chat message. No extra AI request or credits consumed.
  const matchVoiceChoice = (transcript) => {
    const text = normalizeArabic(transcript);
    if (!text) return null;
    const latestChoiceMessage = [...messages].reverse().find(
      (item) => item.role === "assistant" && item.choices?.length > 0 &&
      (!item.deferChoices || revealedChoiceKeys.has(item.choiceRevealKey))
    );
    if (!latestChoiceMessage?.choices) return null;
    for (const group of latestChoiceMessage.choices) {
      for (const option of group.options) {
        const label = normalizeArabic(option.label);
        const value = normalizeArabic(option.value);
        if (!label) continue;
        if (text === label || (value && text === value)) return { group, option };
        if (text.includes(label) || (value && text.includes(value))) return { group, option };
      }
    }
    return null;
  };

  const choose = (groupId, option, { voiceReply = false } = {}) => {
    const nextSelections = {
      ...selections,
      [groupId]: option.label,
    };
    setSelections(nextSelections);

    const isLogoChoice = ["style", "colors", "logo_type"].includes(groupId);
    const isLogoWizardComplete = ["style", "colors", "logo_type"].every(
      (key) => nextSelections[key]
    );

    if (groupId === "logo_type") setDesignButtonReady(false);

    // Logo choices are a local sequential wizard. Do NOT send an AI request
    // after every click: the complete choice set is already known from the
    // first planner response. This prevents the planner from re-opening the
    // same three groups and saves API credits.
    if (isLogoChoice) {
      const latestChoiceMessage = [...messages].reverse().find(
        (item) => item.role === "assistant" && Array.isArray(item.choices) && item.choices.length
      );
      const discoveredLogoGroups = (latestChoiceMessage?.choices || []).filter(
        (group) => ["style", "colors", "logo_type"].includes(group?.id)
      );
      if (discoveredLogoGroups.length >= 2) logoWizardGroupsRef.current = discoveredLogoGroups;
      const allGroups = logoWizardGroupsRef.current.length
        ? logoWizardGroupsRef.current
        : (choices || []).filter((group) => ["style", "colors", "logo_type"].includes(group?.id));
      const nextGroup = allGroups.find((group) => !nextSelections[group.id]);

      const summary = isLogoWizardComplete
        ? [
            isAr ? "الأسلوب: " : "Style: ",
            nextSelections.style,
            isAr ? "الألوان: " : "Colors: ",
            nextSelections.colors,
            isAr ? "نوع الشعار: " : "Logo type: ",
            nextSelections.logo_type,
          ].join("\n")
        : "";

      const acknowledgement = {
        role: "assistant",
        text: isLogoWizardComplete
          ? (isAr
              ? "تم اختيار " + option.label + ".\n\nملخص اختيارات الشعار:\n" + summary + "\n\nكل الاختيارات اكتملت. اضغط «ابدأ التصميم» للبدء."
              : "Selected " + option.label + ".\n\nLogo brief:\n" + summary + "\n\nAll choices are complete. Press Start design to begin.")
          : (isAr
              ? "تم اختيار " + option.label + ". الآن اختر " + (nextGroup?.title || "الخيار التالي") + "."
              : "Selected " + option.label + ". Now choose " + (nextGroup?.title || "the next option") + "."),
        studioId: "logo",
        choices: !isLogoWizardComplete && nextGroup ? [nextGroup] : [],
        deferChoices: false,
      };

      setMessages((items) => [
        ...items,
        { role: "user", text: option.label },
        acknowledgement,
      ]);

      if (isLogoWizardComplete) {
        setChoices([]);
        setDesignButtonReady(true);
      } else if (nextGroup) {
        setChoices([nextGroup]);
      }
      return;
    }

    send(option.label, {
      action: "chat",
      designOptions: nextSelections,
      choiceLabel: option.label,
      voiceReply,
    });
  };

  const designNow = () => {
    const label = isAr ? "ابدأ التصميم" : "Start design";
    send(
      isAr ? "صمم الآن" : "Design now",
      { action: "generate", designOptions: selections, choiceLabel: label }
    );
  };

  const selectGeneratedImage = async (message, image) => {
    const assetId = image?.asset_id;
    if (!projectId || !assetId) return;

    try {
      const selected = await assetService.selectAsset(projectId, assetId, message.messageId || null);
      setLastImage(selected.url || image.data_url || null);
      setMessages((items) => items.map((item) => {
        if (item.messageId !== message.messageId) return item;
        return {
          ...item,
          selectedAssetId: assetId,
          assetId,
          asset: { id: assetId, url: selected.url || image.data_url || null },
        };
      }));
    } catch (error) {
      console.error("EYAD asset selection failed", error);
    }
  };

  const approveGeneratedLogo = async (message, image) => {
    const assetId = image?.asset_id;
    if (!projectId || !assetId || approvingLogoAssetId) return;

    setApprovingLogoAssetId(assetId);
    try {
      const current = await projectService.get(projectId);
      if (!current) throw new Error("PROJECT_NOT_FOUND");

      const assetUrl = image?.data_url || image?.url || null;
      const existingBrand = current.project_data?.brand_identity || {};
      const existingLogo = existingBrand.logo || {};
      const brandName =
        current.project_data?.logo_brief?.name ||
        existingBrand.brand_name ||
        current.title ||
        "";

      const brandIdentity = {
        ...existingBrand,
        brand_name: brandName,
        logo: {
          ...existingLogo,
          asset_id: assetId,
          url: assetUrl,
          name: brandName || "Approved Logo",
          // The newly selected asset becomes the active source immediately.
          // Never inherit an older logo SVG while this asset is being vectorized.
          svg_url: null,
        },
      };

      await projectService.update(projectId, {
        status: "completed",
        project_data: {
          ...(current.project_data || {}),
          approved_asset_id: assetId,
          approved_studio: "logo",
        },
      });

      let svgUrl = null;
      try {
        const vectorized = await runEyadEngine({
          message: "Vectorize the approved logo asset into a production SVG.",
          projectId,
          studioId: "logo",
          language: isAr ? "ar" : "en",
          action: "vectorize_logo",
          designOptions: { selected_asset_id: assetId },
        });
        svgUrl = vectorized?.svg_url || null;
      } catch (vectorError) {
        console.warn("[Chat] approved-logo vectorization failed", vectorError);
      }

      await saveBrandIdentity(projectId, {
        ...brandIdentity,
        logo: {
          ...brandIdentity.logo,
          svg_url: svgUrl,
        },
      });

      setApprovedLogoAssetId(assetId);
      setMessages((items) => items.map((item) => {
        if (item.messageId !== message.messageId) return item;
        return {
          ...item,
          selectedAssetId: assetId,
          approvedAssetId: assetId,
        };
      }));
    } catch (error) {
      console.error("[Chat] logo approval failed", error);
    } finally {
      setApprovingLogoAssetId(null);
    }
  };

  const handleCreativeAction = async (action, message) => {
    if (action.kind === "download" && message.image) {
      const response = await fetch(message.image, { mode: "cors" });
      if (!response.ok) throw new Error("DOWNLOAD_FETCH_FAILED");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `eyad-${message.studioId || "design"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }

    if (action.kind === "route") {
      const assetId = action.assetId || message.assetId || message.asset?.id || null;
      const params = new URLSearchParams({ source: "eyad-chat" });
      if (projectId) params.set("project", projectId);
      if (assetId) params.set("asset", assetId);
      if (action.mode) params.set("mode", action.mode);
      const studioPath = action.studioId === "ai-images" || !action.studioId
        ? "/studios/ai-images"
        : `/studios/${action.studioId}`;
      navigate(`${studioPath}?${params.toString()}`);
      return;
    }

    if (action.kind === "command" && action.command) {
      send(action.command, {
        action: "generate",
        choiceLabel: action.label,
        referenceImageOverride: message.image || lastImage,
      });
    }
  };

  const actionIcons = {
    Wand2,
    Palette,
    Image: ImageIcon,
    Presentation,
    RefreshCw,
    Download,
    Pencil,
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset the guest counter when the user becomes a permanent authenticated
  // user, so a fresh guest session starts at zero after logout.
  useEffect(() => {
    if (!isGuest) {
      guestUsageService.reset();
    }
  }, [isGuest]);

  // Resume a pending action (guest-limit chat or creative generation) exactly
  // once after the user logs in. The pending action is cleared before the
  // call so it can never execute twice.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!authChecked || isGuest) return;
    const pending = getPendingAction();
    if (!pending) return;
    resumedRef.current = true;
    clearPendingAction();
    // Allow the component to settle before resuming so state is ready.
    const timer = setTimeout(() => {
      send(pending.message, {
        action: pending.action,
        designOptions: pending.designOptions || {},
        choiceLabel: pending.choiceLabel,
        voiceReply: pending.voiceReply,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [user, isAnonymous, authChecked]); // eslint-disable-line

  // Sync generatingImage → canvas show/completing states for a smooth
  // completion transition (wave slows → brightness pulse → fade → result).
  useEffect(() => {
    if (generatingImage) {
      setShowCanvas(true);
      showCanvasRef.current = true;
      setCanvasCompleting(false);
    } else if (showCanvasRef.current) {
      setCanvasCompleting(true);
    }
  }, [generatingImage]);

  const handleCanvasComplete = () => {
    setShowCanvas(false);
    showCanvasRef.current = false;
    setCanvasCompleting(false);
  };

  const latestChoiceIndex = [...messages]
    .map((message, index) => message.role === "assistant" && message.choices?.length ? index : -1)
    .filter((index) => index >= 0)
    .pop();

  // Voice Chat uses the same structured choice state as text Chat.
  // This prevents interactive logo choices from becoming invisible while
  // the user is speaking with EYAD.
  const latestVoiceChoiceMessage = [...messages].reverse().find(
    (message) =>
      message.role === "assistant" &&
      Array.isArray(message.choices) &&
      message.choices.length > 0 &&
      (!message.deferChoices || revealedChoiceKeys.has(message.choiceRevealKey))
  );
  const voiceChoices = latestVoiceChoiceMessage?.choices || [];

  const logoWizardComplete = ["style", "colors", "logo_type"].every((key) => selections[key]);
  const showDesignButtonAfterLatestChoices =
    logoWizardComplete &&
    designButtonReady;

  return (
    <div className="eyad-chat-page" dir={isAr ? "rtl" : "ltr"}>
      <header className="eyad-chat-page__header">
        <div className="eyad-chat-page__header-actions eyad-chat-page__header-actions--right">
          <button type="button" className="eyad-chat-page__menu" onClick={openHistory} aria-label={isAr ? "سجل المحادثات" : "Chat history"} title={isAr ? "سجل المحادثات" : "Chat history"}>
            <Menu />
          </button>
          <button type="button" className="eyad-chat-page__new-chat" onClick={startNewChat} aria-label={isAr ? "محادثة جديدة" : "New chat"} title={isAr ? "محادثة جديدة" : "New chat"}>
            <Plus />
          </button>
        </div>

        <div className="eyad-chat-page__brand">
          <div>
            <strong>{isAr ? "تحدث مع إياد" : "Chat with EYAD"}</strong>
            <small>{isAr ? "المساعد الإبداعي" : "Creative AI assistant"}</small>
          </div>
        </div>

        <button type="button" className="eyad-chat-page__back" onClick={() => navigate("/home")} aria-label={isAr ? "رجوع" : "Back"}>
          <ArrowLeft />
        </button>
      </header>

      {requestedProjectId && projectContext && (
        <div className="eyad-chat-page__project-context" dir={isAr ? "rtl" : "ltr"}>
          <div className="eyad-chat-page__project-context-main">
            <span className="eyad-chat-page__project-context-orb"><Sparkles /></span>
            <div>
              <strong>{projectContext.project?.title || (isAr ? "مشروع EYAD" : "EYAD Project")}</strong>
              <small>{isAr ? "سياق المشروع متصل" : "Project context connected"}</small>
            </div>
          </div>
          <div className="eyad-chat-page__project-context-meta">
            {projectContext.brand?.logo?.url && <span>{isAr ? "الشعار" : "Logo"} ✓</span>}
            {projectContext.brand?.palette?.id && <span>{isAr ? "الألوان" : "Palette"} ✓</span>}
            {projectContext.latestAsset?.url && <span>{isAr ? "آخر أصل" : "Latest asset"} ✓</span>}
          </div>
        </div>
      )}

      <main className="eyad-chat-page__body">
        {/* Durable jobs are intentionally invisible in the chat UI. */}
        {projectLoading ? (
          <div className="eyad-chat-page__welcome">
            <span className="eyad-chat-page__welcome-icon is-loading"><img src={eyadIconSrc} alt="" /></span>
            <p>{isAr ? "بفتح مشروعك ومحادثته..." : "Opening your project and its conversation..."}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="eyad-chat-page__welcome">
            <span className="eyad-chat-page__welcome-icon"><img src={eyadIconSrc} alt="" /></span>
            <h1>{isAr ? "أنا إياد." : "I'm EYAD."}</h1>
            <p>{isAr ? "قول اللي في بالك وأنا أبدأ التصميم" : "Tell me what's on your mind and I'll start designing."}</p>

          </div>
        ) : (
          <div className="eyad-chat-page__messages">
            {messages.map((message, index) => (
              <React.Fragment key={index}>
                <div className={`eyad-chat-page__message ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                  {message.role === "assistant" && <span className="eyad-chat-page__message-icon"><img src={eyadIconSrc} alt="" /></span>}
                  <div className="eyad-chat-page__message-content">
                    {message.text && (
                      <div className="eyad-chat-page__text-row">
                        <div className="eyad-chat-page__text">{message.text}</div>

                      </div>
                    )}
                    {message.loginPrompt && (
                      <div className="eyad-chat-page__design-button-wrap">
                        <button
                          type="button"
                          className="eyad-chat-page__design-button"
                          onClick={() => {
                            const currentPath = `/chat${requestedProjectId ? `?project=${encodeURIComponent(requestedProjectId)}` : ""}`;
                            navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
                          }}
                        >
                          {isAr ? "تسجيل الدخول / إنشاء حساب" : "Log in / Create account"}
                        </button>
                      </div>
                    )}
                    {message.attachments?.length > 0 && (
                      <div className="eyad-chat-page__sent-attachments">
                        {message.attachments.map((file, fileIndex) => (
                          <div className="eyad-chat-page__sent-file" key={`${file.name}-${fileIndex}`}>
                            {file.type.startsWith("image/") ? <img src={file.dataUrl} alt={file.name} /> : <FileText />}
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {((Array.isArray(message.images) && message.images.length > 0) || message.image) && (
                  (() => {
                    const images = Array.isArray(message.images) && message.images.length
                      ? message.images
                      : [{ data_url: message.image, asset_id: message.assetId }];
                    const selectedId = message.selectedAssetId || null;
                    const selectedImage = images.find((item) => item.asset_id === selectedId) || null;
                    const isLogoResult = (message.studioId || studioId) === "logo";

                    return (
                      <>
                        <div className="eyad-chat-page__generated-grid" aria-label={isAr ? "التصميمات المولدة" : "Generated designs"}>
                          {images.slice(0, 2).map((image, imageIndex) => {
                            const assetId = image.asset_id;
                            const isSelected = Boolean(assetId && selectedId === assetId);

                            return (
                              <article key={assetId || imageIndex} className={`eyad-chat-page__generated-card ${isSelected ? "is-selected" : ""}`}>
                                <button
                                  type="button"
                                  className="eyad-chat-page__generated-card-image"
                                  onClick={() => setLightboxImage(image.data_url)}
                                  aria-label={isAr ? `فتح التصميم ${imageIndex + 1}` : `Open design ${imageIndex + 1}`}
                                >
                                  <img src={image.data_url} alt={isAr ? `التصميم ${imageIndex + 1}` : `Design ${imageIndex + 1}`} />
                                </button>

                                <span className="eyad-chat-page__generated-number">{imageIndex + 1}</span>

                                {assetId && (
                                  <button
                                    type="button"
                                    className={`eyad-chat-page__generated-check ${isSelected ? "is-checked" : ""}`}
                                    onClick={() => selectGeneratedImage(message, image)}
                                    aria-label={isAr ? `اختيار التصميم ${imageIndex + 1}` : `Select design ${imageIndex + 1}`}
                                    aria-pressed={isSelected}
                                  >
                                    {isSelected ? <Check /> : null}
                                  </button>
                                )}

                                <div className="eyad-chat-page__generated-card-actions">
                                  <button type="button" onClick={async () => {
                                    const response = await fetch(image.data_url, { mode: "cors" });
                                    if (!response.ok) throw new Error("DOWNLOAD_FETCH_FAILED");
                                    const blob = await response.blob();
                                    const objectUrl = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = objectUrl;
                                    link.download = `eyad-${isLogoResult ? "logo" : "design"}-${imageIndex + 1}.png`;
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                                  }}>
                                    <Download />
                                    <span>{isAr ? "تنزيل PNG" : "Download PNG"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="is-primary"
                                    onClick={() => {
                                      const chosen = { ...message, assetId: assetId || message.assetId, image: image.data_url };
                                      handleCreativeAction(
                                        { id: "open_studio", kind: "route", studioId: isLogoResult ? "logo" : (message.studioId || "ai-images"), mode: isLogoResult ? "ai" : undefined },
                                        chosen
                                      );
                                    }}
                                  >
                                    <Pencil />
                                    <span>{isAr ? (isLogoResult ? "تعديل هذا الشعار" : "فتح هذا التصميم") : (isLogoResult ? "Edit this logo" : "Open this design")}</span>
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>

                        <div className="eyad-chat-page__generated-selection-actions">
                          {selectedImage && isLogoResult ? (
                            <>
                              <button
                                type="button"
                                className="is-primary"
                                onClick={() => approveGeneratedLogo(
                                  messages.find((item) => item.messageId === message.messageId) || message,
                                  selectedImage
                                )}
                                disabled={sending || approvingLogoAssetId === selectedImage.asset_id}
                              >
                                {approvingLogoAssetId === selectedImage.asset_id ? <Loader2 /> : approvedLogoAssetId === selectedImage.asset_id ? <Check /> : <Check />}
                                <span>{approvedLogoAssetId === selectedImage.asset_id
                                  ? (isAr ? "تم اعتماد الشعار" : "Logo approved")
                                  : (isAr ? "اعتماد الشعار" : "Approve logo")}</span>
                              </button>

                              <button
                                type="button"
                                className="is-primary"
                                onClick={() => handleCreativeAction(
                                  { id: "open_logo_studio", kind: "route", studioId: "logo", mode: "ai" },
                                  { ...message, assetId: selectedImage.asset_id, image: selectedImage.data_url }
                                )}
                                disabled={sending}
                              >
                                <Pencil />
                                <span>{isAr ? "تعديل في استوديو الشعارات" : "Edit in Logo Studio"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCreativeAction(
                                  { id: "visual_identity", kind: "route", studioId: "brand-kit" },
                                  { ...message, assetId: selectedImage.asset_id, image: selectedImage.data_url }
                                )}
                                disabled={sending}
                              >
                                <Palette />
                                <span>{isAr ? "الذهاب إلى الهوية البصرية" : "Go to Visual Identity"}</span>
                              </button>
                            </>
                          ) : (
                            <div className="eyad-chat-page__generated-hint">
                              <Check />
                              <span>{isAr ? "اختر صورة واحدة للمتابعة." : "Select one image to continue."}</span>
                            </div>
                          )}
                        </div>

                        <div className="eyad-chat-page__creative-actions" aria-label={isAr ? "إجراءات التصميم" : "Design actions"}>
                          {getCreativeActions(message.studioId || studioId, language)
                            .filter((action) => !["open_studio", "visual_identity", "ai_images", "presentation"].includes(action.id))
                            .map((action) => {
                              const Icon = actionIcons[action.icon] || Wand2;
                              return (
                                <button
                                  key={action.id}
                                  type="button"
                                  onClick={() => handleCreativeAction(action, { ...message, assetId: selectedImage?.asset_id || message.assetId, image: selectedImage?.data_url || message.image })}
                                  disabled={sending}
                                >
                                  <Icon />
                                  <span>{action.label}</span>
                                </button>
                              );
                            })}
                        </div>
                      </>
                    );
                  })()
                )}

                {message.role === "assistant" && message.choices?.length > 0 && (!message.deferChoices || revealedChoiceKeys.has(message.choiceRevealKey)) && (
                  <div className="eyad-chat-page__choice-card">
                    {message.choices
                      .filter((group) => {
                        const isLogoGroup = ["style", "colors", "logo_type"].includes(group.id);
                        if (!isLogoGroup) return true;
                        const isLatestChoiceMessage = messages[latestChoiceIndex] === message;
                        if (!isLatestChoiceMessage) return false;
                        const activeLogoGroupId =
                          !selections.style ? "style" :
                          !selections.colors ? "colors" :
                          !selections.logo_type ? "logo_type" :
                          null;
                        return !activeLogoGroupId || group.id === activeLogoGroupId;
                      })
                      .slice(0, message.choices.some((group) => ["style", "colors", "logo_type"].includes(group.id)) ? 1 : message.choices.length)
                      .map((group) => (
                      <div className="eyad-chat-page__choice-group" key={group.id}>
                        <div className="eyad-chat-page__choice-title">{group.title}</div>
                        <div className="eyad-chat-page__choice-options">
                          {group.options.map((option) => {
                            const active = selections[group.id] === option.label;
                            const paletteColors = group.id === "colors"
                              ? (String(option.value || "").match(/#[0-9A-Fa-f]{6}/g) || [])
                              : [];
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={active ? "is-active" : ""}
                                onClick={() => choose(group.id, option)}
                              >
                                {paletteColors.length > 0 && (
                                  <span className="eyad-chat-page__palette-swatches" aria-hidden="true">
                                    {paletteColors.slice(0, 2).map((hex) => (
                                      <span key={hex} style={{ backgroundColor: hex }} />
                                    ))}
                                  </span>
                                )}
                                {active && <Check />}
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}

            {showDesignButtonAfterLatestChoices && (
              <div className="eyad-chat-page__design-button-wrap">
                <button type="button" className="eyad-chat-page__design-button" onClick={designNow} disabled={sending}>
                  {sending ? <Loader2 className="is-spin" /> : <Sparkles />}
                  {isAr ? "ابدأ التصميم" : "Start design"}
                </button>
              </div>
            )}


            {(generatingImage || canvasCompleting) && (
              <GeneratingCanvas
                variant="full"
                completing={canvasCompleting}
                onComplete={handleCanvasComplete}
              />
            )}
          </div>
        )}
      </main>

      {historyOpen && (
        <div className="eyad-chat-page__history-overlay" onClick={() => setHistoryOpen(false)}>
          <aside className="eyad-chat-page__history-drawer" onClick={(event) => event.stopPropagation()} aria-label={isAr ? "سجل المحادثات" : "Chat history"}>
            <div className="eyad-chat-page__history-header">
              <div>
                <strong>{isAr ? "سجل المحادثات" : "Chat history"}</strong>
                <small>{isAr ? "كل مشاريع ومحادثات EYAD" : "All EYAD projects and chats"}</small>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label={isAr ? "إغلاق" : "Close"}><X /></button>
            </div>
            <div className="eyad-chat-page__history-list">
              {historyLoading ? (
                <div className="eyad-chat-page__history-empty"><Loader2 className="is-spin" /><span>{isAr ? "جاري تحميل السجل…" : "Loading history…"}</span></div>
              ) : historyProjects.length ? historyProjects.map((item) => (
                <button key={item.id} type="button" className={`eyad-chat-page__history-item ${item.id === projectId ? "is-active" : ""}`} onClick={() => { setHistoryOpen(false); navigate(`/chat?project=${encodeURIComponent(item.id)}`); }}>
                  <span className="eyad-chat-page__history-item-icon"><img src={eyadIconSrc} alt="" /></span>
                  <span className="eyad-chat-page__history-item-text"><strong>{item.title || (isAr ? "محادثة جديدة" : "New chat")}</strong><small>{item.lastMessagePreview || item.studio_type || (isAr ? "محادثة EYAD" : "EYAD chat")}</small></span>
                </button>
              )) : (
                <div className="eyad-chat-page__history-empty"><span>{isAr ? "لا توجد محادثات محفوظة بعد." : "No saved chats yet."}</span></div>
              )}
            </div>
          </aside>
        </div>
      )}

      <div className="eyad-chat-page__composer-wrap">
        {attachments.length > 0 && (
          <div className="eyad-chat-page__attachment-preview">
            {attachments.map((file, index) => (
              <div className="eyad-chat-page__attachment-chip" key={`${file.name}-${index}`}>
                {file.type.startsWith("image/") ? <img src={file.dataUrl} alt="" /> : <FileText />}
                <span>{file.name}</span>
                <button type="button" onClick={() => removeAttachment(index)} aria-label={isAr ? "إزالة الملف" : "Remove file"}><X /></button>
              </div>
            ))}
          </div>
        )}
        <div className="eyad-chat-page__composer">
          <button type="button" className="eyad-chat-page__composer-plus" onClick={() => fileInputRef.current?.click()} aria-label={isAr ? "إضافة صورة أو ملف" : "Add photo or file"}>
            <Plus />
          </button>
          <input ref={fileInputRef} type="file" hidden multiple accept="image/*,.pdf,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleFiles} />
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={isAr ? "اكتب رسالتك لإياد..." : "Write your message to EYAD..."}
        />
        <button type="button" className="eyad-chat-page__send" onClick={() => send()} disabled={(!input.trim() && attachments.length === 0) || sending} aria-label={isAr ? "إرسال" : "Send"}>
          <Send />
        </button>
        <EyadMiniOrb
          active={voiceOverlayOpen}
          onClick={() => { unlockVoicePlayback(); setVoiceOverlayOpen(true); }}
          ariaLabel={isAr ? "التحدث مع إياد" : "Talk to EYAD"}
        />
        </div>
      </div>

      {lightboxImage && (
        <div className="eyad-chat-page__image-lightbox" onClick={() => setLightboxImage(null)} role="dialog" aria-modal="true" aria-label={isAr ? "عرض الصورة بالحجم الكامل" : "Full screen image"}>
          <button type="button" className="eyad-chat-page__image-lightbox-close" onClick={() => setLightboxImage(null)} aria-label={isAr ? "إغلاق" : "Close"}><X /></button>
          <img src={lightboxImage} alt={isAr ? "التصميم بالحجم الكامل" : "Full-size design"} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <VoiceOverlay
        open={voiceOverlayOpen}
        onClose={() => {
          stopVoicePlayback({ completeReply: false });
          setVoiceOverlayOpen(false);
          setVoiceOverlayTranscript("");
          setVoicePlaybackError("");
          setVoiceLimitNotice("");
        }}
        onTranscript={(text) => {
          if (voiceLimitNotice) return;
          setVoiceOverlayTranscript(text);
          const matchedChoice = matchVoiceChoice(text);
          if (matchedChoice) {
            choose(matchedChoice.group.id, matchedChoice.option, { voiceReply: true });
          } else {
            send(text, { voiceReply: true });
          }
        }}
        onVoiceGesture={() => {
          setVoicePlaybackError("");
          unlockVoicePlayback();
        }}
        choices={voiceChoices}
        selections={selections}
        onChoice={(groupId, option) => choose(groupId, option, { voiceReply: true })}
        showDesignButton={showDesignButtonAfterLatestChoices}
        onDesign={designNow}
        onStopSpeaking={stopVoicePlayback}
        voiceState={
          sending || processing ? "thinking" :
          generatingImage ? "thinking" :
          voiceLoading ? "speaking" :
          "idle"
        }
        liveTranscript={voiceOverlayTranscript}
        errorMessage={voiceLimitNotice || voicePlaybackError}
        onLogin={() => {
          const currentPath = `/chat${requestedProjectId ? `?project=${encodeURIComponent(requestedProjectId)}` : ""}`;
          navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
        }}
      />

    </div>
  );
}