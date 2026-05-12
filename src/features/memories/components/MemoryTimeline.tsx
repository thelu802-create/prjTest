import { CalendarDays, Camera, Heart, MapPin, Search, Trash2 } from 'lucide-react'
import type { MemoryPost } from '../../../shared/types/memory'
import { formatMemoryDate } from '../../../shared/utils/date'

type MemoryTimelineProps = {
  posts: MemoryPost[]
  query: string
  onDelete: (id: string) => void
  onQueryChange: (query: string) => void
}

export function MemoryTimeline({ posts, query, onDelete, onQueryChange }: MemoryTimelineProps) {
  return (
    <section className="timeline">
      <div className="section-heading timeline-heading">
        <div>
          <p className="eyebrow">Album</p>
          <h2>Dòng kỷ niệm</h2>
        </div>
        <Heart size={22} />
      </div>

      <label className="search-box">
        <Search size={17} />
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm theo tiêu đề, nơi chốn..."
          value={query}
        />
      </label>

      {posts.length === 0 ? (
        <div className="empty-state">
          <Camera size={34} />
          <h3>Chưa có kỷ niệm phù hợp</h3>
          <p>Thử đổi từ khóa hoặc đăng bài đầu tiên.</p>
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-card" key={post.id}>
              <img src={post.image} alt={post.title} />
              <div className="post-content">
                <div className="post-meta">
                  <span>
                    <CalendarDays size={14} />
                    {formatMemoryDate(post.date)}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {post.place}
                  </span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
                {post.driveUrl && (
                  <a className="drive-link" href={post.driveUrl} rel="noreferrer" target="_blank">
                    Mở ảnh trên OneDrive
                  </a>
                )}
                <button className="ghost-button" onClick={() => onDelete(post.id)} type="button">
                  <Trash2 size={16} />
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
