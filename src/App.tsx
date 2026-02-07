import { useState } from "react";
import ScriptInput from "./components/ScriptInput";
import VoiceSelect from "./components/VoiceSelect";

export default function App() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("male_en_1");

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-2xl p-6 space-y-6">
        <h1 className="text-2xl font-bold">
          Archnemix Shorts Generator
        </h1>

        <ScriptInput
          script={script}
          setScript={setScript}
        />

        <VoiceSelect
          voice={voice}
          setVoice={setVoice}
        />

        {/* DEBUG PANEL – REMOVE LATER */}
        <div className="bg-zinc-900 p-4 rounded-lg text-sm text-zinc-300">
          <div><b>Selected Voice:</b> {voice}</div>
          <div className="mt-2">
            <b>Script Preview:</b>
            <div className="mt-1 text-zinc-400">
              {script || "— empty —"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
