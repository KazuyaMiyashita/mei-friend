import { generateEmptyMEI, type ScoreConfig } from '@mei-friend/core'
import { useCallback, useState } from 'react'
import './Modals.css'

interface NewFileDialogProps {
  onCancel: () => void
  onCreate: (meiFriendId: string) => void
  openFileInManager: (xmlContent: string, fileName: string, isNewFile?: boolean) => Promise<string>
}

const KEY_OPTIONS = [
  { label: '7♭ (C♭ major / A♭ minor)', value: '7f' },
  { label: '6♭ (G♭ major / E♭ minor)', value: '6f' },
  { label: '5♭ (D♭ major / B♭ minor)', value: '5f' },
  { label: '4♭ (A♭ major / F minor)', value: '4f' },
  { label: '3♭ (E♭ major / C minor)', value: '3f' },
  { label: '2♭ (B♭ major / G minor)', value: '2f' },
  { label: '1♭ (F major / D minor)', value: '1f' },
  { label: '0 (C major / A minor)', value: '0' },
  { label: '1♯ (G major / E minor)', value: '1s' },
  { label: '2♯ (D major / B minor)', value: '2s' },
  { label: '3♯ (A major / F♯ minor)', value: '3s' },
  { label: '4♯ (E major / C♯ minor)', value: '4s' },
  { label: '5♯ (B major / G♯ minor)', value: '5s' },
  { label: '6♯ (F♯ major / D♯ minor)', value: '6s' },
  { label: '7♯ (C♯ major / A♯ minor)', value: '7s' },
]

export default function NewFileDialog({
  onCancel,
  onCreate,
  openFileInManager,
}: NewFileDialogProps) {
  const [title, setTitle] = useState('Untitled')
  const [tempo, setTempo] = useState('Allegro')
  const [ensemble, setEnsemble] = useState<ScoreConfig['ensemble']>('four-part-harmony')
  const [keySig, setKeySig] = useState('0')
  const [mode, setMode] = useState<'major' | 'minor'>('major')
  const [timeSig, setTimeSig] = useState('4/4')

  const handleCreate = useCallback(async () => {
    const [meterCount, meterUnit] = timeSig.split('/')
    const config: ScoreConfig = {
      title,
      tempo,
      ensemble,
      keySig,
      mode,
      meterCount,
      meterUnit,
    }

    const xml = generateEmptyMEI(config)
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mei`
    const id = await openFileInManager(xml, fileName, true)
    onCreate(id)
  }, [title, tempo, ensemble, keySig, mode, timeSig, openFileInManager, onCreate])

  return (
    <div className="overlayBackdrop">
      <div className="dialog">
        <h2>New Score</h2>
        <div className="dialogForm">
          <div className="formGroup">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="tempo">Tempo</label>
            <input
              id="tempo"
              type="text"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="ensemble">Ensemble</label>
            <select
              id="ensemble"
              value={ensemble}
              onChange={(e) => setEnsemble(e.target.value as ScoreConfig['ensemble'])}
            >
              <option value="four-part-harmony">Four-part harmony (SATB)</option>
            </select>
          </div>

          <div className="formRow">
            <div className="formGroup">
              <label htmlFor="keySig">Key Signature</label>
              <select id="keySig" value={keySig} onChange={(e) => setKeySig(e.target.value)}>
                {KEY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="formGroup">
              <label htmlFor="mode">Mode</label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'major' | 'minor')}
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          </div>

          <div className="formGroup">
            <label htmlFor="timeSig">Time Signature</label>
            <select id="timeSig" value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
            </select>
          </div>
        </div>

        <div className="dialogActions">
          <button type="button" className="buttonSecondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="buttonPrimary" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
