import { useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Heart,
  ImageOff,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { MemoryMedia, MemoryPost } from '../../../shared/types/memory'
import { formatMemoryDate } from '../../../shared/utils/date'

type MemoryTimelineProps = {
  folderName: string
  isConnected: boolean
  posts: MemoryPost[]
  query: string
  statusMessage?: string
  onDelete: (id: string) => void
  onEdit: (post: MemoryPost) => void
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
  onEdit,
  onQueryChange,
  onRetrySync,
}: MemoryTimelineProps) {
  const [viewer, setViewer] = useState<{
    index: number
    mediaItems: MemoryMedia[]
    title: string
  } | null>(null)
  const activeMedia = viewer?.mediaItems[viewer.index]

  const showPreviousMedia = () => {
    setViewer((currentViewer) => {
      if (!currentViewer) {
        return currentViewer
      }

      const previousIndex =
        currentViewer.index === 0 ? currentViewer.mediaItems.length - 1 : currentViewer.index - 1

      return {
        ...currentViewer,
        index: previousIndex,
      }
    })
  }

  const showNextMedia = () => {
    setViewer((currentViewer) => {
      if (!currentViewer) {
        return currentViewer
      }

      const nextIndex =
        currentViewer.index === currentViewer.mediaItems.length - 1 ? 0 : currentViewer.index + 1

      return {
        ...currentViewer,
        index: nextIndex,
      }
    })
  }

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
              <PostMedia
                onOpenMedia={(mediaItems, index) => setViewer({ index, mediaItems, title: post.title })}
                post={post}
              />
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
                  <button className="secondary-button compact-button" onClick={() => onEdit(post)} type="button">
                    <Pencil size={15} />
                    Edit
                  </button>
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

      {viewer && activeMedia && (
        <div className="media-viewer" role="dialog" aria-modal="true">
          <button
            aria-label="Close media viewer"
            className="media-viewer-close"
            onClick={() => setViewer(null)}
            type="button"
          >
            <X size={20} />
          </button>

          {viewer.mediaItems.length > 1 && (
            <>
              <button
                aria-label="Previous media"
                className="media-viewer-nav media-viewer-nav-previous"
                onClick={showPreviousMedia}
                type="button"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                aria-label="Next media"
                className="media-viewer-nav media-viewer-nav-next"
                onClick={showNextMedia}
                type="button"
              >
                <ChevronRight size={26} />
              </button>
              <div className="media-viewer-count">
                {viewer.index + 1} / {viewer.mediaItems.length}
              </div>
            </>
          )}

          <div className="media-viewer-content">
            {activeMedia.type === 'video' ? (
              <video controls src={activeMedia.url} />
            ) : (
              <img src={activeMedia.url} alt={viewer.title} />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function PostMedia({
  onOpenMedia,
  post,
}: {
  onOpenMedia: (mediaItems: MemoryMedia[], index: number) => void
  post: MemoryPost
}) {
  const mediaItems = getPostMediaItems(post)

  if (mediaItems.length === 0) {
    return (
      <div className="image-placeholder">
        <ImageOff size={28} />
        <span>Image unavailable</span>
      </div>
    )
  }

  const visibleMediaItems = mediaItems.slice(0, 4)
  const hiddenCount = mediaItems.length - visibleMediaItems.length

  return (
    <div className={`post-media-grid media-count-${Math.min(mediaItems.length, 4)}`}>
      {visibleMediaItems.map((media, index) => (
        <button className="post-media-item" key={media.id} onClick={() => onOpenMedia(mediaItems, index)} type="button">
          {media.type === 'video' ? (
            <video muted playsInline src={media.url} />
          ) : (
            <img src={media.url} alt={post.title} />
          )}
          {hiddenCount > 0 && index === visibleMediaItems.length - 1 && (
            <span className="media-more-overlay">+{hiddenCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function getPostMediaItems(post: MemoryPost): MemoryMedia[] {
  if (post.mediaItems?.length) {
    return post.mediaItems.filter((media) => media.url)
  }

  if (!post.image) {
    return []
  }

  return [
    {
      id: post.driveItemId ?? post.id,
      type: post.mediaType ?? 'image',
      url: post.image,
    },
  ]
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
