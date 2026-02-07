export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-10">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs opacity-60">
          © {new Date().getFullYear()} Archnemix
        </span>

        <span className="text-xs opacity-40">
          Internal tool • Rate‑limited • API‑backed
        </span>
      </div>
    </footer>
  );
}
