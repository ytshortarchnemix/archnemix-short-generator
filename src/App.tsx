import { useEffect, useState } from "react";
import GenerateButton from "./components/GenerateButton";
import { generateASS } from "./utils/assSubtitles";

export default function App() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [assFile, setAssFile] = useState<string>("");

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleAudioReady = (url: string) => {
    setAudioUrl(url);

    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      const duration = audio.duration;

      if (!duration || isNaN(duration)) {
        console.error("❌ Invalid audio duration");
        return;
      }

      const ass = generateASS(script, duration);
      console.log("✅ ASS GENERATED:\n", ass);

      setAssFile(ass);
    };
  };

  const downloadASS = () => {
    if (!assFile.trim()) {
      alert("Subtitles not ready yet");
      return;
    }

    const blob = new Blob([assFile], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "archnemix_subtitles.ass";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Archnemix Shorts Generator
      </h1>

      <textarea
        className="w-full p-4 text-black rounded-lg mb-4"
        rows={6}
        placeholder="Enter Shorts script..."
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />

      <select
        className="w-full p-3 text-black rounded-lg mb-4"
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
      >
        <option value="">Select voice</option>
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name}
          </option>
        ))}
      </select>

      <GenerateButton
        script={script}
        voice={voice}
        onAudioReady={handleAudioReady}
      />

      {audioUrl && (
        <audio
          src={audioUrl}
          controls
          className="mt-6 w-full"
        />
      )}

      {assFile && (
        <button
          onClick={downloadASS}
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 p-3 rounded-lg font-bold"
        >
          Download Subtitles (.ass)
        </button>
      )}
    </div>
  );
}
