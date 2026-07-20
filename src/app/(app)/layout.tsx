import { requireUser } from "@/lib/auth";
import Sidebar from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <div className="flex flex-1 flex-col overflow-hidden bg-white">{children}</div>
    </div>
  );
}
