import { useEffect, useRef, useState } from "react";
import GenerateButton from "./components/GenerateButton";
import { generateSubtitles, SubtitleLine } from "./utils/subtitles";

export default function App() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [subs, setSubs] = useState<SubtitleLine[]>([]);
  const [currentSub, setCurrentSub] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // ⏱ Sync subtitles with audio playback
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const line = subs.find(s => t >= s.start && t <= s.end);
      setCurrentSub(line ? line.text : "");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [subs]);

  return (
    <div className="min-h-screen bg-black text-white p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Archnemix Shorts Generator
      </h1>

      {/* SCRIPT */}
      <textarea
        className="w-full p-4 text-black rounded-lg mb-4"
        rows={6}
        placeholder="Enter your YouTube Shorts script..."
        value={script}
        onChange={e => setScript(e.target.value)}
      />

      {/* VOICE */}
      <select
        className="w-full p-3 text-black rounded-lg mb-4"
        value={voice}
        onChange={e => setVoice(e.target.value)}
      >
        <option value="">Select a voice</option>
        {voices.map(v => (
          <option key={v.name} value={v.name}>
            {v.name}
          </option>
        ))}
      </select>

      {/* GENERATE */}
      <GenerateButton
        script={script}
        voice={voice}
        onAudioReady={(url) => {
          setAudioUrl(url);

          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
            const subtitles = generateSubtitles(script, audio.duration);
            setSubs(subtitles);
          };
        }}
      />

      {/* AUDIO PLAYER */}
      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="mt-6 w-full"
          />

          {/* SUBTITLES DISPLAY */}
          <div className="mt-6 text-center text-xl font-semibold bg-black/70 p-4 rounded-lg">
            {currentSub}
          </div>
        </>
      )}
    </div>
  );
}
