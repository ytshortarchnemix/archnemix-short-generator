type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function ScriptInput({ value, onChange }: Props) {
  return (
    <div>
      <label className="block mb-2 text-sm">Script</label>
      <textarea
        className="w-full bg-black border border-white/20 rounded p-3 h-32"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your script here..."
      />
    </div>
  );
}
