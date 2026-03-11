export default function Home() {
  return (
    <div className="p-4 pt-12 lg:p-8 lg:pt-8">
      <h1 className="text-2xl font-bold text-gray-900 lg:hidden">Leni</h1>
      <h1 className="hidden lg:block text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Agent Social Media</p>

      {/* Stats semaine */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Posts publiés" value="0" color="accent" />
        <StatCard label="En attente" value="0" color="teal" />
        <StatCard label="Veille articles" value="0" color="pink" />
        <StatCard label="Inbox" value="0" color="accent" />
      </div>

      {/* Actions rapides */}
      <h2 className="mt-8 text-lg font-semibold text-gray-900">Actions rapides</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ActionCard title="Post LinkedIn" subtitle="Générer un post texte" />
        <ActionCard title="Post Viral" subtitle="3 variantes comment trigger" />
        <ActionCard title="Case Study" subtitle="Deal avant/après" />
        <ActionCard title="Ghostwriter" subtitle="Post long pédagogique" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    accent: 'text-accent',
    teal: 'text-teal',
    pink: 'text-pink',
  }
  return (
    <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl">
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-accent'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function ActionCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl cursor-pointer hover:scale-[1.02] transition-transform">
      <p className="font-semibold text-sm text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  )
}
