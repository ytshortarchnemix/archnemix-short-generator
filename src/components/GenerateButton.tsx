type Props = {
  script: string;
  voice: string;
  onAudioReady: (url: string) => void;
};

export default function GenerateButton({
  script,
  voice,
  onAudioReady,
}: Props) {
  const handleClick = () => {
    console.log("🟢 Generate clicked");
    console.log("Script:", script);
    console.log("Voice:", voice);

    if (!script || !voice) {
      alert("Script or voice missing");
      return;
    }

    // TEMP: fake audio to test pipeline
    const testAudio =
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    onAudioReady(testAudio);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold"
    >
      Generate
    </button>
  );
}
