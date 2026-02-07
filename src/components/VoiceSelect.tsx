type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function VoiceSelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="block mb-2 text-sm">Voice</label>
      <select
        className="w-full bg-black border border-white/20 rounded p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="en-US">English (US)</option>
        <option value="en-GB">English (UK)</option>
      </select>
    </div>
  );
}
