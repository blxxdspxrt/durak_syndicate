import { createClient } from '@supabase/supabase-js'

// ============================================================================
// СЕРВЕРНЫЙ Supabase-клиент (service_role).
// ============================================================================
// ВАЖНО: этот модуль можно импортировать ТОЛЬКО из серверного кода
// (app/api/**/route.js). Ключ service_role даёт полный доступ к БД в обход RLS
// и НИКОГДА не должен попадать в браузерный бандл.
//
// Пока переменная SUPABASE_SERVICE_ROLE_KEY не задана, работает откат на
// anon-ключ (чтобы старые деплои не падали). В этом режиме RLS-защита карт
// НЕ действует — обязательно добавьте service_role ключ в .env.local
// и примените supabase/migrations/002_security.sql.
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let warnedMissingServiceKey = false

function resolveKey() {
  if (serviceRoleKey) return serviceRoleKey
  if (!warnedMissingServiceKey) {
    warnedMissingServiceKey = true
    console.warn(
      '[SECURITY WARNING] SUPABASE_SERVICE_ROLE_KEY не задан. ' +
        'Сервер использует anon-ключ, защита карт через RLS недоступна. ' +
        'Добавьте service_role ключ в .env.local и примените supabase/migrations/002_security.sql.'
    )
  }
  return anonKey
}

export const supabaseAdmin = createClient(supabaseUrl, resolveKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})
