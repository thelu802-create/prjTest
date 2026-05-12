import type { ChangeEvent, FormEvent } from 'react'
import { ImagePlus, Plus, UploadCloud } from 'lucide-react'
import type { MemoryDraft } from '../../../shared/types/memory'

type MemoryComposerProps = {
  draft: MemoryDraft
  isSaving: boolean
  onChange: (draft: Partial<MemoryDraft>) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function MemoryComposer({
  draft,
  isSaving,
  onChange,
  onImageChange,
  onSubmit,
}: MemoryComposerProps) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Đăng bài</p>
          <h2>Khoảnh khắc mới</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      <label className={`upload-zone ${draft.image ? 'has-image' : ''}`}>
        {draft.image ? (
          <img src={draft.image} alt="Ảnh đang chọn" />
        ) : (
          <span>
            <ImagePlus size={32} />
            <strong>Chọn ảnh kỷ niệm</strong>
            <small>Nhấn để upload từ thiết bị</small>
          </span>
        )}
        <input accept="image/*" type="file" onChange={onImageChange} />
      </label>

      {draft.fileName && <p className="file-name">{draft.fileName}</p>}

      <div className="field-stack">
        <label>
          <span>Tiêu đề</span>
          <input
            maxLength={64}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Ví dụ: Chuyến đi biển đầu năm"
            value={draft.title}
          />
        </label>
        <label>
          <span>Nội dung</span>
          <textarea
            maxLength={320}
            onChange={(event) => onChange({ body: event.target.value })}
            placeholder="Ghi lại cảm xúc, câu chuyện hoặc một chi tiết nhỏ..."
            rows={4}
            value={draft.body}
          />
        </label>
        <div className="split-fields">
          <label>
            <span>Địa điểm</span>
            <input
              maxLength={40}
              onChange={(event) => onChange({ place: event.target.value })}
              placeholder="Hội An"
              value={draft.place}
            />
          </label>
          <label>
            <span>Ngày</span>
            <input
              onChange={(event) => onChange({ date: event.target.value })}
              type="date"
              value={draft.date}
            />
          </label>
        </div>
      </div>

      <button className="primary-button" disabled={isSaving} type="submit">
        {isSaving ? <UploadCloud size={18} /> : <Plus size={18} />}
        {isSaving ? 'Đang lưu...' : 'Lưu kỷ niệm'}
      </button>
    </form>
  )
}
