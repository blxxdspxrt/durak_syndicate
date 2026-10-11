// ============================================================================
// ДВИЖОК ИГРЫ «ДУРАК» (чистые функции, без побочных эффектов)
// ============================================================================
// Поддерживает:
//   • подкидной дурак   («Классический») — подкидывать может любой, кроме защитника;
//   • переводной дурак  («Переводной»)   — защитник может перевести ход дальше;
//   • Синдикат 2×2 / 2×2×2               — игра командами (teams).
// Вся игровая логика здесь; роуты API только вызывают эти функции.
// ВАЖНО: этот модуль — «источник правды» по правилам. Клиент ничего не решает.
// ============================================================================

export const SUITS = ['s', 'h', 'd', 'c']
export const SUIT_ORDER = { s: 0, h: 1, d: 2, c: 3 }

// Ранги по возрастанию силы (6 самая младшая, A самая старшая)
export const RANKS_36 = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const HAND_SIZE = 6
export const MAX_ATTACKS_PER_BOUT = 6

// Базовый (запасной) лимит хода. Реальное значение берётся из конфига стола
// (tables.turn_time) и хранится в состоянии как turn_seconds.
export const TURN_SECONDS = 30

// Доступные варианты времени хода при создании стола
export const TURN_OPTIONS = [15, 30, 45, 60]

/** Сколько просрочек ПОДРЯД нужно, чтобы игрок «вылетел» (AFK). */
export const TIMEOUTS_TO_AFK = 2

/** Длительность хода конкретной партии (из конфига стола). */
export function turnSeconds(state) {
  const value = Number(state?.turn_seconds)
  return Number.isFinite(value) && value > 0 ? value : TURN_SECONDS
}

/** Дедлайн хода: `now + turn_seconds` партии. */
function nextDeadline(state, now = Date.now()) {
  return new Date(now + turnSeconds(state) * 1000).toISOString()
}

export const MODE_CLASSIC = 'Классический'
export const MODE_TRANSFER = 'Переводной'
export const MODE_SYNDICATE = 'Синдикат'

export function isSyndicateMode(mode) {
  return mode === MODE_SYNDICATE
}
export function isTransferMode(mode) {
  return mode === MODE_TRANSFER
}

/**
 * Создаёт и перемешивает колоду.
 * @param {string} deckType '36 карт' | '52 карты'
 */
export function createDeck(deckType = '36 карт') {
  const ranks = deckType && deckType.includes('52') ? RANKS_52 : RANKS_36
  const deck = []
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  return shuffle(deck)
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function rankValue(rank) {
  const idx = RANKS_52.indexOf(rank)
  return idx === -1 ? 0 : idx
}

/**
 * Может ли карта `defend` побить карту `attack` при козыре `trumpSuit`.
 */
export function canBeat(attack, defend, trumpSuit) {
  if (!attack || !defend) return false
  const attackIsTrump = attack.suit === trumpSuit
  const defendIsTrump = defend.suit === trumpSuit

  if (attackIsTrump && !defendIsTrump) return false
  if (!attackIsTrump && defendIsTrump) return true
  if (attack.suit !== defend.suit) return false
  return rankValue(defend.rank) > rankValue(attack.rank)
}

/** Все ранги, которые сейчас лежат на столе (для подкидывания). */
export function tableRanks(tableCards) {
  const ranks = new Set()
  for (const pair of tableCards || []) {
    if (pair.attack) ranks.add(pair.attack.rank)
    if (pair.defend) ranks.add(pair.defend.rank)
  }
  return ranks
}

/** Есть ли на столе неотбитые карты. */
export function hasUndefended(tableCards) {
  return (tableCards || []).some((p) => p.attack && !p.defend)
}

/** Количество неотбитых карт. */
export function undefendedCount(tableCards) {
  return (tableCards || []).filter((p) => p.attack && !p.defend).length
}

/** Все карты, лежащие на столе (атаки + защиты). */
export function cardsOnTable(tableCards) {
  const out = []
  for (const p of tableCards || []) {
    if (p.attack) out.push(p.attack)
    if (p.defend) out.push(p.defend)
  }
  return out
}

/** Нормализует ключ руки (id может прийти числом или строкой). */
export function handKey(userId) {
  return String(userId)
}

export function getHand(hands, userId) {
  if (!hands) return []
  return hands[handKey(userId)] || hands[userId] || []
}

export function setHand(hands, userId, cards) {
  hands[handKey(userId)] = cards
  return hands
}

/**
 * Определяет, кто сейчас «активен» (может совершить действие).
 *  - phase 'attack'  → стол пуст, атакующий заводит
 *  - phase 'defend'  → защитник должен отбиться/взять, остальные могут подкидывать
 */
export function getActivePlayers(state) {
  const { attacker_id, defender_id, table_cards } = state
  const phase = (table_cards || []).length === 0 ? 'attack' : 'defend'
  return { phase, attacker: attacker_id, defender: defender_id }
}

/**
 * Может ли игрок подкинуть карту (атака/подкидывание).
 * Правила:
 *  - не защитник;
 *  - если стол пуст — только основной атакующий заводит;
 *  - если на столе есть карты — любой, кроме защитника, может подкинуть карту
 *    того же ранга, что уже на столе;
 *  - число неотбитых карт не может превышать размер руки защитника;
 *  - максимум 6 карт за «заход».
 */
export function canAttack(state, userId, card) {
  const { attacker_id, defender_id, table_cards, hands } = state
  const uid = Number(userId)

  if (uid === Number(defender_id)) return false
  if (!card) return false

  const table = table_cards || []
  const undefended = undefendedCount(table)
  const defenderHand = getHand(hands, defender_id)

  // Нельзя подкинуть больше, чем защитник способен отбить
  if (undefended >= defenderHand.length) return false
  // Лимит карт за заход
  if (table.length >= MAX_ATTACKS_PER_BOUT) return false

  if (table.length === 0) {
    // Заводит только основной атакующий
    return uid === Number(attacker_id)
  }

  // Подкидывать можно только карты ранга, который уже есть на столе
  const ranks = tableRanks(table)
  if (!ranks.has(card.rank)) return false

  // Карта должна реально быть в руке
  return getHand(hands, uid).some((c) => c.id === card.id)
}

/**
 * Может ли заход продолжаться — есть ли кому и чем подкинуть.
 * Возвращает false, если:
 *  • стол пуст или уже набран лимит карт за заход (MAX_ATTACKS_PER_BOUT);
 *  • неотбитых карт не меньше, чем карт в руке защитника;
 *  • ни у одного атакующего нет карты ранга, который уже лежит на столе.
 */
export function canContinueBout(state) {
  const table = state.table_cards || []
  if (table.length === 0) return false
  if (table.length >= MAX_ATTACKS_PER_BOUT) return false

  const defenderId = Number(state.defender_id)
  const defenderHand = getHand(state.hands, defenderId).length
  if (undefendedCount(table) >= defenderHand) return false

  const ranks = tableRanks(table)
  for (const raw of state.turn_order || []) {
    const uid = Number(raw)
    if (uid === defenderId) continue
    if (getHand(state.hands, uid).some((c) => ranks.has(c.rank))) return true
  }
  return false
}

/**
 * Заход исчерпан: все карты отбиты И подкидывать больше некому/некуда.
 * В этом случае ход автоматически переводится в «Бито» (стол уходит в отбой).
 */
export function shouldAutoBito(state) {
  const table = state.table_cards || []
  if (table.length === 0) return false
  if (hasUndefended(table)) return false
  return !canContinueBout(state)
}

/**
 * ПЕРЕВОД (только режим «Переводной»).
 * Защитник вместо защиты кладёт карту того же ранга, что и неотбитая атака,
 * и передаёт ход следующему игроку. Тот становится защитником.
 */
export function canTransfer(state, userId, card) {
  const { defender_id, attacker_id, table_cards, hands, turn_order, mode } = state
  if (!isTransferMode(mode)) return false

  const uid = Number(userId)
  if (uid !== Number(defender_id)) return false
  if (!card) return false

  const table = table_cards || []
  if (table.length === 0) return false
  // Перевести можно только пока на столе нет отбитых карт
  if (table.some((p) => p.defend)) return false
  if (undefendedCount(table) !== table.length) return false
  // Лимит карт за заход
  if (table.length >= MAX_ATTACKS_PER_BOUT) return false

  // Перевести можно только картой того же ранга
  const rank = table[0].attack.rank
  if (!table.every((p) => p.attack.rank === rank)) return false
  if (card.rank !== rank) return false

  if (!getHand(hands, uid).some((c) => c.id === card.id)) return false

  // Нельзя перевести «самому себе» (следующий не должен быть атакующим)
  const nextDefender = nextPlayer(turn_order, defender_id)
  if (Number(nextDefender) === Number(attacker_id)) return false

  return true
}

/**
 * Может ли игрок отбить конкретную карту.
 */
export function canDefend(state, userId, card, targetPairIndex) {
  const { defender_id, table_cards, trump_suit } = state
  if (Number(userId) !== Number(defender_id)) return false
  if (!card) return false

  const pair = (table_cards || [])[targetPairIndex]
  if (!pair || !pair.attack || pair.defend) return false
  if (!getHand(state.hands, userId).some((c) => c.id === card.id)) return false

  return canBeat(pair.attack, card, trump_suit)
}

/**
 * Добор карт из колоды до HAND_SIZE.
 * Порядок: сначала атакующий и остальные (по кругу), защитник — последним.
 */
export function refillHands(state) {
  const { hands, deck, attacker_id, defender_id, turn_order } = state
  const order = buildRefillOrder(turn_order, attacker_id, defender_id)
  const newDeck = [...(deck || [])]
  const newHands = { ...hands }

  for (const uid of order) {
    const hand = [...getHand(newHands, uid)]
    while (hand.length < HAND_SIZE && newDeck.length > 0) {
      hand.push(newDeck.shift())
    }
    setHand(newHands, uid, hand)
  }

  return { hands: newHands, deck: newDeck }
}

function buildRefillOrder(turnOrder, attackerId, defenderId) {
  const order = (turnOrder || []).map(Number)
  if (order.length === 0) return [Number(attackerId), Number(defenderId)]
  // Атакующий первым, защитник последним, остальные между ними по кругу
  const aIdx = Math.max(0, order.indexOf(Number(attackerId)))
  const rotated = [...order.slice(aIdx), ...order.slice(0, aIdx)]
  const withoutDefender = rotated.filter((id) => id !== Number(defenderId))
  return [...withoutDefender, Number(defenderId)]
}

/** Следующий игрок по кругу после `userId`. */
export function nextPlayer(turnOrder, userId) {
  const order = (turnOrder || []).map(Number)
  if (order.length === 0) return Number(userId)
  const idx = order.indexOf(Number(userId))
  if (idx === -1) return order[0]
  return order[(idx + 1) % order.length]
}

/**
 * Запоминает игроков, которые «вышли» (остались без карт при пустой колоде).
 * Порядок в finish_order = порядок выхода = места с 1-го по предпоследнее.
 */
export function recordFinishers(s) {
  if ((s.deck || []).length > 0) return
  // Выбывшие по AFK не считаются «вышедшими первыми» — они в конце таблицы.
  const skip = new Set([...(s.afk_ids || []), ...(s.folded_ids || [])].map(Number))
  const order = (s.turn_order || []).map(Number)
  const finish = (s.finish_order || []).map(Number)
  for (const uid of order) {
    if (skip.has(uid)) continue
    if (finish.includes(uid)) continue
    if (getHand(s.hands, uid).length === 0) finish.push(uid)
  }
  s.finish_order = finish
}

/**
 * Раскладка мест: [1-е место, 2-е, ..., последнее («дурак»)].
 * Каждый элемент — массив user_id (для Синдиката — оба напарника сразу).
 * Кто вышел раньше — место выше; «дурак» (с картами) — последний.
 */
export function placementOrder(state) {
  const order = (state.turn_order || []).map(Number)
  const finish = (state.finish_order || []).map(Number)
  const teams = state.teams
  // Выбывшие (AFK и их напарники по Синдикату) — всегда в конце таблицы мест.
  const outOrder = [...(state.afk_ids || []), ...(state.folded_ids || [])].map(Number)
  const outSet = new Set(outOrder)

  const isTeam =
    Array.isArray(teams) &&
    teams.length === order.length &&
    teams.some((t) => t !== null && t !== undefined)

  const rank = (uid) => {
    const i = finish.indexOf(Number(uid))
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }

  if (!isTeam) {
    const live = order
      .filter((uid) => !outSet.has(uid))
      .map((uid, i) => ({ uid, r: rank(uid), i }))
      .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.i - b.i))
      .map((x) => [x.uid])
    const out = outOrder.filter((uid) => order.includes(uid)).map((uid) => [uid])
    return [...live, ...out]
  }

  // Синдикат считается «вышедшим», когда вышел его последний участник.
  const teamIds = [...new Set(order.map((uid, i) => Number(teams[i])))]
  const groups = teamIds.map((tid) => {
    const members = order.filter((uid, i) => Number(teams[i]) === tid)
    const allOut = members.every((uid) => outSet.has(uid))
    return { members, allOut, r: Math.max(...members.map((uid) => rank(uid))) }
  })

  const live = groups.filter((g) => !g.allOut).sort((a, b) => a.r - b.r).map((g) => g.members)
  const dead = groups.filter((g) => g.allOut).map((g) => g.members)
  return [...live, ...dead]
}

/**
 * Кто сейчас «на часах» (для таймаута):
 *  • есть неотбитые карты → отбивается защитник;
 *  • стол пуст или всё отбито → заводит атакующий.
 */
export function expectedActor(state) {
  const table = state.table_cards || []
  if (hasUndefended(table)) return Number(state.defender_id)
  return Number(state.attacker_id)
}

/**
 * Досрочное завершение партии (игрок вышел или не успел по таймеру).
 * Проигравшим признаётся указанный игрок(и), а призовой фонд делится
 * ПОРОВНУ между всеми остальными участниками (even_split = true).
 */
export function abortGame(state, { loserIds }) {
  const s = deepClone(state)
  if (s.status === 'finished') return { state: s }

  const order = (s.turn_order || []).map(Number)
  const losers = (Array.isArray(loserIds) ? loserIds : [loserIds])
    .map(Number)
    .filter((u) => order.includes(u))
  if (losers.length === 0) return { state: s }

  s.status = 'finished'
  s.loser_ids = losers
  s.loser_id = losers[0]
  s.winner_ids = order.filter((u) => !losers.includes(u))
  s.winner_id = s.winner_ids.length ? s.winner_ids[0] : null
  s.placement = null
  s.even_split = true
  s.turn_deadline = null
  s.updated_at = new Date().toISOString()
  return { state: s }
}

/**
 * Проверяет, закончилась ли игра.
 *  • Классика: проигрывает последний, у кого остались карты.
 *  • Синдикат: как только одна команда вышла полностью — она победила,
 *    остальные команды проиграли.
 * Возвращает { finished, loserId, loserIds, winnerIds }.
 */
export function checkGameOver(state) {
  const { hands, deck, turn_order, teams } = state
  if ((deck || []).length > 0) return { finished: false }

  const order = (turn_order || []).map(Number)
  const handsEmpty = (uid) => getHand(hands, uid).length === 0

  // --- Командный режим (Синдикат) ---
  // Партия идёт, пока в игре больше одного Синдиката. Проигрывает последний
  // оставшийся синдикат (у его игроков ещё есть карты).
  if (Array.isArray(teams) && teams.length === order.length && teams.some((t) => t !== null && t !== undefined)) {
    const members = new Map()
    order.forEach((uid, i) => {
      const t = Number(teams[i])
      if (!members.has(t)) members.set(t, [])
      members.get(t).push(uid)
    })

    const stillPlaying = [...members.values()].filter((list) => list.some((uid) => !handsEmpty(uid)))
    if (stillPlaying.length > 1) return { finished: false }

    const loserIds = stillPlaying.length === 1 ? stillPlaying[0] : []
    const winnerIds = order.filter((uid) => !loserIds.includes(uid))
    return {
      finished: true,
      loserId: loserIds.length ? loserIds[0] : null,
      loserIds,
      winnerIds,
    }
  }

  // --- Одиночный режим ---
  const withCards = order.filter((uid) => !handsEmpty(uid))
  if (withCards.length === 0) {
    return { finished: true, loserId: null, loserIds: [], winnerIds: order }
  }
  if (withCards.length === 1) {
    return {
      finished: true,
      loserId: withCards[0],
      loserIds: [withCards[0]],
      winnerIds: order.filter((u) => u !== withCards[0]),
    }
  }
  return { finished: false }
}

/**
 * Порядок хода. Для Синдиката команды «перемешиваются» так, чтобы напарники
 * не сидели рядом: 2×2 → [P1, P3, P2, P4], 2×2×2 → [P1, P3, P5, P2, P4, P6].
 */
export function buildTurnOrder(players, teams) {
  const ids = (players || []).map(Number)
  if (!Array.isArray(teams) || teams.length !== ids.length) return ids

  const byTeam = new Map()
  ids.forEach((id, i) => {
    const t = Number(teams[i])
    if (!byTeam.has(t)) byTeam.set(t, [])
    byTeam.get(t).push(id)
  })

  const teamIds = [...byTeam.keys()].sort((a, b) => a - b)
  const maxLen = Math.max(...teamIds.map((t) => byTeam.get(t).length))
  const order = []
  for (let i = 0; i < maxLen; i++) {
    for (const t of teamIds) {
      const list = byTeam.get(t)
      if (i < list.length) order.push(list[i])
    }
  }
  return order
}

/**
 * Инициализирует новое игровое состояние.
 * @param {object} opts
 *  - tableId, players (user_id по порядку мест), deckType, firstPlayerId,
 *    mode, teams (team по индексу players)
 */
export function initGameState({ tableId, players, deckType = '36 карт', firstPlayerId, mode = MODE_CLASSIC, teams = [], turnTime }) {
  const deck = createDeck(deckType)
  const turnOrder = buildTurnOrder(players, teams)

  // Команды в порядке turn_order (null — если одиночная игра)
  const orderedTeams = turnOrder.map((uid) => {
    if (!Array.isArray(teams) || teams.length === 0) return null
    const idx = (players || []).map(Number).indexOf(Number(uid))
    return idx === -1 ? null : Number(teams[idx])
  })

  const hands = {}
  for (const uid of turnOrder) {
    hands[handKey(uid)] = deck.splice(0, HAND_SIZE)
  }

  const trumpCard = deck[deck.length - 1] || null
  const trumpSuit = trumpCard ? trumpCard.suit : null

  const attackerId = Number(firstPlayerId) || turnOrder[0]
  const defenderId = nextPlayer(turnOrder, attackerId)
  const turn = Number(turnTime) > 0 ? Number(turnTime) : TURN_SECONDS

  return {
    table_id: tableId,
    mode,
    teams: orderedTeams,
    deck,
    trump_card: trumpCard,
    trump_suit: trumpSuit,
    hands,
    table_cards: [],
    discard: [],
    attacker_id: attackerId,
    defender_id: defenderId,
    turn_order: turnOrder,
    phase: 'attack',
    status: 'playing',
    turn_seconds: turn,
    turn_deadline: new Date(Date.now() + turn * 1000).toISOString(),
    // Просрочки ПОДРЯД по игроку: {"123": 1}. 2 подряд → игрок вылетает (AFK).
    timeout_streak: {},
    // Выбывшие за AFK (бай-ин сгорает) и их напарники по Синдикату
    afk_ids: [],
    folded_ids: [],
    winner_id: null,
    loser_id: null,
    loser_ids: [],
    winner_ids: [],
    // Порядок выхода игроков (кто первым остался без карт) — для мест и призов.
    finish_order: [],
    placement: null,
    even_split: false,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Следующий игрок, который ещё в игре. Когда колода пуста, пропускаем тех,
 * у кого рука пуста (они уже «вышли»).
 */
export function nextActivePlayer(state, userId) {
  const order = (state.turn_order || []).map(Number)
  if (order.length === 0) return Number(userId)
  const deckEmpty = (state.deck || []).length === 0
  let idx = order.indexOf(Number(userId))
  if (idx === -1) idx = 0
  for (let step = 1; step <= order.length; step++) {
    const cand = order[(idx + step) % order.length]
    if (!deckEmpty) return cand
    if (getHand(state.hands, cand).length > 0) return cand
  }
  return nextPlayer(order, userId)
}

/**
 * Применяет ход к состоянию. Возвращает { state, error }.
 * Не пишет в БД — только чистое преобразование.
 * Действия: attack | defend | transfer | take | bito
 */
export function applyMove(state, { userId, action, card, targetPairIndex, auto = false }) {
  const s = deepClone(state)
  const uid = Number(userId)

  if (s.status === 'finished') return { error: 'Игра уже завершена' }
  if (!(s.turn_order || []).map(Number).includes(uid)) {
    return { error: 'Вы не участник этой игры' }
  }
  // Победивший (у кого не осталось карт) становится наблюдателем и не ходит.
  if (getHand(s.hands, uid).length === 0) {
    return { error: 'Вы наблюдатель — карт на руках нет' }
  }

  // Реальный ход игрока сбрасывает его счётчик просрочек подряд.
  // Авто-действия (за просрочку) счётчик НЕ сбрасывают.
  if (!auto) resetTimeoutStreak(s, uid)

  // ------------------------------------------------------------------
  // АТАКА / ПОДКИДЫВАНИЕ
  // ------------------------------------------------------------------
  if (action === 'attack') {
    if (!card) return { error: 'Не передана карта' }
    const hand = getHand(s.hands, uid)
    if (!hand.some((c) => c.id === card.id)) return { error: 'Карты нет в руке' }
    if (!canAttack(s, uid, card)) return { error: 'Сейчас нельзя подкинуть эту карту' }

    setHand(s.hands, uid, hand.filter((c) => c.id !== card.id))
    s.table_cards.push({ attack: card, defend: null })
    s.phase = 'defend'
    recordFinishers(s)
    return { state: finishMove(s) }
  }

  // ------------------------------------------------------------------
  // ЗАЩИТА
  // ------------------------------------------------------------------
  if (action === 'defend') {
    if (!card) return { error: 'Не передана карта' }
    const hand = getHand(s.hands, uid)
    if (!hand.some((c) => c.id === card.id)) return { error: 'Карты нет в руке' }
    if (!canDefend(s, uid, card, Number(targetPairIndex) || 0)) return { error: 'Этой картой нельзя отбить' }

    setHand(s.hands, uid, hand.filter((c) => c.id !== card.id))
    s.table_cards[Number(targetPairIndex) || 0].defend = card

    // Автозакрытие захода: отбита последняя карта, и атакующим больше нечего
    // подкинуть (нет совпадающих рангов / лимит карт / кончилась рука защитника).
    if (shouldAutoBito(s)) return { state: closeBout(s) }

    recordFinishers(s)
    return { state: finishMove(s) }
  }

  // ------------------------------------------------------------------
  // ПЕРЕВОД (переводной дурак)
  // ------------------------------------------------------------------
  if (action === 'transfer') {
    if (!card) return { error: 'Не передана карта' }
    const hand = getHand(s.hands, uid)
    if (!hand.some((c) => c.id === card.id)) return { error: 'Карты нет в руке' }
    if (!canTransfer(s, uid, card)) return { error: 'Сейчас нельзя перевести ход' }

    setHand(s.hands, uid, hand.filter((c) => c.id !== card.id))
    s.table_cards.push({ attack: card, defend: null })
    s.defender_id = nextActivePlayer(s, s.defender_id)
    s.phase = 'defend'
    recordFinishers(s)
    return { state: finishMove(s) }
  }

  // ------------------------------------------------------------------
  // ВЗЯТЬ (защитник забирает все карты со стола)
  // ------------------------------------------------------------------
  if (action === 'take') {
    if (uid !== Number(s.defender_id)) return { error: 'Забрать карты может только защитник' }
    if ((s.table_cards || []).length === 0) return { error: 'Стол пуст' }
    // Нельзя «взять» уже отбитые карты: если все карты на столе покрыты —
    // защитник ничего не забирает (иначе он утащил бы и свои же отбои).
    if (!hasUndefended(s.table_cards)) return { error: 'Все карты отбиты — брать нечего' }

    const oldDefender = Number(s.defender_id)

    const taken = cardsOnTable(s.table_cards)
    setHand(s.hands, uid, [...getHand(s.hands, uid), ...taken])
    s.table_cards = []

    const refilled = refillHands(s)
    s.hands = refilled.hands
    s.deck = refilled.deck

    recordFinishers(s)

    // Атакующий продолжает заход. Если он уже вышел из игры (0 карт) — заход
    // ведёт тот, кто взял; иначе — следующий активный игрок.
    let attacker = Number(s.attacker_id)
    if (getHand(s.hands, attacker).length === 0) attacker = oldDefender
    if (getHand(s.hands, attacker).length === 0) attacker = nextActivePlayer(s, attacker)

    // Защитником становится следующий по кругу после прежнего защитника
    // (в игре на двоих это снова оказывается тот же защитник).
    let defender = nextActivePlayer(s, oldDefender)
    if (defender === attacker) defender = nextActivePlayer(s, defender)
    if (getHand(s.hands, defender).length === 0) defender = nextActivePlayer(s, defender)

    s.attacker_id = attacker
    s.defender_id = defender
    s.phase = 'attack'

    return { state: finishMove(s) }
  }

  // ------------------------------------------------------------------
  // БИТО (все карты отбиты — заход завершён)
  // ------------------------------------------------------------------
  if (action === 'bito') {
    if (uid === Number(s.defender_id)) return { error: 'Защитник не объявляет «бито»' }
    if ((s.table_cards || []).length === 0) return { error: 'Стол пуст' }
    if (hasUndefended(s.table_cards)) return { error: 'Есть неотбитые карты' }
    return { state: closeBout(s) }
  }

  return { error: 'Неизвестное действие' }
}

/**
 * Общий «хвост» хода: проверяем конец партии, иначе продлеваем таймер.
 */
function finishMove(s) {
  const over = checkGameOver(s)
  if (over.finished) return finishState(s, over)
  s.turn_deadline = nextDeadline(s)
  return s
}

/**
 * Закрывает текущий заход: карты со стола уходят в отбой, из колоды
 * дораздаются карты, защитник становится атакующим.
 * Единая точка для «Бито» и авто-закрытия захода.
 */
function closeBout(s) {
  const played = cardsOnTable(s.table_cards)
  s.discard = [...(s.discard || []), ...played]
  s.table_cards = []

  const refilled = refillHands(s)
  s.hands = refilled.hands
  s.deck = refilled.deck

  recordFinishers(s)

  const over = checkGameOver(s)
  if (over.finished) return finishState(s, over)

  // После закрытия захода защитник становится атакующим. Если он уже «вышел»
  // (0 карт) — заход ведёт следующий активный игрок (наблюдатели пропускаются).
  const defender = Number(s.defender_id)
  s.attacker_id = getHand(s.hands, defender).length > 0 ? defender : nextActivePlayer(s, defender)
  s.defender_id = nextActivePlayer(s, s.attacker_id)
  s.phase = 'attack'
  s.turn_deadline = nextDeadline(s)
  return s
}

function finishState(s, over) {
  s.status = 'finished'
  s.loser_id = over.loserId ?? null
  s.loser_ids = over.loserIds && over.loserIds.length ? over.loserIds : over.loserId ? [over.loserId] : []
  s.winner_ids = over.winnerIds || []
  s.winner_id = s.winner_ids.length ? s.winner_ids[0] : null
  // Итоговые места (для процентов призовых). При досрочном завершении
  // (выход/таймаут) места не используются — приз делится поровну.
  s.placement = placementOrder(s)
  s.even_split = false
  s.turn_deadline = null
  s.updated_at = new Date().toISOString()
  return s
}

/** Сбрасывает счётчик просрочек игрока (он снова активно играет). */
function resetTimeoutStreak(s, uid) {
  const streak = { ...(s.timeout_streak || {}) }
  delete streak[String(uid)]
  s.timeout_streak = streak
}

/** Следующий «живой» игрок (не выбывший; при пустой колоде — ещё и с картами). */
function nextLivePlayer(state, fromUserId, isLive) {
  const order = (state.turn_order || []).map(Number)
  if (order.length === 0) return Number(fromUserId)
  let idx = order.indexOf(Number(fromUserId))
  if (idx === -1) idx = 0
  for (let step = 1; step <= order.length; step++) {
    const cand = order[(step + idx) % order.length]
    if (isLive(cand)) return cand
  }
  return Number(fromUserId)
}

/**
 * ПРОСРОЧКА ХОДА (1-я подряд) — партия НЕ завершается.
 * Игроку автоматически применяется действие:
 *  • не отбился (есть неотбитые карты и он защитник) → «Взял»;
 *  • всё отбито → «Бито» (заход закрывается);
 *  • стол пуст → «Пас» (заход переходит следующему активному игроку).
 * Вторая просрочка ПОДРЯД → вылет (см. applyAfk).
 */
export function applyTimeout(state, now = Date.now()) {
  const s = deepClone(state)
  if (s.status !== 'playing') return { state: s }

  const actor = expectedActor(s)
  if (!actor || !(s.turn_order || []).map(Number).includes(actor)) return { state: s }

  const streak = { ...(s.timeout_streak || {}) }
  const count = Number(streak[String(actor)] || 0) + 1

  if (count >= TIMEOUTS_TO_AFK) {
    delete streak[String(actor)]
    s.timeout_streak = streak
    return { state: applyAfk(s, actor, now) }
  }

  streak[String(actor)] = count
  s.timeout_streak = streak
  return { state: applyAutoAction(s, actor, now) }
}

/** Авто-действие за просрочившего игрока (см. applyTimeout). */
function applyAutoAction(s, actor, now) {
  // Защитник не отбился — забирает карты
  if (Number(s.defender_id) === Number(actor) && hasUndefended(s.table_cards)) {
    const res = applyMove(s, { userId: actor, action: 'take', auto: true })
    if (!res.error) return res.state
  }

  // Всё отбито — заход закрывается («Бито»)
  if ((s.table_cards || []).length > 0 && !hasUndefended(s.table_cards)) {
    return closeBout(s)
  }

  // Стол пуст — «Пас»: заводит следующий активный игрок
  const deckEmpty = (s.deck || []).length === 0
  const out = new Set([...(s.afk_ids || []), ...(s.folded_ids || [])].map(Number))
  const isLive = (uid) => !out.has(Number(uid)) && (!deckEmpty || getHand(s.hands, uid).length > 0)

  const attacker = nextLivePlayer(s, Number(s.attacker_id), isLive)
  let defender = nextLivePlayer(s, attacker, isLive)
  if (defender === attacker) defender = nextPlayer(s.turn_order, attacker)

  s.attacker_id = attacker
  s.defender_id = defender
  s.phase = 'attack'
  s.turn_deadline = nextDeadline(s, now)
  return s
}

/** Партия завершается досрочно, если живых участников (или команд) осталось ≤ 1. */
function earlyFinishAfterAfk(s, outSet) {
  const order = (s.turn_order || []).map(Number)
  const teams = s.teams
  const isTeam =
    Array.isArray(teams) && teams.length === order.length && teams.some((t) => t !== null && t !== undefined)

  if (!isTeam) {
    // 1v1: остался один — он победил, приз 100%
    const live = order.filter((uid) => !outSet.has(uid))
    if (live.length <= 1) {
      return { finished: true, loserId: null, loserIds: [...outSet], winnerIds: live }
    }
    return null
  }

  // Синдикат: осталась одна команда — она забирает всё
  const teamIds = [...new Set(order.map((uid, i) => Number(teams[i])))]
  const liveTeams = teamIds.filter((tid) =>
    order.some((uid, i) => Number(teams[i]) === tid && !outSet.has(uid))
  )
  if (liveTeams.length <= 1) {
    const winnerIds = order.filter((uid, i) => liveTeams.includes(Number(teams[i])))
    const loserIds = order.filter((uid) => !winnerIds.includes(uid))
    return { finished: true, loserId: loserIds.length ? loserIds[0] : null, loserIds, winnerIds }
  }
  return null
}

/**
 * 2-я просрочка ПОДРЯД → игрок «вылетает» (AFK):
 *  • карты уходят в отбой, игрок исключается из партии;
 *  • бай-ин сгорает и остаётся в банке стола;
 *  • в Синдикате вместе с ним вылетает вся его команда (напарники → folded_ids);
 *  • в 1v1 и 2×2 партия завершается сразу (Вариант Б),
 *    иначе остальные доигрывают за оставшиеся призовые места.
 */
function applyAfk(s, actor, now) {
  const order = (s.turn_order || []).map(Number)
  const teams = s.teams
  const isTeam =
    Array.isArray(teams) && teams.length === order.length && teams.some((t) => t !== null && t !== undefined)

  const alreadyOut = new Set([...(s.afk_ids || []), ...(s.folded_ids || [])].map(Number))
  const victims = [Number(actor)]

  if (isTeam) {
    const idx = order.indexOf(Number(actor))
    const myTeam = idx === -1 ? null : Number(teams[idx])
    if (myTeam !== null) {
      order.forEach((uid, i) => {
        if (Number(teams[i]) === myTeam && uid !== Number(actor)) victims.push(uid)
      })
    }
  }

  const discarded = []
  for (const uid of victims) {
    if (alreadyOut.has(uid)) continue
    discarded.push(...getHand(s.hands, uid))
    setHand(s.hands, uid, [])
    alreadyOut.add(uid)
  }
  s.discard = [...(s.discard || []), ...discarded]

  s.afk_ids = [...new Set([...(s.afk_ids || []).map(Number), Number(actor)])]
  s.folded_ids = [
    ...new Set([...(s.folded_ids || []).map(Number), ...victims.filter((u) => u !== Number(actor))]),
  ]

  const early = earlyFinishAfterAfk(s, alreadyOut)
  if (early) return finishState(s, early)

  // Остальные доигрывают без выбывшего
  const deckEmpty = (s.deck || []).length === 0
  const isLive = (uid) => !alreadyOut.has(Number(uid)) && (!deckEmpty || getHand(s.hands, uid).length > 0)

  const attacker = isLive(s.attacker_id) ? Number(s.attacker_id) : nextLivePlayer(s, Number(s.attacker_id), isLive)
  let defender =
    isLive(s.defender_id) && Number(s.defender_id) !== attacker
      ? Number(s.defender_id)
      : nextLivePlayer(s, attacker, isLive)
  if (defender === attacker) defender = nextPlayer(order, attacker)

  s.attacker_id = attacker
  s.defender_id = defender
  s.phase = (s.table_cards || []).length === 0 ? 'attack' : 'defend'
  s.turn_deadline = nextDeadline(s, now)
  return s
}

/**
 * Пометить игрока вылетевшим по внешнему сигналу — например, при ЯВНОМ выходе
 * из-за стола во время партии (приравнивается к AFK-вылету за 2 таймаута).
 */
export function forceAfk(state, userId, now = Date.now()) {
  const s = deepClone(state)
  if (s.status !== 'playing') return { state: s }
  if (!(s.turn_order || []).map(Number).includes(Number(userId))) return { state: s }
  return { state: applyAfk(s, Number(userId), now) }
}

/**
 * «Ленивая» серверная проверка просрочки: если дедлайн прошёл — применяем
 * просрочку САМИ, не доверяя клиентскому сабмиту. Вызывается из ЛЮБОГО запроса
 * к столу (состояние, ход, таймаут), поэтому партия не зависает, даже если
 * сигнал клиента потерялся в сети.
 */
export function reconcileTimeout(state, now = Date.now()) {
  if (!state || state.status !== 'playing') return { state, changed: false }
  const deadline = state.turn_deadline ? new Date(state.turn_deadline).getTime() : 0
  if (!deadline || now < deadline) return { state, changed: false }
  const res = applyTimeout(state, now)
  return { state: res.state, changed: res.state !== state }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}




