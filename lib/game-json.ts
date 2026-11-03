import type { BoardCell, GameState } from './game-store'
import { getMode } from './modes/registry'
import { SURF_FIX_GAME } from './game-settings'
import { isRideClaim } from './predicates/reads/ride-claim'
import { DOUBLE_TILES } from './tiles'

const fields = ['modeId', 'hand', 'round', 'score', 'vowelBag', 'consonantBag', 'backupVowelBag', 'backupConsonantBag', 'playedWords', 'chainWords', 'handDrawnForRound', 'pickTilesUsedForRound', 'doubleTileUsedForRound', 'doubleTileIdForRound', 'remainingDoubleTiles', 'pendingRerun', 'wildcardMustBeUsedAsXRound', 'gameOver', 'hintsEnabled', 'timerEnabled', 'timerMinutes1_12', 'timerMinutes13_16', 'timerStatus', 'timerPausedRemainingMs', 'rideClaim'] as const

export function exportGameJson(state: GameState, now = Date.now()): string {
  const gameState = Object.fromEntries(fields.map(key => [key, state[key]]))
  if (state.timerStatus === 'running') {
    gameState.timerStatus = 'paused'
    gameState.timerPausedRemainingMs = Math.max(0, (state.roundTimerEndsAt ?? now) - now)
  }
  return JSON.stringify({ format: 'cross-fix', version: 1, gameState: {
    ...gameState,
    board: { rows: state.board.length, cols: state.board[0].length,
      cells: state.board.flatMap((row, r) => row.flatMap((cell, col) => cell.kind === 'empty' ? [] : [{ row: r, col, cell }])) },
    submittedPositions: state.submittedPositions ? [...state.submittedPositions] : null,
    submittedBentWordPositions: state.submittedBentWordPositions ? [...state.submittedBentWordPositions] : null,
  } }, null, 2)
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid game data.')
  return value as Record<string, unknown>
}

function check(condition: unknown): asserts condition {
  if (!condition) throw new Error('This file contains invalid game data.')
}

const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const strings = (v: unknown) => Array.isArray(v) && v.every(item => typeof item === 'string')
const letter = (v: unknown) => typeof v === 'string' && /^[A-Z]$/.test(v)

function tile(value: unknown, location: 'board' | 'hand' | 'bag') {
  const t = object(value)
  check(['regular', 'switch', 'double', 'surfboard', 'wildcard'].includes(String(t.kind)))
  if (location === 'hand') check(typeof t.id === 'string' && t.id.length > 0)
  if (location === 'board') check(t.origin === 'placed' || t.origin === 'fixed')
  if (t.kind === 'regular') check(letter(t.letter) && number(t.value) && (location === 'board' || ['vowel', 'consonant'].includes(String(t.category))))
  if (t.kind === 'switch') {
    for (const side of [t.sideA, t.sideB]) {
      const s = object(side)
      check(letter(s.letter) && number(s.value))
    }
    if (location !== 'bag') check(t.activeSide === 'A' || t.activeSide === 'B')
    check(typeof (location === 'board' ? t.id : t.tileId) === 'string')
  }
  if (t.kind === 'double') {
    check(DOUBLE_TILES.some(d => d.id === (location === 'hand' ? t.tileId : t.id)))
    check(Array.isArray(t.letters) && t.letters.length === 2 && t.letters.every(letter) && number(t.value))
  }
  if (t.kind === 'wildcard' && t.representsLetter != null) check(letter(t.representsLetter))
  if (location === 'board' && t.origin === 'placed') check(typeof t.handTileId === 'string')
}

export function importGameJson(text: string): Partial<GameState> {
  const payload = object(JSON.parse(text))
  check(payload.format === undefined || (payload.format === 'cross-fix' && payload.version === 1))
  const data = object(payload.gameState)
  check(['keiki-play', 'crosswords', 'surf-fix'].includes(String(data.modeId)))
  const modeId = data.modeId as GameState['modeId']
  const mode = getMode(modeId)
  const sparse = object(data.board)
  const { rows, cols } = mode.boardSize
  check(sparse.rows === rows && sparse.cols === cols && Array.isArray(sparse.cells))
  const board: BoardCell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: 'empty' })))
  const position = (r: unknown, c: unknown) => Number.isInteger(r) && Number.isInteger(c) && Number(r) >= 0 && Number(r) < rows && Number(c) >= 0 && Number(c) < cols
  const occupied = new Set<string>()
  for (const value of sparse.cells) {
    const item = object(value)
    check(position(item.row, item.col))
    const key = `${item.row}-${item.col}`
    check(!occupied.has(key))
    occupied.add(key)
    tile(item.cell, 'board')
    board[Number(item.row)][Number(item.col)] = item.cell as BoardCell
  }
  const state: Record<string, unknown> = {
    backupVowelBag: [], backupConsonantBag: [], ...mode.buildBags(),
    hand: [], round: 1, score: 0, playedWords: [], chainWords: [], handDrawnForRound: null,
    pickTilesUsedForRound: 0, doubleTileUsedForRound: false, doubleTileIdForRound: null,
    remainingDoubleTiles: DOUBLE_TILES.map(t => t.id), pendingRerun: null,
    wildcardMustBeUsedAsXRound: null, gameOver: false, hintsEnabled: false,
    timerEnabled: false, timerMinutes1_12: 3, timerMinutes13_16: 5,
    timerStatus: 'idle', timerPausedRemainingMs: null, rideClaim: null,
  }
  for (const key of fields) if (Object.hasOwn(data, key)) state[key] = data[key]
  for (const key of ['hand', 'vowelBag', 'consonantBag', 'backupVowelBag', 'backupConsonantBag']) {
    check(Array.isArray(state[key]))
    for (const item of state[key] as unknown[]) tile(item, key === 'hand' ? 'hand' : 'bag')
  }
  for (const key of ['round', 'score', 'pickTilesUsedForRound', 'timerMinutes1_12', 'timerMinutes13_16']) check(number(state[key]))
  check(Number.isInteger(state.round) && Number(state.round) >= 1 && Number(state.round) <= mode.getRoundConfig(1).totalRounds)
  for (const key of ['handDrawnForRound', 'wildcardMustBeUsedAsXRound', 'timerPausedRemainingMs']) check(state[key] === null || number(state[key]))
  for (const key of ['gameOver', 'hintsEnabled', 'timerEnabled', 'doubleTileUsedForRound']) check(typeof state[key] === 'boolean')
  check(strings(state.remainingDoubleTiles) && (state.doubleTileIdForRound === null || typeof state.doubleTileIdForRound === 'string'))
  check(['idle', 'paused', 'expired'].includes(String(state.timerStatus)))
  check(state.timerStatus !== 'paused' || number(state.timerPausedRemainingMs))
  check(state.rideClaim === null || isRideClaim(state.rideClaim))
  check(Array.isArray(state.playedWords) && Array.isArray(state.chainWords))
  for (const value of state.playedWords) {
    const word = object(value)
    check(typeof word.word === 'string' && number(word.points) && number(word.round))
    if (word.highlightTileIds !== undefined) check(strings(word.highlightTileIds))
    if (word.highlightPositions !== undefined) check(Array.isArray(word.highlightPositions) && word.highlightPositions.every(p => position(object(p).row, object(p).col)))
    if (word.scoreParts !== undefined) check(number(object(word.scoreParts).value) && number(object(word.scoreParts).length))
  }
  for (const value of state.chainWords) {
    const word = object(value)
    check(Array.isArray(word.history))
    for (const entry of [word, ...word.history]) {
      const w = object(entry)
      check(typeof w.id === 'string' && typeof w.text === 'string' && strings(w.orderedTileIds) && strings(w.ancestors) && number(w.roundCreated))
      const cells = object(w.shape).cells
      check(Array.isArray(cells) && cells.every(p => position(object(p).row, object(p).col)))
    }
  }
  if (state.pendingRerun !== null) {
    const rerun = object(state.pendingRerun)
    check(typeof rerun.shouldRerun === 'boolean' && strings(rerun.replaceIds))
    if (rerun.message !== undefined) check(typeof rerun.message === 'string')
  }
  for (const key of ['submittedPositions', 'submittedBentWordPositions']) {
    const values = data[key] ?? null
    check(values === null || (strings(values) && (values as string[]).every(p => occupied.has(p))))
    state[key] = values === null ? null : new Set(values as string[])
  }
  return { ...state, modeId, board, authoring: modeId === 'surf-fix' ? SURF_FIX_GAME : null,
    validPositions: null, animatingPositions: null, handVersion: 0, roundTimerEndsAt: null,
    toastMessage: null, toastTheme: 'default' } as Partial<GameState>
}
