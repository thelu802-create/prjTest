# Memory Cloud

Mobile-first web app để đăng kỷ niệm gồm hình ảnh, tiêu đề, nội dung, địa điểm và ngày.

## Chạy local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Cấu trúc source

```text
src/
  app/                         # App composition, layout shell, CSS cấp app
    App.tsx
    App.css
  features/
    memories/                  # Domain lưu kỷ niệm
      components/              # UI riêng của memories
      data/                    # dữ liệu mẫu
      hooks/                   # state/use-case của memories
      services/                # lưu local, sau này thay bằng API/database
    onedrive/                  # Domain Microsoft OneDrive
      components/              # UI trạng thái login/sync
      hooks/                   # state auth/upload cho UI dùng
      services/                # MSAL + Microsoft Graph client
  shared/
    types/                     # type dùng chung
    utils/                     # helper thuần, không phụ thuộc UI
  main.tsx                     # React entry
  index.css                    # global CSS/reset
```

Quy ước phát triển:

- UI thuộc tính năng nào thì đặt trong `features/<feature>/components`.
- Logic state/use-case đặt trong `features/<feature>/hooks`.
- Gọi API, localStorage, Graph, backend đặt trong `features/<feature>/services`.
- Type dùng nhiều nơi đặt trong `shared/types`.
- Helper thuần như format ngày, đọc file đặt trong `shared/utils`.
- `app/App.tsx` chỉ ghép các feature lại, hạn chế nhét logic nghiệp vụ vào đây.

## Deploy GitHub Pages

Repo đã có workflow tại `.github/workflows/deploy-pages.yml`.

Trong GitHub repo, vào `Settings > Pages`, chọn `Build and deployment` là `GitHub Actions`. Mỗi lần push lên branch `main`, GitHub Actions sẽ build Vite và publish thư mục `dist`.

## OneDrive login/upload

App đã có login OneDrive bằng Microsoft OAuth trên browser và upload ảnh vào thư mục `MemoryCloud` trong OneDrive.

Tạo file `.env.local`:

```bash
VITE_MS_CLIENT_ID=your-microsoft-entra-app-client-id
VITE_MS_AUTHORITY=https://login.microsoftonline.com/consumers
```

Trong Microsoft Entra ID, app registration cần:

- Platform type: Single-page application
- Redirect URI local: `http://localhost:5173/`
- Redirect URI GitHub Pages: URL GitHub Pages của repo sau khi deploy
- API permissions delegated: `User.Read`, `Files.ReadWrite`

Với OneDrive cá nhân, dùng authority `/consumers`. Nếu app registration chọn loại tài khoản rộng hơn, có thể đổi authority sang `/common`.

Sau khi đổi `.env.local`, chạy lại dev server:

```bash
npm run dev
```

Post vẫn lưu metadata bằng `localStorage` để demo trước. Ảnh sẽ upload thật lên OneDrive khi đã đăng nhập.
