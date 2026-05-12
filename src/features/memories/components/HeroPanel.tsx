import { Camera, Sparkles } from 'lucide-react'
import type { MemoryPost } from '../../../shared/types/memory'

type HeroPanelProps = {
  latestPost?: MemoryPost
  monthLabel: string
}

export function HeroPanel({ latestPost, monthLabel }: HeroPanelProps) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <div className="status-pill">
          <Sparkles size={15} />
          <span>{monthLabel}</span>
        </div>
        <h2>{latestPost?.title ?? 'Bắt đầu album đầu tiên'}</h2>
        <p>{latestPost?.body ?? 'Thêm hình ảnh và ghi lại nội dung bạn muốn giữ.'}</p>
      </div>
      <div className="hero-photo">
        {latestPost ? <img src={latestPost.image} alt={latestPost.title} /> : <Camera size={42} />}
      </div>
    </section>
  )
}
