import { useEffect, useState } from "react";
import { checkStatus } from "../api";

export default function StatusPanel({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState("processing");

  useEffect(() => {
    const t = setInterval(async () => {
      const s = await checkStatus(jobId);
      setStatus(s);
    }, 5000);

    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div className="border border-white/20 rounded p-4 text-center">
      Status: <b>{status}</b>
      {status === "done" && (
        <a
          className="block mt-3 underline text-brand"
          href={`/download/${jobId}`}
        >
          Download Video
        </a>
      )}
    </div>
  );
}
