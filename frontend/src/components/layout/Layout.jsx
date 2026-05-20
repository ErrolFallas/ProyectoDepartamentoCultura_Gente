import { Outlet } from 'react-router-dom';
import { Sidebar, SidebarShowTab } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed.js';

export function Layout() {
  const { collapsed, hide, show } = useSidebarCollapsed();

  return (
    <div className="min-h-screen flex bg-ink-50">
      {!collapsed && <Sidebar onCollapse={hide} />}
      {collapsed && <SidebarShowTab onShow={show} />}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
