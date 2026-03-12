import { AppNav } from '@/components/app-nav'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppNav />
      <main className="min-h-dvh pt-12 pb-20 md:pt-0 md:pl-60 md:pb-0">
        {children}
      </main>
    </>
  )
}
