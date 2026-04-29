import assert from 'node:assert/strict'
import test from 'node:test'
import { computePointsFromGames, swissPairing, type Player } from './swissPairing'

const player = (idx: number): Player => ({
  userId: `player-${idx}`,
  telegramId: null,
  name: `Player ${idx}`,
})

test('computePointsFromGames counts wins, draws, and bye', () => {
  const points = computePointsFromGames([
    { white_user_id: 'a', black_user_id: 'b', result: '1-0' },
    { white_user_id: 'a', black_user_id: 'c', result: '0.5-0.5' },
    { white_user_id: 'd', black_user_id: null, result: 'bye' },
    { white_user_id: 'e', black_user_id: 'f', result: null },
  ])

  assert.equal(points.get('a'), 1.5)
  assert.equal(points.get('b') ?? 0, 0)
  assert.equal(points.get('c'), 0.5)
  assert.equal(points.get('d'), 1)
  assert.equal(points.has('e'), false)
})

test('swissPairing gives one bye for odd player count', () => {
  const result = swissPairing({
    players: [player(1), player(2), player(3), player(4), player(5)],
    points: new Map(),
    pastPairs: [],
    byeHistory: new Set(),
    roundNumber: 2,
  })

  assert.equal(result.pairs.length, 2)
  assert.ok(result.bye)
  assert.equal(new Set(result.pairs.flatMap((p) => [p.white.userId, p.black.userId, result.bye?.userId])).size, 5)
})

test('swissPairing avoids repeated pairs when possible', () => {
  const result = swissPairing({
    players: [player(1), player(2), player(3), player(4)],
    points: new Map([
      ['player-1', 1],
      ['player-2', 1],
      ['player-3', 0],
      ['player-4', 0],
    ]),
    pastPairs: [{ a: 'player-1', b: 'player-2' }],
    byeHistory: new Set(),
    roundNumber: 2,
  })

  const repeated = result.pairs.some((p) => {
    const ids = [p.white.userId, p.black.userId].sort().join(':')
    return ids === 'player-1:player-2'
  })

  assert.equal(repeated, false)
})
