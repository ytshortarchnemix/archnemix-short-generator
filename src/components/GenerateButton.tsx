import { useState } from "react";
import { generateVideo } from "../api";
import { checkRateLimit } from "../utils/rateLimit";

type Props = {
  script: string;
  audioBase64: string;
  subtitlesASS: string;
  background: string;
  onJobCreated: (jobId: string) => void;
};

export default function GenerateButton({
  script,
  audioBase64,
  subtitlesASS,
  background,
  onJobCreated
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);

    // UI rate‑limit
    const limit = checkRateLimit();
    if (!limit.allowed) {
      setError("Daily limit reached. Try again later.");
      return;
    }

    if (!script || !audioBase64 || !subtitlesASS) {
      setError("Missing script, audio, or subtitles.");
      return;
    }

    try {
      setLoading(true);

      const res = await generateVideo({
        audioBase64,
        subtitlesASS,
        background
      });

      onJobCreated(res.job_id);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                   text-white font-semibold py-3 rounded-xl transition"
      >
        {loading ? "Generating..." : "Generate Video"}
      </button>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
