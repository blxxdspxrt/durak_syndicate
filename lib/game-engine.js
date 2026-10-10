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
export const TURN_SECONDS = 30

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
  if (Array.isArray(teams) && teams.length === order.length && teams.some((t) => t !== null && t !== undefined)) {
    const members = new Map()
    order.forEach((uid, i) => {
      const t = Number(teams[i])
      if (!members.has(t)) members.set(t, [])
      members.get(t).push(uid)
    })

    const outTeams = [...members.entries()].filter(([, list]) => list.every(handsEmpty))
    if (outTeams.length === 0) return { finished: false }

    const winnerIds = outTeams.flatMap(([, list]) => list)
    const loserIds = order.filter((uid) => !winnerIds.includes(uid))
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
export function initGameState({ tableId, players, deckType = '36 карт', firstPlayerId, mode = MODE_CLASSIC, teams = [] }) {
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
    turn_deadline: new Date(Date.now() + TURN_SECONDS * 1000).toISOString(),
    winner_id: null,
    loser_id: null,
    loser_ids: [],
    winner_ids: [],
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
export function applyMove(state, { userId, action, card, targetPairIndex }) {
  const s = deepClone(state)
  const uid = Number(userId)

  if (s.status === 'finished') return { error: 'Игра уже завершена' }
  if (!(s.turn_order || []).map(Number).includes(uid)) {
    return { error: 'Вы не участник этой игры' }
  }

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
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
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
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
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
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
  }

  // ------------------------------------------------------------------
  // ВЗЯТЬ (защитник забирает все карты со стола)
  // ------------------------------------------------------------------
  if (action === 'take') {
    if (uid !== Number(s.defender_id)) return { error: 'Забрать карты может только защитник' }
    const taken = cardsOnTable(s.table_cards)
    setHand(s.hands, uid, [...getHand(s.hands, uid), ...taken])
    s.table_cards = []

    // После «взял» атакующий остаётся, защитником становится следующий
    s.defender_id = nextActivePlayer(s, s.defender_id)
    s.phase = 'attack'

    const refilled = refillHands(s)
    s.hands = refilled.hands
    s.deck = refilled.deck

    const over = checkGameOver(s)
    if (over.finished) return { state: finishState(s, over) }
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
  }

  // ------------------------------------------------------------------
  // БИТО (все карты отбиты — заход завершён)
  // ------------------------------------------------------------------
  if (action === 'bito') {
    if (uid === Number(s.defender_id)) return { error: 'Защитник не объявляет «бито»' }
    if (hasUndefended(s.table_cards)) return { error: 'Есть неотбитые карты' }
    if ((s.table_cards || []).length === 0) return { error: 'Стол пуст' }

    const played = cardsOnTable(s.table_cards)
    s.discard = [...(s.discard || []), ...played]
    s.table_cards = []

    // После «бито» защитник становится атакующим, следующий — защитником
    s.attacker_id = s.defender_id
    s.defender_id = nextActivePlayer(s, s.attacker_id)
    s.phase = 'attack'

    const refilled = refillHands(s)
    s.hands = refilled.hands
    s.deck = refilled.deck

    const over = checkGameOver(s)
    if (over.finished) return { state: finishState(s, over) }
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
  }

  return { error: 'Неизвестное действие' }
}

function finishState(s, over) {
  s.status = 'finished'
  s.loser_id = over.loserId ?? null
  s.loser_ids = over.loserIds && over.loserIds.length ? over.loserIds : over.loserId ? [over.loserId] : []
  s.winner_ids = over.winnerIds || []
  s.winner_id = s.winner_ids.length ? s.winner_ids[0] : null
  s.turn_deadline = null
  s.updated_at = new Date().toISOString()
  return s
}

/**
 * Автодействие по истечении таймера.
 * Если защитник не успел — он берёт карты. Если атакующий не завёл — ход переходит.
 */
export function applyTimeout(state) {
  const s = deepClone(state)
  if (s.status === 'finished') return { state: s }

  if ((s.table_cards || []).length === 0) {
    // Атакующий не завёл — передаём ход следующему
    s.attacker_id = nextActivePlayer(s, s.attacker_id)
    s.defender_id = nextActivePlayer(s, s.attacker_id)
    s.phase = 'attack'
    s.turn_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString()
    return { state: s }
  }

  // Защитник не отбился — забирает карты
  return applyMove(s, { userId: s.defender_id, action: 'take' })
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}




