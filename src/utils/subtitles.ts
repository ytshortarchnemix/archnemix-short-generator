export interface SubtitleLine {
  start: number;
  end: number;
  text: string;
}

export function generateSubtitles(
  script: string,
  audioDuration: number
): SubtitleLine[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const totalChars = sentences.reduce((a, s) => a + s.length, 0);

  let currentTime = 0;

  return sentences.map(sentence => {
    const portion = sentence.length / totalChars;
    const duration = portion * audioDuration;

    const line = {
      start: currentTime,
      end: currentTime + duration,
      text: sentence.trim(),
    };

    currentTime += duration;
    return line;
  });
}
