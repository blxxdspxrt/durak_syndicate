// ============================================================================
// Сериализация игрового состояния для конкретного игрока.
// ============================================================================
// Секретные данные (порядок колоды, чужие руки) НИКОГДА не отдаются клиенту.
// ============================================================================

/**
 * @param {object} state полное состояние из game_states
 * @param {number} viewerId id игрока, который запрашивает состояние
 */
export function serializeForViewer(state, viewerId) {
  const vid = Number(viewerId)
  const hands = {}
  for (const [uid, hand] of Object.entries(state.hands || {})) {
    hands[uid] = Number(uid) === vid ? hand : { count: (hand || []).length }
  }
  const { deck, ...rest } = state
  return { ...rest, hands, deck_count: (deck || []).length }
}
