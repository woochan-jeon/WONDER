import Sidebar from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">{children}</div>
    </div>
  );
}
