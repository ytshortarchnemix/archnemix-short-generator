type Props = {
  script: string;
  setScript: (v: string) => void;
};

export default function ScriptInput({ script, setScript }: Props) {
  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mb-2">
        Script
      </label>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Paste or write your short-form script here…"
        rows={6}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      <p className="text-xs text-zinc-400 mt-1">
        Recommended: 60–120 words for Shorts
      </p>
    </div>
  );
}
