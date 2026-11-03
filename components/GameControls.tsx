'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useGameStore } from '@/lib/game-store'
import { useUIStore } from '@/lib/ui-store'
import { exportGameJson, importGameJson } from '@/lib/game-json'
import { downloadJson } from '@/lib/download-json'
import SoundToggle from './SoundToggle'

export default function GameControls({ onImport }: { onImport: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const modeId = useGameStore(s => s.modeId)
  const buttonClass = 'px-3 py-1 sm:px-4 sm:py-1.5 rounded-full font-headline font-bold text-xs sm:text-sm cursor-pointer bg-white border-2 border-black text-black'

  async function load(file?: File) {
    if (!file) return
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 20 MB.')
      const state = importGameJson(await file.text())
      if (state.modeId !== useGameStore.getState().modeId) throw new Error('Open the matching game mode before importing this file.')
      useGameStore.setState(state)
      useGameStore.temporal.getState().clear()
      useUIStore.setState({ leftTool: 'hand', selectedTileIds: new Set(), anchorTileId: null, floatGroup: null })
      onImport()
      setMessage('Board imported.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import this file.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
    <Link href="/" className={buttonClass}>Cross-Fix</Link>
    {modeId === 'surf-fix' && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-black">Surf-Fix</span>}
    <SoundToggle />
    <button className={buttonClass} onClick={() => input.current?.click()}>Import JSON</button>
    <button className={buttonClass} onClick={() => {
      const state = useGameStore.getState()
      downloadJson(`${state.modeId}-round-${state.round}.json`, exportGameJson(state))
    }}>Export JSON</button>
    <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Import JSON file" onChange={e => void load(e.target.files?.[0])} />
    {message && <p role="status" className="max-w-56 rounded-lg bg-white p-2 text-xs text-black shadow">{message}</p>}
  </div>
}
