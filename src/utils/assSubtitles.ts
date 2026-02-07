function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100); // centiseconds

  return `${h}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function generateASS(script: string, duration: number): string {
  const lines = script
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const totalChars = lines.reduce((a, l) => a + l.length, 0);

  let current = 0;

  const dialogue = lines.map(line => {
    const portion = line.length / totalChars;
    const len = portion * duration;

    const start = formatTime(current);
    const end = formatTime(current + len);
    current += len;

    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${line}`;
  });

  return `
[Script Info]
Title: Archnemix Shorts Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,64,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,4,3,2,50,50,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogue.join("\n")}
`.trim();
}
