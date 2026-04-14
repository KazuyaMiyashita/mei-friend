import { useApplication } from '../../../features/app/application/useApplication'
import '../workspace/WorkspacePanel.css'

export default function SettingsPanel() {
  const { settings, updateSettings } = useApplication()

  return (
    <section className="explorerPanel" aria-label="Settings">
      <div className="explorerTitle">SETTINGS</div>

      <div className="explorerSection">
        <div className="explorerSectionHeader">General</div>
        <div className="explorerSectionContent" style={{ padding: '8px 12px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: 'var(--color-fg)',
              fontSize: '13px',
            }}
          >
            <input
              type="checkbox"
              checked={settings.showSplash}
              onChange={(e) => updateSettings({ showSplash: e.target.checked })}
            />
            Always show splash screen
          </label>
        </div>
      </div>

      <div className="explorerSection">
        <div className="explorerSectionHeader">Local Persistence</div>
        <div className="explorerSectionContent" style={{ padding: '8px 12px' }}>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              color: 'var(--color-fg)',
              fontSize: '13px',
            }}
          >
            Workspace Storage Mode
            <select
              style={{
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-canvas)',
                color: 'var(--color-fg)',
              }}
              value={settings.workspaceStorageMode || 'null'}
              onChange={(e) => {
                const val = e.target.value
                updateSettings({
                  workspaceStorageMode: val === 'null' ? null : (val as 'browser' | 'local'),
                })
              }}
            >
              <option value="null">Ask every time</option>
              <option value="browser">Browser only</option>
              <option value="local">Save to device</option>
            </select>
          </label>
          {settings.workspaceStorageMode === 'local' && (
            <p
              style={{
                color: 'var(--color-warning, #d29922)',
                fontSize: '12px',
                marginTop: '8px',
                backgroundColor: 'var(--color-warning-bg, rgba(210, 153, 34, 0.1))',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--color-warning, #d29922)',
                lineHeight: '1.4',
              }}
            >
              ⚠️ This application will have full read and write access to the selected directory.
            </p>
          )}
        </div>
      </div>

      <div className="explorerSection">
        <div className="explorerSectionHeader">Keyboard Shortcuts</div>
        <div className="explorerSectionContent" style={{ padding: '8px 12px' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
            Shortcut customization is coming soon.
          </p>
        </div>
      </div>
    </section>
  )
}
