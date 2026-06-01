type StatsGridProps = {
  mediaCount: number
  memoryCount: number
}

export function StatsGrid({ mediaCount, memoryCount }: StatsGridProps) {
  return (
    <section className="stats-grid" aria-label="Memory stats">
      <div>
        <span>{memoryCount}</span>
        <p>memories</p>
      </div>
      <div>
        <span>{mediaCount}</span>
        <p>media</p>
      </div>
      <div>
        <span>Cloud</span>
        <p>storage</p>
      </div>
    </section>
  )
}
