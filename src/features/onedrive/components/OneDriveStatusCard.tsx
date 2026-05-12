import { CheckCircle2 } from 'lucide-react'
import type { AccountInfo } from '@azure/msal-browser'

type OneDriveStatusCardProps = {
  account: AccountInfo | null
  isAuthReady: boolean
  isConfigured: boolean
  onSignIn: () => void
  onSignOut: () => void
  syncMessage: string
}

export function OneDriveStatusCard({
  account,
  isAuthReady,
  isConfigured,
  onSignIn,
  onSignOut,
  syncMessage,
}: OneDriveStatusCardProps) {
  return (
    <section className="sync-card">
      <div className="sync-icon">
        <CheckCircle2 size={20} />
      </div>
      <div>
        <h2>{account ? 'OneDrive đã kết nối' : 'Kết nối OneDrive'}</h2>
        <p>{syncMessage}</p>
        {account && <p className="account-line">{account.username}</p>}
        <div className="sync-actions">
          {account ? (
            <button className="secondary-button" onClick={onSignOut} type="button">
              Đăng xuất
            </button>
          ) : (
            <button
              className="secondary-button"
              disabled={!isAuthReady || !isConfigured}
              onClick={onSignIn}
              type="button"
            >
              Đăng nhập OneDrive
            </button>
          )}
        </div>
        {!isConfigured && (
          <p className="config-warning">Thiếu VITE_MS_CLIENT_ID trong file .env.local.</p>
        )}
      </div>
    </section>
  )
}
