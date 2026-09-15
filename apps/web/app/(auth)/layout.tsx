export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Z
          </span>
          <span className="text-sm font-semibold tracking-wide text-[#101828]">ZENITH FLOW</span>
        </div>
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
