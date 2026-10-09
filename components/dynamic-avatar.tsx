export function DynamicAvatar({
  initials,
  color,
  photoUrl,
  size = 'md',
}: {
  initials: string
  color: string
  photoUrl?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'size-8 text-[10px]', md: 'size-10 text-xs', lg: 'size-24 text-2xl' }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Avatar"
        className={`shrink-0 rounded-full border border-white/15 object-cover shadow-lg ${sizes[size]}`}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br font-bold text-white shadow-lg ${color} ${sizes[size]}`}
    >
      {initials}
    </div>
  )
}