import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Heart,
  ImageOff,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
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
  onRetrySync: (id: string) => void
}

export function MemoryTimeline({
  folderName,
  isConnected,
  posts,
  query,
  statusMessage,
  onDelete,
  onQueryChange,
  onRetrySync,
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
              {post.image && post.mediaType === 'video' ? (
                <video controls src={post.image} />
              ) : post.image ? (
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
                <SyncStatus post={post} />
                {post.driveUrl && (
                  <a className="drive-link" href={post.driveUrl} rel="noreferrer" target="_blank">
                    Open {post.mediaType === 'video' ? 'video' : 'image'} in OneDrive
                  </a>
                )}
                <div className="post-actions">
                  {post.syncStatus === 'failed' && (
                    <button className="secondary-button compact-button" onClick={() => onRetrySync(post.id)} type="button">
                      <RefreshCw size={15} />
                      Retry sync
                    </button>
                  )}
                  <button className="ghost-button" onClick={() => onDelete(post.id)} type="button">
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SyncStatus({ post }: { post: MemoryPost }) {
  if (post.syncStatus === 'failed') {
    return (
      <div className="sync-status sync-status-failed">
        <AlertTriangle size={15} />
        <span>{post.syncError || 'Record not synced. Retry to save it to OneDrive.'}</span>
      </div>
    )
  }

  if (post.syncStatus === 'syncing') {
    return (
      <div className="sync-status sync-status-syncing">
        <LoaderCircle size={15} />
        <span>Syncing record...</span>
      </div>
    )
  }

  return (
    <div className="sync-status sync-status-synced">
      <CheckCircle2 size={15} />
      <span>Synced</span>
    </div>
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
