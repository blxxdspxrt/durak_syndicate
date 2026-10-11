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
  1: [100], // остался один живой (остальные вылетели) — забирает весь фонд
  2: [100],
  3: [70, 30],
  4: [50, 30, 20],
  5: [45, 25, 18, 12],
  6: [40, 24, 18, 11, 7],
}

// Изменение ELO по местам (Классика). Не зависит от ставки.
const CLASSIC_ELO = {
  1: [20], // остался один живой (соперники вылетели) — как 1-е место на двоих
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

// Невиновный напарник афкашера: доля возврата бай-ина и мягкий штраф Влияния
// (по числу СИНДИКАТОВ: 2 → 2×2, 3 → 2×2×2).
export const PARTNER_REFUND_RATE = { 2: 0.75, 3: 0 }
export const PARTNER_INFLUENCE = { 2: 0, 3: -8 }

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
  // Выбывшие (AFK + их напарники) в раскладке мест уже стоят в самом конце,
  // поэтому призовой таблицей служит таблица на число ОСТАВШИХСЯ.
  const afkSet = new Set((state.afk_ids || []).map(Number))
  const foldedSet = new Set((state.folded_ids || []).map(Number))
  const outSet = new Set([...afkSet, ...foldedSet])

  const isTeam = isTeamGame(state)
  const teamCount = isTeam ? new Set((state.teams || []).map(Number)).size : 0

  const groups =
    Array.isArray(state.placement) && state.placement.length
      ? state.placement.map((g) => (Array.isArray(g) ? g.map(Number) : [Number(g)]))
      : players.filter((u) => !outSet.has(u)).map((u) => [u])

  const liveGroups = groups.filter((g) => g.some((uid) => !outSet.has(uid)))

  // Частичный возврат бай-ина невиновным (2×2) берётся ИЗ призового фонда,
  // чтобы общая сумма осталась zero-sum.
  const refundRate = isTeam ? PARTNER_REFUND_RATE[teamCount] || 0 : 0
  const refundPerPartner = Math.floor(betValue * refundRate)
  const distributable = Math.max(0, net - refundPerPartner * foldedSet.size)

  if (isTeam) {
    // В Синдикате таблица берётся по ИСХОДНОМУ числу синдикатов: выбывшая
    // команда просто занимает последнее место таблицы (0%).
    const pct = SYNDICATE_TEAM_PRIZE[teamCount] || []
    const inf = SYNDICATE_INFLUENCE[teamCount] || []

    groups.forEach((members, i) => {
      const isOut = members.every((uid) => outSet.has(uid))
      if (isOut) return // выбывших обрабатываем ниже (санкции + возврат)

      const isLast = i === groups.length - 1
      const teamNet = Math.floor((distributable * (pct[i] || 0)) / 100)
      const share = members.length > 0 ? Math.floor(teamNet / members.length) : 0
      for (const uid of members) {
        results.push({
          userId: Number(uid),
          place: i + 1,
          result: isLast ? 'lose' : 'win',
          prize: share,
          dollars: share - betValue,
          elo: 0,
          influence: inf[i] || 0,
        })
      }
    })
  } else {
    const pct = CLASSIC_PRIZE[liveGroups.length] || []
    const elo = CLASSIC_ELO[liveGroups.length] || []

    liveGroups.forEach((members, i) => {
      const uid = Number(members[0])
      const isLast = i === liveGroups.length - 1
      const prize = Math.floor((distributable * (pct[i] || 0)) / 100)
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
  }

  // --- Выбывшие: бай-ин сгорает, штраф прогресса начислит settleGame ---
  for (const uid of players) {
    if (!outSet.has(uid)) continue
    const isAfk = afkSet.has(uid)
    const refund = isAfk ? 0 : refundPerPartner
    results.push({
      userId: uid,
      place: n,
      result: isAfk ? 'afk' : 'fold',
      prize: refund,
      dollars: refund - betValue,
      elo: 0,
      influence: isAfk ? 0 : PARTNER_INFLUENCE[teamCount] || 0,
    })
  }

  return { pot, rake, net, results }
}

// ============================================================================
// ЛЕСТНИЦА САНКЦИЙ ЗА ВЫХОД / AFK (чистые правила; применяет lib/penalties.js)
// ============================================================================
// За 24 часа без нарушений счётчик обнуляется:
//   • первое нарушение В ЖИЗНИ аккаунта → только предупреждение;
//   • 1-е в окне      → половина штрафа «последнего места»;
//   • 2-е в окне      → полный штраф «последнего места»;
//   • 3-е и далее     → +15% к штрафу за каждый шаг
//                       и бан 15 → 30 → 60 → 120 мин (удвоение).
// В Синдикате меняется Влияние (ELO не трогаем).
// ============================================================================

export const LEAVE_WINDOW_MS = 24 * 60 * 60 * 1000

const CLASSIC_LAST_ELO = { 2: -20, 3: -33, 4: -38, 5: -38, 6: -40 }
const SYNDICATE_LEAVER_INF = { 2: -35, 3: -45 }

const SANCTION_TITLES = {
  warning: 'Предупреждение за выход из матча',
  half: 'Штраф за повторный выход из матча',
  full: 'Штраф за выход из матча',
  severe: 'Строгий штраф и блокировка',
}

/**
 * Чистая лестница санкций за выход/AFK.
 * @returns {{ level, elo, influence, banMinutes, title }}
 */
export function leaveSanction({ mode, playerCount, syndicateCount, warned, streak }) {
  const isSyndicate = mode === 'Синдикат'
  const baseElo = isSyndicate ? 0 : CLASSIC_LAST_ELO[playerCount] || -38
  const baseInf = isSyndicate ? SYNDICATE_LEAVER_INF[syndicateCount] || -35 : 0

  const make = (level, elo, influence, banMinutes) => ({
    level,
    elo: Math.round(elo),
    influence: Math.round(influence),
    banMinutes,
    title: SANCTION_TITLES[level],
  })

  // Первое нарушение в жизни аккаунта — только предупреждение
  if (!warned) return make('warning', 0, 0, 0)

  const s = Number(streak) || 0
  if (s <= 1) return make('half', baseElo / 2, baseInf / 2, 0)
  if (s === 2) return make('full', baseElo, baseInf, 0)

  const multiplier = 1 + 0.15 * (s - 2)
  const banMinutes = 15 * Math.pow(2, s - 3)
  return make('severe', baseElo * multiplier, baseInf * multiplier, banMinutes)
}
