export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#002D56] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8D7150] text-xl font-bold text-white">
            W
          </div>
          <h1 className="text-xl font-semibold text-white">WONDER</h1>
          <p className="text-sm text-white/50">팀 업무관리 워크스페이스</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
