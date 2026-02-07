// src/api.ts

const API_BASE = "https://ytshrt-archx-mc-1.hf.space"; 
// 👆 replace with your HF Space URL if different

const APP_KEY = import.meta.env.VITE_APP_KEY;

if (!APP_KEY) {
  console.warn("⚠ VITE_APP_KEY not set");
}

export async function generateVideo(params: {
  audioBase64: string;
  subtitlesASS: string;
  background: string;
}): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APP-KEY": APP_KEY
    },
    body: JSON.stringify({
      audio_base64: params.audioBase64,
      subtitles_ass: params.subtitlesASS,
      background: params.background
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Generation failed");
  }

  return res.json();
}
