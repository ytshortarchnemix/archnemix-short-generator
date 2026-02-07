import { useState } from "react";

interface Props {
  script: string;
  voice: string;
  onAudioReady: (url: string) => void;
}

export default function GenerateButton({ script, voice, onAudioReady }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    if (!script.trim()) {
      alert("Please enter a script");
      return;
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(script);

    const voices = synth.getVoices();
    const selectedVoice = voices.find(v => v.name === voice);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.rate = 1;
    utterance.pitch = 1;

    setLoading(true);

    utterance.onend = () => {
      setLoading(false);
    };

    synth.cancel();
    synth.speak(utterance);
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-purple-600 hover:bg-purple-700 transition px-6 py-3 rounded-xl font-semibold mt-4"
    >
      {loading ? "Generating..." : "Generate Voice"}
    </button>
  );
}
