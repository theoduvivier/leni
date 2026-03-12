'use client'

import { useState, useEffect } from 'react'
import { ComposeSheet } from './compose-sheet'

export function ComposeTrigger() {
  const [open, setOpen] = useState(false)
  const [defaultType, setDefaultType] = useState<string | undefined>()

  useEffect(() => {
    function onCompose(e: Event) {
      const detail = (e as CustomEvent).detail
      setDefaultType(detail?.type)
      setOpen(true)
    }
    window.addEventListener('leni:compose', onCompose)
    return () => window.removeEventListener('leni:compose', onCompose)
  }, [])

  return (
    <ComposeSheet
      open={open}
      onClose={() => setOpen(false)}
      defaultType={defaultType}
    />
  )
}
