import type { ChangeEvent, FormEvent } from 'react'
import { ImagePlus, Plus, UploadCloud } from 'lucide-react'
import type { MemoryDraft } from '../../../shared/types/memory'

type MemoryComposerProps = {
  canSave: boolean
  draft: MemoryDraft
  isSaving: boolean
  uploadProgress: number | null
  onChange: (draft: Partial<MemoryDraft>) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function MemoryComposer({
  canSave,
  draft,
  isSaving,
  uploadProgress,
  onChange,
  onImageChange,
  onSubmit,
}: MemoryComposerProps) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">New post</p>
          <h2>Add memory</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      <label className={`upload-zone ${draft.image ? 'has-image' : ''}`}>
        {draft.image && draft.mediaType === 'video' ? (
          <video controls src={draft.image} />
        ) : draft.image ? (
          <img src={draft.image} alt="Selected upload" />
        ) : (
          <span>
            <ImagePlus size={32} />
            <strong>Select a photo or video</strong>
            <small>Videos are uploaded in chunks for reliability</small>
          </span>
        )}
        <input accept="image/*,video/*" type="file" onChange={onImageChange} />
      </label>

      {draft.fileName && <p className="file-name">{draft.fileName}</p>}
      {uploadProgress !== null && (
        <div className="upload-progress" aria-label="Upload progress">
          <div style={{ width: `${uploadProgress}%` }} />
          <span>{uploadProgress}%</span>
        </div>
      )}

      <div className="field-stack">
        <label>
          <span>Title</span>
          <input
            maxLength={64}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Example: First beach trip of the year"
            value={draft.title}
          />
        </label>
        <label>
          <span>Note</span>
          <textarea
            maxLength={320}
            onChange={(event) => onChange({ body: event.target.value })}
            placeholder="Write a short note, story, or detail you want to remember..."
            rows={4}
            value={draft.body}
          />
        </label>
        <div className="split-fields">
          <label>
            <span>Place</span>
            <input
              maxLength={40}
              onChange={(event) => onChange({ place: event.target.value })}
              placeholder="Hoi An"
              value={draft.place}
            />
          </label>
          <label>
            <span>Date</span>
            <input
              onChange={(event) => onChange({ date: event.target.value })}
              type="date"
              value={draft.date}
            />
          </label>
        </div>
      </div>

      {!canSave && <p className="composer-warning">Connect OneDrive in Settings before saving.</p>}

      <button className="primary-button" disabled={isSaving || !canSave} type="submit">
        {isSaving ? <UploadCloud size={18} /> : <Plus size={18} />}
        {isSaving ? 'Saving...' : 'Save memory'}
      </button>
    </form>
  )
}
