import { useState } from "react";
import Header from "./components/Header";
import ScriptInput from "./components/ScriptInput";
import VoiceSelect from "./components/VoiceSelect";
import GenerateButton from "./components/GenerateButton";
import StatusPanel from "./components/StatusPanel";
import Footer from "./components/Footer";

export default function App() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("en-US");
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto p-6 space-y-6">
        <ScriptInput value={script} onChange={setScript} />
        <VoiceSelect value={voice} onChange={setVoice} />

        <GenerateButton
          script={script}
          voice={voice}
          onJobCreated={setJobId}
        />

        {jobId && <StatusPanel jobId={jobId} />}
      </main>

      <Footer />
    </div>
  );
}
