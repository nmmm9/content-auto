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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-white/70 backdrop-blur-lg border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Workflow size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              Auto Upload System
            </h1>
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm font-bold rounded-full border border-indigo-100/50 shadow-sm">
            콘텐츠 자동 업로드
          </div>
        </div>
      </header>

      <div className="flex pt-[73px]">
        {/* Sidebar */}
        <aside className="w-64 bg-white/70 backdrop-blur-md border-r border-slate-200/60 fixed left-0 top-[73px] bottom-0 z-10">
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-in-out ${isActive
                    ? 'bg-gradient-to-r from-indigo-50 to-transparent text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isActive ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-slate-400 group-hover:scale-110 group-hover:text-indigo-500'}`}>
                      <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
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
