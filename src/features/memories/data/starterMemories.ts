import type { MemoryPost } from '../../../shared/types/memory'

export const starterMemories: MemoryPost[] = [
  {
    id: 'starter-1',
    title: 'Một buổi chiều rất nhẹ',
    body: 'Lưu lại khoảnh khắc nhỏ, ánh sáng đẹp và một câu chuyện muốn nhớ lâu hơn một chút.',
    place: 'Đà Nẵng',
    date: '2026-05-12',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82',
    createdAt: new Date('2026-05-12T10:30:00').toISOString(),
  },
  {
    id: 'starter-2',
    title: 'Cà phê sau cơn mưa',
    body: 'Một góc bàn nhỏ, vài dòng ghi chú và cảm giác mọi thứ đang chậm lại đúng lúc.',
    place: 'Hội An',
    date: '2026-04-28',
    image:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=82',
    createdAt: new Date('2026-04-28T09:20:00').toISOString(),
  },
]
