import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, Workflow, CalendarDays } from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드' },
  { path: '/calendar', icon: CalendarDays, label: '캘린더' },
  { path: '/workflow', icon: Workflow, label: '워크플로우' },
  { path: '/settings', icon: Settings, label: '설정' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-paper-ivory text-ink font-sans selection:bg-lemon selection:text-ink">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-paper-white border-b border-paper-gray">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-paper-ink flex items-center justify-center">
              <Workflow size={18} className="text-paper-white" />
            </div>
            <h1 className="font-instrument-cond text-xl font-semibold tracking-wide text-ink uppercase">
              Auto Upload System
            </h1>
          </div>
          <div className="px-3 py-1.5 border border-ash-gray text-muted-gray text-sm font-semibold">
            콘텐츠 자동 업로드
          </div>
        </div>
      </header>

      <div className="flex pt-[65px]">
        {/* Sidebar */}
        <aside className="w-64 bg-paper-white border-r border-paper-gray fixed left-0 top-[65px] bottom-0 z-10">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive
                    ? 'bg-paper-ink text-paper-white font-semibold'
                    : 'text-charcoal hover:bg-paper-beige hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={18}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={isActive ? 'text-paper-white' : 'text-muted-gray group-hover:text-ink'}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-6 w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
