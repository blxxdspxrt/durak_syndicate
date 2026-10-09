'use client'

import dynamic from 'next/dynamic'

// Отключаем SSR полностью: Next.js больше НЕ БУДЕТ рендерить статику на сервере
const SyndicateApp = dynamic(() => import('@/components/syndicate-app'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-black text-white font-mono text-sm">
      Загрузка Синдиката...
    </div>
  ),
})

export default function Page() {
  return <SyndicateApp />
}