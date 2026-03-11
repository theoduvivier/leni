export default function ContextePage() {
  return (
    <div className="p-4 pt-12 lg:p-8 lg:pt-8">
      <h1 className="text-2xl font-bold text-gray-900">Contexte</h1>
      <p className="mt-1 text-sm text-gray-500">Personas et données live</p>

      <div className="mt-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl">
          <h3 className="font-semibold text-sm text-gray-900">Flipio</h3>
          <p className="text-xs text-gray-500 mt-1">Bêta privée — places restantes éditables</p>
        </div>
        <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl">
          <h3 className="font-semibold text-sm text-gray-900">MdB Perso</h3>
          <p className="text-xs text-gray-500 mt-1">Marchand de biens — Paris & IDF</p>
        </div>
      </div>
    </div>
  )
}
