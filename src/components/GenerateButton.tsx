import { useState } from "react";

interface Props {
  script: string;
  voice: string;
  onAudioReady: (url: string) => void;
}

export default function GenerateButton({ script, voice, onAudioReady }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
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

    // 🔊 Audio capture setup
    const stream = new MediaStream();
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    stream.addTrack(destination.stream.getAudioTracks()[0]);

    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = e => chunks.push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      onAudioReady(url);
      setLoading(false);
    };

    recorder.start();
    setLoading(true);

    utterance.onend = () => {
      recorder.stop();
      audioContext.close();
    };

    synth.cancel();
    synth.speak(utterance);
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl font-semibold mt-4"
    >
      {loading ? "Generating Audio..." : "Generate Audio"}
    </button>
  );
}
