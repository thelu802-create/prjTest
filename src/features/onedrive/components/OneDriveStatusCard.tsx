import { useState } from 'react'
import { Check, CheckCircle2, FolderOpen, RefreshCw } from 'lucide-react'
import type { AccountInfo } from '@azure/msal-browser'

type OneDriveStatusCardProps = {
  account: AccountInfo | null
  folderName: string
  folderOptions: string[]
  isAuthReady: boolean
  isConfigured: boolean
  isLoadingFolders: boolean
  onFolderChange: (folderName: string) => void
  onRefreshFolders: () => void
  onSignIn: () => void
  onSignOut: () => void
  syncMessage: string
}

export function OneDriveStatusCard({
  account,
  folderName,
  folderOptions,
  isAuthReady,
  isConfigured,
  isLoadingFolders,
  onFolderChange,
  onRefreshFolders,
  onSignIn,
  onSignOut,
  syncMessage,
}: OneDriveStatusCardProps) {
  const [folderDraft, setFolderDraft] = useState(folderName)
  const handleSignOut = () => {
    const confirmed = window.confirm('Sign out from OneDrive on this device?')

    if (confirmed) {
      onSignOut()
    }
  }

  return (
    <section className="sync-card">
      <div className="sync-card-header">
        <div className="sync-icon">
          <CheckCircle2 size={20} />
        </div>
        <div>
          <h2>{account ? 'OneDrive connected' : 'Connect OneDrive'}</h2>
          <p>{syncMessage}</p>
        </div>
      </div>

      <div className="sync-card-body">
        <div className="settings-summary">
          <div>
            <span>Account</span>
            <strong>{account?.username ?? 'Not connected'}</strong>
          </div>
          <div>
            <span>Current folder</span>
            <strong>{folderName}</strong>
          </div>
        </div>

        <div className="folder-picker">
          <label htmlFor="onedrive-folder">
            <FolderOpen size={15} />
            <span>OneDrive folder</span>
          </label>
          <div className="folder-row">
            <input
              disabled={!account}
              id="onedrive-folder"
              onChange={(event) => setFolderDraft(event.target.value)}
              placeholder="Type or create a folder, e.g. Post"
              value={folderDraft}
            />
            <button
              aria-label="Refresh folder list"
              className="icon-button folder-refresh"
              disabled={!account || isLoadingFolders}
              onClick={onRefreshFolders}
              type="button"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="secondary-button folder-apply"
              disabled={!account || !folderDraft.trim()}
              onClick={() => onFolderChange(folderDraft)}
              type="button"
            >
              <Check size={15} />
              Apply
            </button>
          </div>
          {folderOptions.length > 0 && (
            <div className="folder-options" aria-label="OneDrive folders">
              {folderOptions.map((folder) => (
                <button
                  className={folder === folderName ? 'folder-chip active' : 'folder-chip'}
                  key={folder}
                  onClick={() => setFolderDraft(folder)}
                  type="button"
                >
                  {folder}
                </button>
              ))}
            </div>
          )}
        </div>

        {!account && (
          <div className="sync-actions">
            <button
              className="secondary-button"
              disabled={!isAuthReady || !isConfigured}
              onClick={onSignIn}
              type="button"
            >
              Connect
            </button>
          </div>
        )}

        {account && (
          <div className="danger-zone">
            <div>
              <span>Account session</span>
              <p>Use this only when switching Microsoft accounts on this device.</p>
            </div>
            <button className="danger-button" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </div>
        )}

        {!isConfigured && <p className="config-warning">Missing VITE_MS_CLIENT_ID in the env file.</p>}
      </div>
    </section>
  )
}
