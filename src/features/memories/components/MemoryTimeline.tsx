import { CalendarDays, Camera, Heart, ImageOff, MapPin, Search, Trash2 } from 'lucide-react'
import type { MemoryPost } from '../../../shared/types/memory'
import { formatMemoryDate } from '../../../shared/utils/date'

type MemoryTimelineProps = {
  folderName: string
  isConnected: boolean
  posts: MemoryPost[]
  query: string
  statusMessage?: string
  onDelete: (id: string) => void
  onQueryChange: (query: string) => void
}

export function MemoryTimeline({
  folderName,
  isConnected,
  posts,
  query,
  statusMessage,
  onDelete,
  onQueryChange,
}: MemoryTimelineProps) {
  return (
    <section className="timeline">
      <div className="section-heading timeline-heading">
        <div>
          <p className="eyebrow">Album</p>
          <h2>Memory timeline</h2>
        </div>
        <Heart size={22} />
      </div>

      {statusMessage && <p className="album-status">{statusMessage}</p>}

      <label className="search-box">
        <Search size={17} />
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title, place, or note..."
          value={query}
        />
      </label>

      {posts.length === 0 ? (
        <div className="empty-state">
          <Camera size={34} />
          <h3>{getEmptyTitle({ isConnected, query })}</h3>
          <p>{getEmptyMessage({ folderName, isConnected, query })}</p>
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-card" key={post.id}>
              {post.image ? (
                <img src={post.image} alt={post.title} />
              ) : (
                <div className="image-placeholder">
                  <ImageOff size={28} />
                  <span>Image unavailable</span>
                </div>
              )}
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
                    Open image in OneDrive
                  </a>
                )}
                <button className="ghost-button" onClick={() => onDelete(post.id)} type="button">
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function getEmptyTitle({
  isConnected,
  query,
}: {
  isConnected: boolean
  query: string
}) {
  if (!isConnected) {
    return 'Connect OneDrive to start'
  }

  if (query.trim()) {
    return 'No matching memories'
  }

  return 'This folder is empty'
}

function getEmptyMessage({
  folderName,
  isConnected,
  query,
}: {
  folderName: string
  isConnected: boolean
  query: string
}) {
  if (!isConnected) {
    return 'Open Settings, connect your Microsoft account, then choose a folder.'
  }

  if (query.trim()) {
    return 'Try another search term or clear the search box.'
  }

  return `Folder "${folderName}" has no memories yet. Create the first one from the form.`
}
