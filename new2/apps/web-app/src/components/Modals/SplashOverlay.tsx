import { useState } from 'react'
import './Modals.css'
import logoUrl from '../../assets/menu-logo.svg'

interface SplashOverlayProps {
  onDismiss: (alwaysShow: boolean) => void
}

const VERSION = '1.2.12'

export default function SplashOverlay({ onDismiss }: SplashOverlayProps) {
  const [alwaysShow, setAlwaysShow] = useState(false)

  return (
    <div className="overlayBackdrop" id="splashOverlay">
      <div id="splash">
        <div id="splashHeader">
          <img src={logoUrl} alt="mei-friend" id="splashLogo" />
        </div>
        <hr className="dropdownLine" style={{ borderColor: 'rgba(255,255,255,0.4)' }} />
        <div id="splashBodyContainer">
          <div id="splashUpdateIndicator" />
          <div id="splashBody">
            <p>
              <strong>mei-friend</strong> is a &ldquo;last mile&rdquo; editor for MEI music
              encodings. It is intended to alleviate common tasks such as cleaning up encodings
              generated via optical music recognition or conversion from other formats.
            </p>
            <p>
              Open a file via <strong>File → Open file</strong>, or drag and drop a MEI file onto
              the application to get started.
            </p>
          </div>
        </div>
        <div id="splashFooter">
          <div id="splashVersion">
            Version:{' '}
            <a href={`https://github.com/mei-friend/mei-friend/releases/tag/v${VERSION}`}>
              {VERSION}
            </a>
          </div>
          <button type="button" id="splashConfirmButton" onClick={() => onDismiss(alwaysShow)}>
            OK
          </button>
          <span id="splashAlwaysShowCtrl">
            <input
              id="splashAlwaysShow"
              type="checkbox"
              checked={alwaysShow}
              onChange={(e) => setAlwaysShow(e.target.checked)}
              title="Always show this splash screen on application load"
            />
            <label
              htmlFor="splashAlwaysShow"
              title="Always show this splash screen on application load"
            >
              Always show
            </label>
          </span>
        </div>
      </div>
    </div>
  )
}
