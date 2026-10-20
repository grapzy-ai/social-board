import { Sidebar } from "@/components/shell/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <Sidebar />
      <main className="min-w-0 px-8 py-6">{children}</main>
    </div>
  );
}
