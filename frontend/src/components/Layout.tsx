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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            Auto Upload System
          </h1>
          <div className="text-sm text-gray-500">
            콘텐츠 자동 업로드
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
