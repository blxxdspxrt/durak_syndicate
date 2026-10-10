// ============================================================================
// ЭКОНОМИКА ПАРТИИ: рейк системы, призовые, ELO и Влияние.
// ============================================================================
// Чистые функции без обращения к БД — их удобно тестировать.
// Правила (единый рейк 8% от суммы бай-инов):
//   • призовой фонд = ставка × игроков × 0.92;
//   • «Дурак» (последнее место) получает $0 и теряет свой бай-ин;
//   • деньги и прогресс начисляются пропорционально занятому месту.
// Все суммы — целые доллары (округление вниз).
// ============================================================================

export const RAKE_RATE = 0.08

// Доля ЧИСТОГО призового фонда по местам (Классика), в ПРОЦЕНТАХ.
// Целые проценты специально: 0.7 в double даёт 3863.99… и приз «съедает»
// доллар. Умножение на целое и деление на 100 считает точно.
// Последнее место — 0%.
const CLASSIC_PRIZE = {
  2: [100],
  3: [70, 30],
  4: [50, 30, 20],
  5: [45, 25, 18, 12],
  6: [40, 24, 18, 11, 7],
}

// Изменение ELO по местам (Классика). Не зависит от ставки.
const CLASSIC_ELO = {
  2: [20, -20],
  3: [25, 8, -33],
  4: [28, 12, -2, -38],
  5: [30, 15, 3, -10, -38],
  6: [35, 18, 6, -4, -15, -40],
}

// Синдикат: доля чистого фонда НА СИНДИКАТ по местам (в процентах).
const SYNDICATE_TEAM_PRIZE = {
  2: [100], // 2 синдиката: победитель забирает всё
  3: [70, 30], // 3 синдиката: 70% / 30%
}

// Синдикат: изменение Влияния по местам (каждому участнику синдиката).
const SYNDICATE_INFLUENCE = {
  2: [22, -18],
  3: [32, 6, -28],
}

/** Командная партия (Синдикат)? */
export function isTeamGame(state) {
  const teams = state?.teams
  const n = (state?.turn_order || []).length
  return Array.isArray(teams) && teams.length === n && teams.some((t) => t !== null && t !== undefined)
}

/** Призовые проценты и ELO/Влияние для наглядности/отладки. */
export function prizeTable(size) {
  return CLASSIC_PRIZE[size] || []
}
export function eloTable(size) {
  return CLASSIC_ELO[size] || []
}

/**
 * Полный расчёт партии. Чистая функция.
 *
 * @param {object} state финальное состояние (turn_order, placement, even_split, ...)
 * @param {number} bet ставка (бай-ин) за игрока
 * @returns {{ pot:number, rake:number, net:number, results:Array }}
 *   results[] = { userId, place, result, prize, dollars, elo, influence }
 *   где dollars — итоговое изменение баланса (prize − бай-ин).
 */
export function computeSettlement(state, bet) {
  const players = (state.turn_order || []).map(Number)
  const n = players.length
  const betValue = Math.max(0, Math.floor(Number(bet) || 0))

  const pot = betValue * n
  const rake = Math.floor(pot * RAKE_RATE)
  const net = pot - rake

  const results = []

  // --- Досрочное завершение (выход/таймаут): приз поровну, без ELO/Влияния ---
  if (state.even_split) {
    const losers = (state.loser_ids || []).map(Number)
    const winners = players.filter((u) => !losers.includes(u))
    const share = winners.length > 0 ? Math.floor(net / winners.length) : 0

    for (const uid of players) {
      const isLoser = losers.includes(uid)
      const prize = isLoser ? 0 : share
      results.push({
        userId: uid,
        place: isLoser ? n : 1,
        result: isLoser ? 'lose' : 'win',
        prize,
        dollars: prize - betValue,
        elo: 0,
        influence: 0,
      })
    }
    return { pot, rake, net, results }
  }

  // --- Обычное завершение: считаем по местам ---
  const groups =
    Array.isArray(state.placement) && state.placement.length
      ? state.placement.map((g) => (Array.isArray(g) ? g.map(Number) : [Number(g)]))
      : players.map((u) => [u])

  if (isTeamGame(state)) {
    const pct = SYNDICATE_TEAM_PRIZE[groups.length] || []
    const inf = SYNDICATE_INFLUENCE[groups.length] || []

    groups.forEach((members, i) => {
      const isLast = i === groups.length - 1
      const teamNet = Math.floor((net * (pct[i] || 0)) / 100)
      const share = members.length > 0 ? Math.floor(teamNet / members.length) : 0
      for (const uid of members) {
        results.push({
          userId: uid,
          place: i + 1,
          result: isLast ? 'lose' : 'win',
          prize: share,
          dollars: share - betValue,
          elo: 0,
          influence: inf[i] || 0,
        })
      }
    })
    return { pot, rake, net, results }
  }

  const pct = CLASSIC_PRIZE[n] || []
  const elo = CLASSIC_ELO[n] || []

  groups.forEach((members, i) => {
    const uid = Number(members[0])
    const isLast = i === groups.length - 1
    const prize = Math.floor((net * (pct[i] || 0)) / 100)
    results.push({
      userId: uid,
      place: i + 1,
      result: isLast ? 'lose' : 'win',
      prize,
      dollars: prize - betValue,
      elo: elo[i] || 0,
      influence: 0,
    })
  })

  return { pot, rake, net, results }
}
