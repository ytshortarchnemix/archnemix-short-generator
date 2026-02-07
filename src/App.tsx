import { useEffect, useState } from "react";
import GenerateButton from "./components/GenerateButton";

export default function App() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

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
        onAudioReady={setAudioUrl}
      />

      {/* DOWNLOAD */}
      {audioUrl && (
        <a
          href={audioUrl}
          download="archnemix-voice.webm"
          className="block mt-6 text-purple-400 underline"
        >
          Download Audio
        </a>
      )}
    </div>
  );
}
