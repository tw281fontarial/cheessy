export type Player = {
  userId: string
  telegramId: number | null
  name: string
}

export type PastPair = { a: string; b: string }

export type PairingResult = {
  pairs: Array<{ white: Player; black: Player; table: number }>
  bye: Player | null
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function shuffle<T>(arr: T[], seed = Date.now()) {
  // deterministic-ish shuffle for same seed (LCG)
  let s = seed % 2147483647
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function computePointsFromGames(games: Array<{ white_user_id: string | null; black_user_id: string | null; result: string | null }>) {
  const pts = new Map<string, number>()
  const add = (id: string, p: number) => pts.set(id, (pts.get(id) ?? 0) + p)

  for (const g of games) {
    if (g.result === 'bye') {
      const p = g.white_user_id ?? g.black_user_id
      if (p) add(p, 1)
      continue
    }
    if (!g.white_user_id || !g.black_user_id || !g.result) continue
    if (g.result === '1-0') {
      add(g.white_user_id, 1)
    } else if (g.result === '0-1') {
      add(g.black_user_id, 1)
    } else if (g.result === '0.5-0.5') {
      add(g.white_user_id, 0.5)
      add(g.black_user_id, 0.5)
    }
  }
  return pts
}

export function chooseByePlayer(playersSorted: Player[], byeHistory: Set<string>) {
  // prefer someone who hasn't received bye yet, from the bottom of standings
  for (let i = playersSorted.length - 1; i >= 0; i--) {
    const p = playersSorted[i]
    if (!byeHistory.has(p.userId)) return p
  }
  return playersSorted[playersSorted.length - 1] ?? null
}

export function swissPairing(args: {
  players: Player[]
  points: Map<string, number>
  pastPairs: PastPair[]
  byeHistory: Set<string>
  roundNumber: number
}): PairingResult {
  const played = new Set<string>()
  for (const g of args.pastPairs) played.add(pairKey(g.a, g.b))

  // standings sort
  const standings = [...args.players].sort((p1, p2) => {
    const a = args.points.get(p1.userId) ?? 0
    const b = args.points.get(p2.userId) ?? 0
    if (b !== a) return b - a
    return p1.userId.localeCompare(p2.userId)
  })

  // Round 1: randomize to avoid "boring" fixed id order
  const ordered = args.roundNumber === 1 ? shuffle(standings) : standings

  let bye: Player | null = null
  let pool = [...ordered]
  if (pool.length % 2 === 1) {
    // pick bye based on standings (not random)
    const byeCandidate = chooseByePlayer(standings, args.byeHistory)
    bye = byeCandidate
    pool = pool.filter((p) => p.userId !== byeCandidate.userId)
  }

  const pairs: Array<{ white: Player; black: Player; table: number }> = []
  let table = 1

  while (pool.length >= 2) {
    const a = pool.shift()!
    let idx = pool.findIndex((b) => !played.has(pairKey(a.userId, b.userId)))
    if (idx === -1) idx = 0
    const b = pool.splice(idx, 1)[0]

    // simple color assignment: alternate by table/round
    const white = (table + args.roundNumber) % 2 === 0 ? a : b
    const black = white.userId === a.userId ? b : a

    played.add(pairKey(a.userId, b.userId))
    pairs.push({ white, black, table })
    table += 1
  }

  return { pairs, bye }
}

