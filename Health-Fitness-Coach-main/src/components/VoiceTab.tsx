import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VoicePipeline, ModelCategory } from "@runanywhere/web";
import { AudioCapture, AudioPlayback, VAD, SpeechActivity } from "@runanywhere/web-onnx";
import { useGlobalModelLoader } from "../hooks/useGlobalModelLoader";
import { ModelBanner } from "./ModelBanner";

type VoiceState = "idle" | "loading-models" | "listening" | "processing" | "speaking";

export function VoiceTab() {
  const llmLoader = useGlobalModelLoader(ModelCategory.Language);
  const sttLoader = useGlobalModelLoader(ModelCategory.SpeechRecognition);
  const ttsLoader = useGlobalModelLoader(ModelCategory.SpeechSynthesis);
  const vadLoader = useGlobalModelLoader(ModelCategory.Audio);

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const micRef = useRef<AudioCapture | null>(null);
  const pipelineRef = useRef<VoicePipeline | null>(null);
  const vadUnsubRef = useRef<null | (() => void)>(null);
  const processingRef = useRef(false);

  const allReady =
    vadLoader.state === "ready" &&
    sttLoader.state === "ready" &&
    llmLoader.state === "ready" &&
    ttsLoader.state === "ready";

  const ensureModels = useCallback(async (): Promise<boolean> => {
    setVoiceState("loading-models");
    setError(null);

    const results = await Promise.all([
      vadLoader.ensure(),
      sttLoader.ensure(),
      llmLoader.ensure(),
      ttsLoader.ensure(),
    ]);

    const ok = results.every(Boolean);
    setVoiceState("idle");
    if (!ok) setError("Voice models could not be loaded. Please retry.");
    return ok;
  }, [vadLoader, sttLoader, llmLoader, ttsLoader]);

  // Preload models once
  useEffect(() => {
    ensureModels();
  }, [ensureModels]);

  const cleanupVAD = useCallback(() => {
    vadUnsubRef.current?.();
    vadUnsubRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    cleanupVAD();
    setAudioLevel(0);
    setVoiceState("idle");
    processingRef.current = false;
  }, [cleanupVAD]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const processSpeech = useCallback(
    async (audioData: Float32Array) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const pipeline = pipelineRef.current;
      if (!pipeline) return;

      // pause listening during processing
      micRef.current?.stop();
      cleanupVAD();
      setVoiceState("processing");

      try {
        const result = await pipeline.processTurn(
          audioData,
          {
            maxTokens: 80,
            temperature: 0.7,
            systemPrompt:
              "You are a helpful voice assistant for fitness and health. Keep replies concise and actionable (1–2 sentences).",
          },
          {
            onTranscription: (text) => setTranscript(text),
            onResponseToken: (_tok, accumulated) => setResponse(accumulated),
            onResponseComplete: (text) => setResponse(text),
            onSynthesisComplete: async (audio, sampleRate) => {
              setVoiceState("speaking");
              const player = new AudioPlayback({ sampleRate });

              try {
                await player.play(audio, sampleRate);
              } finally {
                player.dispose();
              }
            },
            onStateChange: (s) => {
              if (s === "processingSTT") setVoiceState("processing");
              if (s === "generatingResponse") setVoiceState("processing");
              if (s === "playingTTS") setVoiceState("speaking");
            },
          }
        );

        if (result) {
          setTranscript(result.transcription || "");
          setResponse(result.response || "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setVoiceState("idle");
        setAudioLevel(0);
        processingRef.current = false;

        // Auto-resume listening for a continuous assistant feel
        // If you don’t want auto-resume, remove next line.
        setTimeout(() => {
          startListening();
        }, 250);
      }
    },
    [cleanupVAD]
  );

  const startListening = useCallback(async () => {
    setTranscript("");
    setResponse("");
    setError(null);

    if (!allReady) {
      const ok = await ensureModels();
      if (!ok) return;
    }

    if (!pipelineRef.current) pipelineRef.current = new VoicePipeline();

    setVoiceState("listening");
    processingRef.current = false;

    try {
      const mic = new AudioCapture({ sampleRate: 16000 });
      micRef.current = mic;

      VAD.reset();

      cleanupVAD();
      vadUnsubRef.current = VAD.onSpeechActivity((activity) => {
        if (processingRef.current) return;

        if (activity === SpeechActivity.Ended) {
          const segment = VAD.popSpeechSegment();

          // ignore tiny segments (breath/noise)
          if (segment?.samples && segment.samples.length > 3200) {
            processSpeech(segment.samples);
          }
        }
      });

      await mic.start(
        (chunk) => VAD.processSamples(chunk),
        (level) => setAudioLevel(level)
      );
    } catch (e) {
      setVoiceState("idle");
      setAudioLevel(0);
      setError(
        "Microphone permission denied or unavailable. Allow mic access in the browser and reload."
      );
      stopListening();
    }
  }, [allReady, ensureModels, cleanupVAD, processSpeech, stopListening]);

  const pendingLoaders = useMemo(
    () =>
      [
        { label: "VAD", loader: vadLoader },
        { label: "STT", loader: sttLoader },
        { label: "LLM", loader: llmLoader },
        { label: "TTS", loader: ttsLoader },
      ].filter((l) => l.loader.state !== "ready"),
    [vadLoader, sttLoader, llmLoader, ttsLoader]
  );

  return (
    <div className="tab-panel voice-panel">
      {pendingLoaders.length > 0 && (
        <ModelBanner
          state={pendingLoaders[0].loader.state}
          progress={pendingLoaders[0].loader.progress}
          error={pendingLoaders[0].loader.error}
          onLoad={ensureModels}
          label={`Voice (${pendingLoaders.map((l) => l.label).join(", ")})`}
          category={ModelCategory.Audio}
        />
      )}

      {error && (
        <div className="model-banner">
          <span className="error-text">{error}</span>
        </div>
      )}

      <div className="voice-center">
        <div
          className="voice-orb"
          data-state={voiceState}
          style={{ ["--level" as any]: audioLevel } as React.CSSProperties}
        >
          <div className="voice-orb-inner" />
        </div>

        <p className="voice-status">
          {voiceState === "idle" && "Ready. Tap to start listening."}
          {voiceState === "loading-models" && "Loading voice components..."}
          {voiceState === "listening" && "Listening..."}
          {voiceState === "processing" && "Processing..."}
          {voiceState === "speaking" && "Speaking..."}
        </p>

        {(voiceState === "idle" || voiceState === "loading-models") && (
          <button className="btn btn-primary btn-lg" onClick={startListening} disabled={voiceState === "loading-models"}>
            Start
          </button>
        )}

        {voiceState === "listening" && (
          <button className="btn btn-lg" onClick={stopListening}>
            Stop
          </button>
        )}
      </div>

      {transcript && (
        <div className="voice-transcript">
          <h4>Transcript</h4>
          <p>{transcript}</p>
        </div>
      )}

      {response && (
        <div className="voice-response">
          <h4>Response</h4>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}