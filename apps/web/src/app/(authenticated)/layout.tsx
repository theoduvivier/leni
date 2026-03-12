import { AppNav } from '@/components/app-nav'
import { ComposeTrigger } from '@/components/compose-trigger'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppNav />
      <main className="min-h-dvh pb-20 md:pl-60 md:pb-0">
        {children}
      </main>
      <ComposeTrigger />
    </>
  )
}
