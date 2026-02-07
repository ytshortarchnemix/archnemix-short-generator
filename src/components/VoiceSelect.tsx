const VOICES = [
  { id: "male_en_1", label: "Male – Deep (EN)" },
  { id: "female_en_1", label: "Female – Clear (EN)" },
  { id: "male_fast", label: "Male – Fast (EN)" },
];

type Props = {
  voice: string;
  setVoice: (v: string) => void;
};

export default function VoiceSelect({ voice, setVoice }: Props) {
  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-2">
        Voice
      </label>

      <select
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}
