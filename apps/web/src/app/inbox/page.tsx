export default function InboxPage() {
  return (
    <div className="p-4 pt-12 lg:p-8 lg:pt-8">
      <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
      <p className="mt-1 text-sm text-gray-500">Messages LinkedIn avec réponses Claude</p>

      <div className="mt-6 space-y-3">
        <div className="rounded-card bg-glass p-4 shadow-card backdrop-blur-xl">
          <p className="text-sm text-gray-400">Aucun message en attente</p>
          <p className="text-xs text-gray-400 mt-1">Connecte l&apos;extension Chrome pour synchroniser</p>
        </div>
      </div>
    </div>
  )
}
