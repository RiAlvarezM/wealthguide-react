import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ title, searchPlaceholder, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 antialiased transition-colors">
      <Sidebar />
      <div className="flex flex-col md:ml-[260px]">
        <TopBar title={title} searchPlaceholder={searchPlaceholder} />
        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
