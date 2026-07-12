import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ title, searchPlaceholder, children }) {
  return (
    <div className="min-h-screen bg-background text-on-background font-body-md antialiased">
      <Sidebar />
      <div className="flex flex-col md:ml-[280px]">
        <TopBar title={title} searchPlaceholder={searchPlaceholder} />
        <main className="flex-1 p-gutter space-y-gutter max-w-container-max mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
