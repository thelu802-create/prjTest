type StatsGridProps = {
  imageCount: number
  memoryCount: number
}

export function StatsGrid({ imageCount, memoryCount }: StatsGridProps) {
  return (
    <section className="stats-grid" aria-label="Memory stats">
      <div>
        <span>{memoryCount}</span>
        <p>memories</p>
      </div>
      <div>
        <span>{imageCount}</span>
        <p>images</p>
      </div>
      <div>
        <span>Cloud</span>
        <p>storage</p>
      </div>
    </section>
  )
}
