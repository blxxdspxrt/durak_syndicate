// ============================================================================
// Автотест игрового движка и экономики (чистые функции, без БД).
// Запуск: node scripts/engine-autotest.mjs   (или npm run test:engine)
// ============================================================================
// lib/game-engine.js и lib/economy.js не содержат импортов, поэтому мы
// копируем их во временные .mjs-файлы и загружаем как ESM
// (в проекте нет type: "module").
// ============================================================================

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const tempFiles = []

async function loadModule(relPath) {
  const source = readFileSync(join(here, '..', relPath), 'utf8')
  const safe = relPath.replace(/[^a-zA-Z0-9]/g, '_')
  const tmp = join(tmpdir(), `autotest-${safe}-${Date.now()}-${tempFiles.length}.mjs`)
  writeFileSync(tmp, source)
  tempFiles.push(tmp)
  return import(pathToFileURL(tmp).href)
}

const engine = await loadModule('lib/game-engine.js')
const economy = await loadModule('lib/economy.js')
const { applyMove, applyTimeout, shouldAutoBito, canContinueBout, abortGame, placementOrder } = engine
const { computeSettlement } = economy

// ---------------------------------------------------------------------------
// Мини-фреймворк
// ---------------------------------------------------------------------------
let passed = 0
const failures = []

function check(name, condition, extra = '') {
  if (condition) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failures.push(`${name}${extra ? ` — ${extra}` : ''}`)
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

function card(id) {
  return { id, rank: id.slice(0, -1), suit: id.slice(-1) }
}

function baseState(over = {}) {
  return {
    table_id: 'test',
    mode: 'Классический',
    teams: [],
    deck: [],
    trump_card: null,
    trump_suit: 'h',
    hands: {},
    table_cards: [],
    discard: [],
    attacker_id: 1,
    defender_id: 2,
    turn_order: [1, 2],
    phase: 'attack',
    status: 'playing',
    turn_deadline: new Date(Date.now() + 30000).toISOString(),
    winner_id: null,
    loser_id: null,
    loser_ids: [],
    winner_ids: [],
    ...over,
  }
}

// ---------------------------------------------------------------------------
// 1. «Беру» блокируется, когда все карты отбиты
// ---------------------------------------------------------------------------
console.log('\n1. Взять карты (take)')

{
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s')] },
    table_cards: [{ attack: card('6s'), defend: card('7s') }],
  })
  const res = applyMove(s, { userId: 2, action: 'take' })
  check('все карты отбиты → take отклонён', !!res.error, JSON.stringify(res))
  check('текст ошибки про «отбиты»', /отбиты/.test(res.error || ''), res.error)
}

{
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s')] },
    table_cards: [{ attack: card('6s'), defend: null }],
  })
  const res = applyMove(s, { userId: 2, action: 'take' })
  check('есть неотбитая карта → take разрешён', !res.error, JSON.stringify(res))
  check('стол очищен после take', (res.state?.table_cards || []).length === 0)
  check(
    'защитник получил карты со стола',
    (res.state?.hands?.['2'] || []).length === 2,
    JSON.stringify(res.state?.hands?.['2'])
  )
}

{
  const s = baseState({ table_cards: [] })
  const res = applyMove(s, { userId: 2, action: 'take' })
  check('пустой стол → take отклонён', !!res.error, res.error)
}


// ---------------------------------------------------------------------------
// 2. Автозакрытие захода («Бито») после отбоя
// ---------------------------------------------------------------------------
console.log('\n2. Авто-«Бито» после отбоя')

{
  // Защитник отбился, у атакующего нет карт нужного ранга → авто-бито.
  // У защитника остаётся вторая карта, поэтому партия продолжается.
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s'), card('10c')] },
    table_cards: [{ attack: card('6s'), defend: null }],
  })
  const res = applyMove(s, { userId: 2, action: 'defend', card: card('7s'), targetPairIndex: 0 })
  check('отбой без продолжения → без ошибки', !res.error, JSON.stringify(res))
  check('стол закрыт автоматически', (res.state?.table_cards || []).length === 0)
  check('карты ушли в отбой', (res.state?.discard || []).length === 2)
  check('защитник стал атакующим', Number(res.state?.attacker_id) === 2)
  check('новый защитник — игрок 1', Number(res.state?.defender_id) === 1)
}

{
  // Последний отбой на двоих: у защитника кончились карты → он победил,
  // атакующий с картами признан «дураком», партия завершается.
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s')] },
    table_cards: [{ attack: card('6s'), defend: null }],
  })
  const res = applyMove(s, { userId: 2, action: 'defend', card: card('7s'), targetPairIndex: 0 })
  check('партия завершена', res.state?.status === 'finished')
  check('дурак — игрок 1', Number(res.state?.loser_id) === 1)
  check('1-е место — игрок 2', Number(res.state?.placement?.[0]?.[0]) === 2)
  check('even_split выключен (обычный расчёт)', res.state?.even_split === false)
}

{
  // У атакующего ЕСТЬ карта того же ранга → заход не закрывается.
  // Защитник держит 2 карты, чтобы после отбоя у него осталась рука.
  const s = baseState({
    hands: { '1': [card('6h'), card('9s')], '2': [card('7s'), card('10c')] },
    table_cards: [{ attack: card('6s'), defend: null }],
  })
  const res = applyMove(s, { userId: 2, action: 'defend', card: card('7s'), targetPairIndex: 0 })
  check(
    'есть чем подкинуть → заход продолжается',
    !res.error && (res.state?.table_cards || []).length === 1,
    JSON.stringify(res.error)
  )
  check('карта защитника зафиксирована', !!res.state?.table_cards?.[0]?.defend)
}

{
  // Лимит 6 карт: 5 отбитых + 1 неотбитая, защитник кроет последнюю → авто-бито
  const pairs = []
  for (let i = 0; i < 5; i++) pairs.push({ attack: card('6s'), defend: card('7s') })
  pairs.push({ attack: card('6d'), defend: null })
  const s = baseState({
    hands: { '1': [card('6h'), card('9s')], '2': [card('7d'), card('8c')] },
    table_cards: pairs,
  })
  const res = applyMove(s, { userId: 2, action: 'defend', card: card('7d'), targetPairIndex: 5 })
  check(
    '6 карт на столе → авто-бито',
    !res.error && (res.state?.table_cards || []).length === 0,
    JSON.stringify(res.error)
  )
}

{
  // У атакующего нет карты нужного ранга → заход исчерпан
  const none = baseState({
    hands: { '1': [card('9s')], '2': [card('7s'), card('10c')] },
    table_cards: [{ attack: card('6s'), defend: card('7s') }],
  })
  check('shouldAutoBito: нет подходящих рангов → true', shouldAutoBito(none) === true)
  check('canContinueBout: нет подходящих рангов → false', canContinueBout(none) === false)

  // У атакующего есть карта того же ранга → можно подкидывать
  const some = baseState({
    hands: { '1': [card('6h')], '2': [card('7s'), card('10c')] },
    table_cards: [{ attack: card('6s'), defend: card('7s') }],
  })
  check('canContinueBout: есть совпадающий ранг → true', canContinueBout(some) === true)
  check('shouldAutoBito: есть чем подкинуть → false', shouldAutoBito(some) === false)

  check(
    'shouldAutoBito: есть неотбитая карта → false',
    shouldAutoBito({ ...none, table_cards: [{ attack: card('6s'), defend: null }] }) === false
  )
}

// ---------------------------------------------------------------------------
// 3. Таймаут
// ---------------------------------------------------------------------------
console.log('\n3. Таймаут хода (партия завершается, виновный проигрывает)')

{
  const past = new Date(Date.now() - 60000).toISOString()
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s')] },
    table_cards: [{ attack: card('6s'), defend: null }],
    turn_deadline: past,
  })
  const res = applyTimeout(s)
  check('таймаут → партия завершена', res.state?.status === 'finished')
  check(
    'проиграл не успевший (защитник 2)',
    (res.state?.loser_ids || []).map(Number).includes(2),
    JSON.stringify(res.state?.loser_ids)
  )
  check('приз делится поровну (even_split)', res.state?.even_split === true)
}

{
  const past = new Date(Date.now() - 60000).toISOString()
  const s = baseState({
    hands: { '1': [card('9s')], '2': [card('7s')] },
    table_cards: [],
    attacker_id: 1,
    defender_id: 2,
    turn_deadline: past,
  })
  const res = applyTimeout(s)
  check('пустой стол + таймаут → проиграл атакующий 1', (res.state?.loser_ids || []).map(Number).includes(1))
}

// ---------------------------------------------------------------------------
// 4. Полный цикл через реальный розыгрыш
// ---------------------------------------------------------------------------
console.log('\n4. Полный цикл (initGameState → ходы)')

{
  const state = engine.initGameState({
    tableId: 'auto',
    players: [1, 2],
    deckType: '36 карт',
    firstPlayerId: 1,
    mode: 'Классический',
  })

  check('старт: роздано по 6 карт', (state.hands['1'] || []).length === 6 && (state.hands['2'] || []).length === 6)
  check('старт: козырь определён', !!state.trump_suit)

  const atk = state.hands['1'][0]
  const res = applyMove(state, { userId: 1, action: 'attack', card: atk })
  check('заход выполнен', !res.error && (res.state.table_cards || []).length === 1, JSON.stringify(res.error))

  const takeRes = applyMove(res.state, { userId: 2, action: 'take' })
  check('защитник может взять неотбитую карту', !takeRes.error, JSON.stringify(takeRes.error))
  check('после взятия защитник получил карты', (takeRes.state.hands['2'] || []).length >= 7)
}

// ---------------------------------------------------------------------------
// 6. Экономика: рейк, призовые, ELO, Влияние
// ---------------------------------------------------------------------------
console.log('\n6. Экономика (рейк 8%)')

{
  // Классика на 6 человек, ставка 1000 → pot 6000, rake 480, net 5520
  const state = baseState({
    turn_order: [1, 2, 3, 4, 5, 6],
    placement: [[1], [2], [3], [4], [5], [6]],
  })
  const { pot, rake, net, results } = computeSettlement(state, 1000)
  const prize = (uid) => results.find((r) => r.userId === uid).prize
  const delta = (uid) => results.find((r) => r.userId === uid).dollars
  const elo = (uid) => results.find((r) => r.userId === uid).elo

  check('пот = 6 x 1000', pot === 6000)
  check('рейк 8% = 480', rake === 480)
  check('чистый фонд = 5520', net === 5520)

  check('1 место: приз 2208', prize(1) === 2208, String(prize(1)))
  check('2 место: приз 1324', prize(2) === 1324, String(prize(2)))
  check('3 место: приз 993', prize(3) === 993, String(prize(3)))
  check('4 место: приз 607', prize(4) === 607, String(prize(4)))
  check('5 место: приз 386', prize(5) === 386, String(prize(5)))
  check('6 место (дурак): приз 0', prize(6) === 0)

  check('1 место: чистыми +1208', delta(1) === 1208, String(delta(1)))
  check('2 место: чистыми +324', delta(2) === 324, String(delta(2)))
  check('6 место: чистыми -1000', delta(6) === -1000, String(delta(6)))

  check(
    'ELO по местам 35,18,6,-4,-15,-40',
    [elo(1), elo(2), elo(3), elo(4), elo(5), elo(6)].join(',') === '35,18,6,-4,-15,-40'
  )
  check('в Классике Влияние не меняется', results.every((r) => r.influence === 0))
  const sumDelta = results.reduce((a, r) => a + r.dollars, 0)
  check(
    'сумма изменений = -рейк (минус округление вниз)',
    sumDelta <= -rake && sumDelta > -(rake + results.length),
    String(sumDelta)
  )
  check('нет дробных долларов', results.every((r) => Number.isInteger(r.dollars) && Number.isInteger(r.prize)))
}

{
  // Синдикат 2x2x2, ставка 1000 → net 5520
  const state = baseState({
    mode: 'Синдикат',
    turn_order: [1, 2, 3, 4, 5, 6],
    teams: [1, 1, 2, 2, 3, 3],
    placement: [[1, 2], [3, 4], [5, 6]],
  })
  const { results } = computeSettlement(state, 1000)
  const prize = (uid) => results.find((r) => r.userId === uid).prize
  const inf = (uid) => results.find((r) => r.userId === uid).influence
  const delta = (uid) => results.find((r) => r.userId === uid).dollars

  check('1-й синдикат: по 1932 каждому', prize(1) === 1932 && prize(2) === 1932, `${prize(1)},${prize(2)}`)
  check('2-й синдикат: по 828 каждому', prize(3) === 828 && prize(4) === 828, `${prize(3)},${prize(4)}`)
  check('3-й синдикат: $0', prize(5) === 0 && prize(6) === 0)
  check('чистыми у победителей +932', delta(1) === 932)
  check('Влияние 1 места +32', inf(1) === 32 && inf(2) === 32)
  check('Влияние 2 места +6', inf(3) === 6 && inf(4) === 6)
  check('Влияние 3 места -28', inf(5) === -28 && inf(6) === -28)
  check('в Синдикате ELO не меняется', results.every((r) => r.elo === 0))
}

{
  // Синдикат 2x2: победивший синдикат забирает весь чистый фонд пополам
  const state = baseState({
    mode: 'Синдикат',
    turn_order: [1, 2, 3, 4],
    teams: [1, 1, 2, 2],
    placement: [[1, 2], [3, 4]],
  })
  const { results } = computeSettlement(state, 1000) // pot 4000, net 3680
  const prize = (uid) => results.find((r) => r.userId === uid).prize
  check('2x2: победители по 1840', prize(1) === 1840 && prize(2) === 1840, `${prize(1)}`)
  check('2x2: проигравшие $0', prize(3) === 0 && prize(4) === 0)
}

{
  // Досрочное завершение: приз поровну, округление вниз, без ELO/Влияния
  const s2 = baseState({ turn_order: [1, 2, 3, 4], loser_ids: [4], even_split: true })
  const r2 = computeSettlement(s2, 1000) // pot 4000, net 3680, остаются 3
  const prize = r2.results.find((r) => r.userId === 1).prize
  check('поровну между тремя: 1226', prize === 1226, String(prize))
  check('проигравший (вышедший) получает $0', r2.results.find((r) => r.userId === 4).prize === 0)
  check('у проигравшего чистыми -1000', r2.results.find((r) => r.userId === 4).dollars === -1000)
  check('при abort ELO не меняется', r2.results.every((r) => r.elo === 0))
}

// ---------------------------------------------------------------------------
// 5. Наблюдатели и места
// ---------------------------------------------------------------------------
console.log('\n5. Наблюдатели и раскладка мест')

{
  // Победивший (0 карт) не может ходить
  const s = baseState({
    hands: { '1': [], '2': [card('7s'), card('8s')] },
    table_cards: [{ attack: card('6s'), defend: null }],
    deck: [],
    finish_order: [1],
  })
  const res = applyMove(s, { userId: 1, action: 'attack', card: card('9s') })
  check('наблюдатель не может ходить', !!res.error, JSON.stringify(res))

  // 3 игрока: 1 и 2 вышли, 3 — «дурак»
  const state = baseState({
    hands: { '1': [], '2': [], '3': [card('6s')] },
    deck: [],
    turn_order: [1, 2, 3],
    finish_order: [1, 2],
  })
  const places = placementOrder(state)
  check('мест ровно 3', places.length === 3, JSON.stringify(places))
  check('1-е место — игрок 1', Number(places[0][0]) === 1)
  check('2-е место — игрок 2', Number(places[1][0]) === 2)
  check('последнее место — дурак (3)', Number(places[2][0]) === 3)
}

// ---------------------------------------------------------------------------
// Итог
// ---------------------------------------------------------------------------
for (const f of tempFiles) {
  try {
    unlinkSync(f)
  } catch {}
}

console.log(`\n${'-'.repeat(60)}`)
if (failures.length === 0) {
  console.log(`ВСЕ ТЕСТЫ ПРОЙДЕНЫ: ${passed}`)
  process.exit(0)
} else {
  console.log(`ПРОВАЛЕНО: ${failures.length} из ${passed + failures.length}`)
  failures.forEach((f) => console.log(`  x ${f}`))
  process.exit(1)
}

