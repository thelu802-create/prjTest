import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CircleHelp, Images, Settings } from 'lucide-react'
import { MemoryComposer } from '../features/memories/components/MemoryComposer'
import { MemoryTimeline } from '../features/memories/components/MemoryTimeline'
import { StatsGrid } from '../features/memories/components/StatsGrid'
import { useMemories } from '../features/memories/hooks/useMemories'
import { OneDriveStatusCard } from '../features/onedrive/components/OneDriveStatusCard'
import { useOneDrive } from '../features/onedrive/hooks/useOneDrive'
import type { MemoryDraft, MemoryDraftMedia, MemoryMedia, MemoryPost } from '../shared/types/memory'
import {
  formatMonthLabel,
  getCurrentMonthInputValue,
  getMonthInputValue,
  getTodayInputValue,
} from '../shared/utils/date'
import './App.css'

const emptyDraft: MemoryDraft = {
  title: '',
  body: '',
  place: '',
  date: getTodayInputValue(),
  image: '',
  mediaType: 'image',
  imageFile: null,
  fileName: '',
  mediaItems: [],
}

export function App() {
  const memories = useMemories()
  const oneDrive = useOneDrive()
  const { replaceMemories } = memories
  const {
    account,
    folderName,
    loadImage,
    loadLegacyMemories,
    loadMemories,
    loadThumbnail,
    setUploadError,
  } = oneDrive
  const [activeView, setActiveView] = useState<'album' | 'settings' | 'help'>('album')
  const [draft, setDraft] = useState<MemoryDraft>(emptyDraft)
  const [albumStatus, setAlbumStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingPost, setEditingPost] = useState<MemoryPost | null>(null)
  const [editDraft, setEditDraft] = useState({
    title: '',
    body: '',
    place: '',
    date: getTodayInputValue(),
  })
  const [isUpdatingPost, setIsUpdatingPost] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInputValue())
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const hasSelectedFolder = Boolean(folderName.trim())
  const canSaveMemory = Boolean(account && hasSelectedFolder)
  const saveDisabledMessage = !account
    ? 'Connect OneDrive in Settings before saving.'
    : !hasSelectedFolder
      ? 'Choose a OneDrive folder in Settings before saving.'
      : ''

  const updateDraft = (nextDraft: Partial<MemoryDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...nextDraft }))
  }

  const updateEditDraft = (nextDraft: Partial<typeof editDraft>) => {
    setEditDraft((currentDraft) => ({ ...currentDraft, ...nextDraft }))
  }

  const loadSelectedMonth = useCallback(async (lifecycle: { isActive: boolean }) => {
    if (!account || !lifecycle.isActive) {
      return
    }

    setAlbumStatus(`Loading ${formatMonthLabel(selectedMonth)} from ${folderName}...`)

    try {
      const cloudPosts = await loadMemories(selectedMonth)
      const legacyPosts = cloudPosts ? null : await loadLegacyMemories()
      const monthlyPosts =
        cloudPosts ?? legacyPosts?.filter((post) => getMonthInputValue(post.date) === selectedMonth)

      const postsWithImages = await mapWithConcurrency(
        monthlyPosts ?? [],
        3,
        (post) => hydratePostMedia(post, loadThumbnail),
      )

      if (lifecycle.isActive) {
        replaceMemories(postsWithImages)
        setAlbumStatus(
          `Loaded ${postsWithImages.length} memories from ${formatMonthLabel(selectedMonth)}.`,
        )
      }
    } catch {
      if (lifecycle.isActive) {
        setUploadError()
        setAlbumStatus('Could not load memories from OneDrive.')
      }
    }
  }, [
    account,
    folderName,
    loadLegacyMemories,
    loadMemories,
    loadThumbnail,
    replaceMemories,
    selectedMonth,
    setUploadError,
  ])

  useEffect(() => {
    const lifecycle = { isActive: true }

    queueMicrotask(() => {
      void loadSelectedMonth(lifecycle)
    })

    return () => {
      lifecycle.isActive = false
    }
  }, [loadSelectedMonth])

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])

    if (selectedFiles.length === 0) {
      return
    }

    const nextMediaItems = selectedFiles.map((file) => {
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

      return {
        id: createMemoryId(),
        file,
        fileSize: file.size,
        name: file.name,
        type: mediaType,
        url: URL.createObjectURL(file),
      } satisfies MemoryDraftMedia
    })

    setDraft((currentDraft) => {
      const mediaItems = [...currentDraft.mediaItems, ...nextMediaItems]
      const firstMedia = mediaItems[0]

      return {
        ...currentDraft,
        fileName: firstMedia?.name ?? '',
        image: firstMedia?.url ?? '',
        imageFile: firstMedia?.file ?? null,
        mediaItems,
        mediaType: firstMedia?.type ?? 'image',
      }
    })

    event.target.value = ''
  }

  const handleRemoveDraftMedia = (id: string) => {
    setDraft((currentDraft) => {
      const removedMedia = currentDraft.mediaItems.find((media) => media.id === id)

      if (removedMedia?.url.startsWith('blob:')) {
        URL.revokeObjectURL(removedMedia.url)
      }

      const mediaItems = currentDraft.mediaItems.filter((media) => media.id !== id)
      const firstMedia = mediaItems[0]

      return {
        ...currentDraft,
        fileName: firstMedia?.name ?? '',
        image: firstMedia?.url ?? '',
        imageFile: firstMedia?.file ?? null,
        mediaItems,
        mediaType: firstMedia?.type ?? 'image',
      }
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!oneDrive.account) {
      showUserAlert('Connect OneDrive in Settings before saving.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    if (!oneDrive.folderName.trim()) {
      showUserAlert('Choose a OneDrive folder in Settings before saving.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    const validationMessage = getDraftValidationMessage(draft)

    if (validationMessage) {
      showUserAlert(validationMessage, setAlbumStatus)
      return
    }

    setIsSaving(true)
    setUploadProgress(0)
    const postMonth = getMonthInputValue(draft.date)
    setAlbumStatus(`Saving to ${formatMonthLabel(postMonth)}...`)
    let pendingPost: MemoryPost | null = null
    let pendingPosts: MemoryPost[] = []

    try {
      const draftMediaItems = getDraftMediaItems(draft)
      const uploadedMediaItems: MemoryMedia[] = []

      for (const [index, media] of draftMediaItems.entries()) {
        const uploadedItem = await oneDrive.uploadImage(media.file, media.type, (progress) => {
          setUploadProgress(Math.round(((index + progress / 100) / draftMediaItems.length) * 100))
        })

        uploadedMediaItems.push({
          id: media.id,
          driveItemId: uploadedItem?.id,
          driveUrl: uploadedItem?.webUrl,
          fileSize: media.file.size,
          name: uploadedItem?.name ?? media.name,
          type: media.type,
          url: media.url,
        })
      }

      const firstUploadedMedia = uploadedMediaItems[0]
      pendingPost = {
        id: createMemoryId(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        place: draft.place.trim() || 'No place set',
        date: draft.date,
        image: firstUploadedMedia?.url ?? '',
        mediaItems: uploadedMediaItems,
        mediaType: firstUploadedMedia?.type,
        driveItemId: firstUploadedMedia?.driveItemId,
        driveUrl: firstUploadedMedia?.driveUrl,
        imageName: firstUploadedMedia?.name,
        mediaName: firstUploadedMedia?.name,
        fileSize: firstUploadedMedia?.fileSize,
        syncStatus: 'synced',
        createdAt: new Date().toISOString(),
      }
      const monthPosts =
        postMonth === selectedMonth
          ? await getWritableMonthPosts(postMonth, memories.posts, oneDrive.loadMemories)
          : ((await oneDrive.loadMemories(postMonth)) ?? [])
      pendingPosts = upsertMemoryPost(monthPosts, pendingPost)

      await oneDrive.saveMemories(pendingPosts, postMonth)

      if (postMonth === selectedMonth) {
        memories.replaceMemories(pendingPosts)
      } else {
        setSelectedMonth(postMonth)
      }

      setDraft({ ...emptyDraft, date: getTodayInputValue() })
      setAlbumStatus(`Saved to ${formatMonthLabel(postMonth)}.`)
    } catch (error) {
      console.error('Memory save failed', error)
      oneDrive.setUploadError()

      if (pendingPost) {
        if (postMonth !== selectedMonth) {
          showUserAlert(
            `Media uploaded, but the ${formatMonthLabel(postMonth)} memory record was not saved. ${getErrorMessage(error)}`,
            setAlbumStatus,
          )
          return
        }

        const failedPosts = updateMemorySyncState(pendingPosts, pendingPost.id, {
          syncStatus: 'failed',
          syncError: getErrorMessage(error),
        })
        memories.replaceMemories(failedPosts)
        showUserAlert(
          `Media uploaded, but the memory record was not saved. ${getErrorMessage(error)}`,
          setAlbumStatus,
        )
        return
      }

      showUserAlert(`Save failed. ${getErrorMessage(error)}`, setAlbumStatus)
    } finally {
      setIsSaving(false)
      setUploadProgress(null)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    const targetPost = memories.posts.find((post) => post.id === id)

    if (!targetPost) {
      return
    }

    const mediaItemIds = getPostDriveItemIds(targetPost)
    const confirmed = window.confirm(
      mediaItemIds.length > 0
        ? 'Delete this memory and its media files from OneDrive?'
        : 'Delete this memory record from OneDrive?',
    )

    if (!confirmed) {
      return
    }

    const previousPosts = memories.posts
    setAlbumStatus(mediaItemIds.length > 0 ? 'Deleting media and memory...' : 'Deleting memory...')

    try {
      const latestPosts = await getWritableMonthPosts(selectedMonth, memories.posts, oneDrive.loadMemories)
      const nextPosts = latestPosts.filter((post) => post.id !== id)
      memories.replaceMemories(nextPosts)

      for (const driveItemId of mediaItemIds) {
        await oneDrive.deleteDriveItem(driveItemId)
      }

      await oneDrive.saveMemories(nextPosts, selectedMonth)
      setAlbumStatus(mediaItemIds.length > 0 ? 'Memory and media deleted.' : 'Memory deleted.')
    } catch (error) {
      console.error('Memory delete failed', error)
      oneDrive.setUploadError()
      memories.replaceMemories(previousPosts)
      showUserAlert(`Delete failed. ${getErrorMessage(error)}`, setAlbumStatus)
    }
  }

  const handleStartEdit = (post: MemoryPost) => {
    setEditingPost(post)
    setEditDraft({
      title: post.title,
      body: post.body,
      place: post.place === 'No place set' ? '' : post.place,
      date: post.date,
    })
  }

  const handleCancelEdit = () => {
    setEditingPost(null)
  }

  const handleUpdateMemory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingPost) {
      return
    }

    if (!oneDrive.account) {
      showUserAlert('Connect OneDrive in Settings before editing.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    const validationMessage = getMemoryTextValidationMessage(editDraft)

    if (validationMessage) {
      showUserAlert(validationMessage, setAlbumStatus)
      return
    }

    const previousPosts = memories.posts
    const originalMonth = getMonthInputValue(editingPost.date)
    const nextMonth = getMonthInputValue(editDraft.date)
    const updatedPost: MemoryPost = {
      ...editingPost,
      title: editDraft.title.trim(),
      body: editDraft.body.trim(),
      place: editDraft.place.trim() || 'No place set',
      date: editDraft.date,
      syncStatus: 'syncing',
      syncError: undefined,
    }

    setIsUpdatingPost(true)
    setAlbumStatus('Updating memory...')

    try {
      if (originalMonth === nextMonth) {
        const latestPosts = await getWritableMonthPosts(originalMonth, memories.posts, oneDrive.loadMemories)
        const nextPosts = upsertMemoryPost(latestPosts, updatedPost)
        memories.replaceMemories(nextPosts)
        const syncedPosts = updateMemorySyncState(nextPosts, editingPost.id, {
          syncStatus: 'synced',
          syncError: undefined,
        })
        await oneDrive.saveMemories(syncedPosts, selectedMonth)
        memories.replaceMemories(syncedPosts)
      } else {
        const targetMonthPosts = (await oneDrive.loadMemories(nextMonth)) ?? []
        const movedPost = { ...updatedPost, syncStatus: 'synced' as const, syncError: undefined }
        const nextTargetMonthPosts = upsertMemoryPost(targetMonthPosts, movedPost)
        await oneDrive.saveMemories(nextTargetMonthPosts, nextMonth)

        const latestOriginalMonthPosts = await getWritableMonthPosts(
          originalMonth,
          memories.posts,
          oneDrive.loadMemories,
        )
        const currentMonthPosts = latestOriginalMonthPosts.filter((post) => post.id !== editingPost.id)
        memories.replaceMemories(currentMonthPosts)
        await oneDrive.saveMemories(currentMonthPosts, originalMonth)
        setSelectedMonth(nextMonth)
      }

      setEditingPost(null)
      setAlbumStatus('Memory updated.')
    } catch (error) {
      console.error('Memory update failed', error)
      oneDrive.setUploadError()
      memories.replaceMemories(previousPosts)
      showUserAlert(`Update failed. ${getErrorMessage(error)}`, setAlbumStatus)
    } finally {
      setIsUpdatingPost(false)
    }
  }

  const handleRetrySync = async (id: string) => {
    if (!oneDrive.account) {
      showUserAlert('Connect OneDrive in Settings before retrying sync.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    const post = memories.posts.find((memory) => memory.id === id)

    if (!post) {
      return
    }

    const syncingPosts = updateMemorySyncState(memories.posts, id, {
      syncStatus: 'syncing',
      syncError: undefined,
    })
    memories.replaceMemories(syncingPosts)
    setAlbumStatus('Retrying memory sync...')

    try {
      const latestPosts = await getWritableMonthPosts(selectedMonth, memories.posts, oneDrive.loadMemories)
      const latestPostsWithRetry = upsertMemoryPost(latestPosts, {
        ...post,
        syncStatus: 'synced',
        syncError: undefined,
      })
      const syncedPosts = updateMemorySyncState(syncingPosts, id, {
        syncStatus: 'synced',
        syncError: undefined,
      })
      await oneDrive.saveMemories(latestPostsWithRetry, selectedMonth)
      memories.replaceMemories(syncedPosts)
      setAlbumStatus('Memory synced to OneDrive.')
    } catch (error) {
      console.error('Memory retry sync failed', error)
      oneDrive.setUploadError()
      const failedPosts = updateMemorySyncState(syncingPosts, id, {
        syncStatus: 'failed',
        syncError: getErrorMessage(error),
      })
      memories.replaceMemories(failedPosts)
      showUserAlert(`Retry failed. ${getErrorMessage(error)}`, setAlbumStatus)
    }
  }

  return (
    <main className="app-shell">
      <nav className="app-nav" aria-label="Main navigation">
        <button
          className={activeView === 'album' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('album')}
          type="button"
        >
          <Images size={17} />
          Album
        </button>
        <button
          className={activeView === 'settings' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('settings')}
          type="button"
        >
          <Settings size={17} />
          Settings
        </button>
        <button
          className={activeView === 'help' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('help')}
          type="button"
        >
          <CircleHelp size={17} />
          Help
        </button>
      </nav>

      {activeView === 'album' ? (
        <>
          <section className="month-toolbar" aria-label="Month filter">
            <div>
              <p className="eyebrow">Viewing</p>
              <h2>{formatMonthLabel(selectedMonth)}</h2>
            </div>
            <label>
              <span>Month</span>
              <input
                onChange={(event) => {
                  if (event.target.value) {
                    setSelectedMonth(event.target.value)
                  }
                }}
                type="month"
                value={selectedMonth}
              />
            </label>
          </section>

          <StatsGrid
            mediaCount={memories.posts.reduce((count, post) => count + getPostMediaCount(post), 0)}
            memoryCount={memories.posts.length}
          />

          <div className="desktop-layout">
            <aside className="left-column">
              <MemoryComposer
                canSave={canSaveMemory}
                draft={draft}
                isSaving={isSaving}
                onChange={updateDraft}
                onImageChange={handleImageChange}
                onRemoveMedia={handleRemoveDraftMedia}
                onSubmit={handleSubmit}
                saveDisabledMessage={saveDisabledMessage}
                uploadProgress={uploadProgress}
              />
            </aside>

            <MemoryTimeline
              folderName={oneDrive.folderName}
              isConnected={Boolean(oneDrive.account)}
              key={`${oneDrive.account?.homeAccountId ?? 'signed-out'}:${oneDrive.folderName}`}
              onDelete={handleDeleteMemory}
              onEdit={handleStartEdit}
              onLoadMedia={loadImage}
              onQueryChange={memories.setQuery}
              onRetrySync={handleRetrySync}
              posts={memories.filteredPosts}
              query={memories.query}
              statusMessage={albumStatus}
            />
          </div>
        </>
      ) : activeView === 'settings' ? (
        <section className="settings-layout">
          <OneDriveStatusCard
            account={oneDrive.account}
            folderName={oneDrive.folderName}
            folderOptions={oneDrive.folderOptions}
            isAuthReady={oneDrive.isAuthReady}
            isConfigured={oneDrive.isConfigured}
            isLoadingFolders={oneDrive.isLoadingFolders}
            onFolderChange={oneDrive.changeFolder}
            onRefreshFolders={oneDrive.refreshFolders}
            onSignIn={oneDrive.signIn}
            onSignOut={oneDrive.signOut}
            syncMessage={oneDrive.syncMessage}
          />
        </section>
      ) : (
        <section className="help-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Guide</p>
              <h2>How to use Memory Cloud</h2>
            </div>
            <CircleHelp size={22} />
          </div>
          <div className="help-grid">
            <article>
              <h3>1. Connect OneDrive</h3>
              <p>Open Settings, connect your Microsoft account, then choose where memories are stored.</p>
            </article>
            <article>
              <h3>2. Choose a folder</h3>
              <p>Select an existing OneDrive folder, or type a new folder name and apply it.</p>
            </article>
            <article>
              <h3>3. Save memories</h3>
              <p>Go to Album, choose a month, add a photo or video, title, note, place, and date, then save.</p>
            </article>
            <article>
              <h3>4. Open anywhere</h3>
              <p>Use the same Microsoft account on another device to load the same OneDrive folder.</p>
            </article>
          </div>
        </section>
      )}

      {editingPost && (
        <div className="modal-backdrop" role="presentation">
          <form className="edit-modal" onSubmit={handleUpdateMemory}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Edit post</p>
                <h2>Update memory</h2>
              </div>
            </div>

            <div className="field-stack">
              <label>
                <span>Title</span>
                <input
                  maxLength={64}
                  onChange={(event) => updateEditDraft({ title: event.target.value })}
                  value={editDraft.title}
                />
              </label>
              <label>
                <span>Note</span>
                <textarea
                  maxLength={320}
                  onChange={(event) => updateEditDraft({ body: event.target.value })}
                  rows={4}
                  value={editDraft.body}
                />
              </label>
              <div className="split-fields">
                <label>
                  <span>Place</span>
                  <input
                    maxLength={40}
                    onChange={(event) => updateEditDraft({ place: event.target.value })}
                    value={editDraft.place}
                  />
                </label>
                <label>
                  <span>Date</span>
                  <input
                    onChange={(event) => updateEditDraft({ date: event.target.value })}
                    type="date"
                    value={editDraft.date}
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={handleCancelEdit} type="button">
                Cancel
              </button>
              <button className="primary-button modal-save-button" disabled={isUpdatingPost} type="submit">
                {isUpdatingPost ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.length > 180 ? `${error.message.slice(0, 180)}...` : error.message
  }

  return 'Check your OneDrive connection and try again.'
}

function getDraftValidationMessage(draft: MemoryDraft) {
  const textValidationMessage = getMemoryTextValidationMessage(draft)

  if (textValidationMessage) {
    return textValidationMessage
  }

  if (!draft.image) {
    return 'Select a photo or video before saving.'
  }

  return ''
}

function getDraftMediaItems(draft: MemoryDraft) {
  if (draft.mediaItems.length > 0) {
    return draft.mediaItems
  }

  if (draft.imageFile) {
    return [
      {
        id: createMemoryId(),
        file: draft.imageFile,
        fileSize: draft.imageFile.size,
        name: draft.fileName,
        type: draft.mediaType,
        url: draft.image,
      } satisfies MemoryDraftMedia,
    ]
  }

  return []
}

function getMemoryTextValidationMessage(memory: Pick<MemoryPost, 'title' | 'body'>) {
  if (!memory.title.trim()) {
    return 'Add a title before saving.'
  }

  if (!memory.body.trim()) {
    return 'Add a note before saving.'
  }

  return ''
}

function showUserAlert(message: string, setStatus: (message: string) => void) {
  setStatus(message)
  window.alert(message)
}

function updateMemorySyncState(
  posts: MemoryPost[],
  id: string,
  nextState: Pick<MemoryPost, 'syncStatus' | 'syncError'>,
) {
  return posts.map((post) => (post.id === id ? { ...post, ...nextState } : post))
}

async function getWritableMonthPosts(
  monthKey: string,
  localPosts: MemoryPost[],
  loadMemories: (monthKey: string) => Promise<MemoryPost[] | null>,
) {
  const cloudPosts = await loadMemories(monthKey)

  if (!cloudPosts) {
    return localPosts
  }

  if (cloudPosts.length === 0 && localPosts.length > 0) {
    return localPosts
  }

  return mergeMemoryPosts(cloudPosts, localPosts)
}

function upsertMemoryPost(posts: MemoryPost[], nextPost: MemoryPost) {
  const existingIndex = posts.findIndex((post) => post.id === nextPost.id)

  if (existingIndex === -1) {
    return [nextPost, ...posts]
  }

  return posts.map((post) => (post.id === nextPost.id ? nextPost : post))
}

function mergeMemoryPosts(cloudPosts: MemoryPost[], localPosts: MemoryPost[]) {
  const localPostById = new Map(localPosts.map((post) => [post.id, post]))

  return cloudPosts.map((cloudPost) => {
    const localPost = localPostById.get(cloudPost.id)

    if (!localPost) {
      return cloudPost
    }

    return {
      ...cloudPost,
      image: localPost.image || cloudPost.image,
      syncStatus: localPost.syncStatus ?? cloudPost.syncStatus,
      syncError: localPost.syncError ?? cloudPost.syncError,
    }
  })
}

async function hydratePostMedia(
  post: MemoryPost,
  loadThumbnail: (itemId: string) => Promise<string>,
): Promise<MemoryPost> {
  if (post.mediaItems?.length) {
    const mediaItems = await Promise.all(
      post.mediaItems.map(async (media, index) => {
        if (!media.driveItemId || index >= 4) {
          return media
        }

        try {
          return {
            ...media,
            thumbnailUrl: await loadThumbnail(media.driveItemId),
          }
        } catch {
          return media
        }
      }),
    )

    return {
      ...post,
      mediaItems,
    }
  }

  if (!post.driveItemId) {
    return post
  }

  let thumbnailUrl: string | undefined

  try {
    thumbnailUrl = await loadThumbnail(post.driveItemId)
  } catch {
    thumbnailUrl = undefined
  }

  return {
    ...post,
    mediaItems: [
      {
        id: post.driveItemId,
        driveItemId: post.driveItemId,
        driveUrl: post.driveUrl,
        fileSize: post.fileSize,
        name: post.mediaName ?? post.imageName,
        thumbnailUrl,
        type: post.mediaType ?? 'image',
        url: post.image,
      },
    ],
  }
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

function getPostDriveItemIds(post: MemoryPost) {
  const itemIds = new Set<string>()

  if (post.driveItemId) {
    itemIds.add(post.driveItemId)
  }

  post.mediaItems?.forEach((media) => {
    if (media.driveItemId) {
      itemIds.add(media.driveItemId)
    }
  })

  return [...itemIds]
}

function getPostMediaCount(post: MemoryPost) {
  if (post.mediaItems?.length) {
    return post.mediaItems.length
  }

  return post.image ? 1 : 0
}

function createMemoryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20,
    )}-${hex.slice(20)}`
  }

  return `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

