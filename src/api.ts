const API_BASE = import.meta.env.VITE_API_BASE!;
const APP_KEY = import.meta.env.VITE_APP_KEY!;

export interface GenerateResponse {
  job_id: string;
  status: string;
  download_url: string;
}

/**
 * Start video generation
 */
export async function generateVideo(payload: {
  audio_base64: string;
  subtitles_ass: string;
  background: string;
}): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APP-KEY": APP_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Generation failed");
  }

  return res.json();
}

/**
 * Check job status
 */
export async function checkStatus(jobId: string): Promise<{
  status: string;
  download_url?: string;
}> {
  const res = await fetch(`${API_BASE}/status/${jobId}`, {
    headers: {
      "X-APP-KEY": APP_KEY,
    },
  });

  if (!res.ok) {
    throw new Error("Status check failed");
  }

  return res.json();
}
