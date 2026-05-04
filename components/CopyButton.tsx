'use client'

import { useState } from 'react'

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1.5 rounded-md bg-[#2a2a3a] hover:bg-[#3a3a4a] text-[#8884a8] hover:text-white transition-colors"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
