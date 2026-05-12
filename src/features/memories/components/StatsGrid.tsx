type StatsGridProps = {
  imageCount: number
  memoryCount: number
}

export function StatsGrid({ imageCount, memoryCount }: StatsGridProps) {
  return (
    <section className="stats-grid" aria-label="Thống kê kỷ niệm">
      <div>
        <span>{memoryCount}</span>
        <p>kỷ niệm</p>
      </div>
      <div>
        <span>{imageCount}</span>
        <p>hình ảnh</p>
      </div>
      <div>
        <span>UI</span>
        <p>sẵn sàng</p>
      </div>
    </section>
  )
}
