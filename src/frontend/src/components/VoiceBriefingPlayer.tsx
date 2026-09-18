import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Radio } from 'lucide-react';

interface VoiceBriefingPlayerProps {
  briefingText: string;
  title?: string;
}

export const VoiceBriefingPlayer: React.FC<VoiceBriefingPlayerProps> = ({
  briefingText,
  title = 'Harbor Controller Voice Dispatch',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser speech synthesis support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Prefer natural, English voices (Google US English, Samantha, Daniel, or Microsoft David)
        const preferred = voices.find(
          (v) =>
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('David') ||
              v.name.includes('Daniel') ||
              v.name.includes('English')) &&
            v.lang.startsWith('en')
        );
        setSelectedVoice(preferred || voices[0] || null);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Clean raw markdown to clean readable speech
  const sanitizeForSpeech = (raw: string): string => {
    return raw
      .replace(/#{1,6}\s+/g, '') // remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
      .replace(/\*(.*?)\*/g, '$1') // remove italic
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // remove code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // remove links
      .replace(/-{3,}/g, '') // remove horizontal lines
      .replace(/[•\-\*]\s+/g, '. ') // bullet points to pauses
      .replace(/T\+(\d+)h/g, 'T plus $1 hours') // T+6h -> T plus 6 hours
      .replace(/ULCV/g, 'Ultra Large Container Vessel')
      .replace(/ETA/g, 'E T A')
      .replace(/STS/g, 'Ship to Shore')
      .replace(/TEU/g, 'T E U')
      .replace(/B-(\d+)/g, 'Berth $1')
      .trim();
  };

  const DEFAULT_CONTROLLER_BRIEFING =
    "Attention shift supervisor: Berth 03 has an incoming Ultra Large Container Vessel with a 45-minute tidal constraint. Recommending slow-steaming advisory on IMO9200004. Berth 01 currently discharging MSC Oscar with 4 ship-to-shore cranes at 28 moves per hour. Quayside fairway is clear with current channel draft at 18.5 meters. Zero berth collisions detected across the 72-hour planning window.";

  const handlePlay = () => {
    if (!isSupported) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();

    const textToSpeak = briefingText && briefingText.trim().length > 0
      ? briefingText
      : DEFAULT_CONTROLLER_BRIEFING;

    const cleanText =
      "PortPulse Harbor Master Control. Dispatching quayside shift handover briefing. " +
      sanitizeForSpeech(textToSpeak) +
      " End of dispatch. Over and out.";

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = playbackSpeed;
    utterance.pitch = 0.96; // Slightly deeper, crisp maritime air traffic style
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const toggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.2 : playbackSpeed === 1.2 ? 0.9 : 1.0;
    setPlaybackSpeed(nextSpeed);
    if (isPlaying) {
      handleStop();
      setTimeout(handlePlay, 100);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-950 p-4 shadow-lg shadow-cyan-500/5 backdrop-blur-md">
      {/* Top subtle maritime radar pulse */}
      <div className="absolute top-0 right-0 h-full w-48 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
        {/* Left: Radio Dispatch Header */}
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-cyan-500/20 border-cyan-400/50 shadow-md shadow-cyan-500/30 text-cyan-300 ring-2 ring-cyan-400/20'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Radio className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-cyan-400' : ''}`} />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                🎙️ {title}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono font-bold">
                VHF CH-16 PORT-OPS
              </span>
              {isPlaying && (
                <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>LIVE TRANSMITTING</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Natural AI Voice Synthesis for Shift Handover &amp; Emergency Navigational Advisories
            </p>
          </div>
        </div>

        {/* Center: Live Soundwave Equalizer */}
        <div className="flex items-center space-x-4 self-center md:self-auto">
          {isPlaying ? (
            <div className="flex items-center space-x-2 bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-500/30">
              <span className="text-[10px] font-mono text-cyan-300">AUDIO OUT</span>
              <div className="equalizer-container">
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
                <div className="equalizer-bar" />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-1 text-[11px] text-slate-500 font-mono">
              <span>FREQUENCY NOMINAL</span>
            </div>
          )}

          {/* Right: Audio Playback Controls */}
          <div className="flex items-center space-x-1.5">
            {!isPlaying ? (
              <button
                type="button"
                onClick={handlePlay}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black tracking-wide shadow-lg shadow-cyan-500/25 transition flex items-center space-x-2 active:scale-95"
                title="Play Voice-Powered Harbor Controller Audio Shift Briefing"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPaused ? 'Resume Handover Audio' : 'Listen to Handover Audio'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="px-3 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center space-x-1.5 active:scale-95"
                title="Pause Dispatch"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            )}

            {(isPlaying || isPaused) && (
              <button
                type="button"
                onClick={handleStop}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 border border-slate-700 transition active:scale-95"
                title="Stop Audio Broadcast"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            {/* Playback speed toggle */}
            <button
              type="button"
              onClick={toggleSpeed}
              className="px-2 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-bold border border-slate-700 transition"
              title="Toggle Playback Speed (0.9x / 1.0x / 1.2x)"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
