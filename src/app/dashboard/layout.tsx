import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-gray-900">Northstar Admissions</h1>
            <div className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Worklist</a>
              <a href="/dashboard/admin" className="text-gray-600 hover:text-gray-900">Admin</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {(session.user as any)?.name}
            </span>
            
              <a href="/api/auth/signout" className="text-sm text-red-500 hover:text-red-700">
              Sign out
            </a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}