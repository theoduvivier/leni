export default function VeillePage() {
  return (
    <div className="p-4 pt-12 lg:p-8 lg:pt-8">
      <h1 className="text-2xl font-bold text-gray-900">Veille</h1>
      <p className="mt-1 text-sm text-gray-500">Articles scorés par Claude</p>

      <div className="mt-6 space-y-3">
        <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl">
          <p className="text-sm text-gray-400">Aucun article pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Le cron de veille tourne à 6h chaque jour</p>
        </div>
      </div>
    </div>
  )
}
