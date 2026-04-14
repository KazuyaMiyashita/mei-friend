import { useStatus } from '../../features/status/StatusProvider'
import './Footer.css'

const VERSION = '6.0.0-beta'
const VERSION_DATE = 'March 2026'
const VEROVIO_VERSION = '6.1.0'

export default function Footer() {
  const { statusText } = useStatus()

  return (
    <footer className="footer" id="meiFriendFooter">
      {/* Left: hosting info */}
      <div className="leftfoot" id="leftFooter">
        Hosted by{' '}
        <a href="https://iwk.mdw.ac.at" target="_blank" rel="noreferrer">
          IWK
        </a>{' '}
        at{' '}
        <a href="https://mdw.ac.at" target="_blank" rel="noreferrer">
          mdw
        </a>
        , with{' '}
        <svg
          className="heart"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="10"
          height="10"
          aria-label="love"
        >
          <path
            fillRule="evenodd"
            d="M7.655 14.916L8 14.25l.345.666a.752.752 0 01-.69 0zm0 0L8 14.25l.345.666.002-.001.006-.003.018-.01a7.643 7.643 0 00.31-.17 22.08 22.08 0 003.433-2.414C13.956 10.731 16 8.35 16 5.5 16 2.836 13.914 1 11.75 1 10.203 1 8.847 1.802 8 3.02 7.153 1.802 5.797 1 4.25 1 2.086 1 0 2.836 0 5.5c0 2.85 2.045 5.231 3.886 6.818a22.075 22.075 0 003.433 2.414 7.62 7.62 0 00.31.17l.018.01.006.003.002.001z"
          />
        </svg>{' '}
        from Vienna.{' '}
        <a href="https://iwk.mdw.ac.at/impressum" target="_blank" rel="noreferrer">
          Imprint
        </a>
        .
      </div>

      {/* Middle: status bar + progress bar */}
      <div className="middlefoot" id="middleFooter">
        <div className="progressBar" id="progressBar" style={{ width: '0%' }} />
        <div className="statusBar" id="statusBar">
          {statusText}
        </div>
      </div>

      {/* Right: version info */}
      <div className="rightfoot" id="rightFooter">
        <a href="https://github.com/mei-friend/mei-friend" target="_blank" rel="noreferrer">
          mei-friend {VERSION}
        </a>{' '}
        ({VERSION_DATE}).&nbsp;
        <a
          href={`https://github.com/rism-digital/verovio/releases/tag/version-${VEROVIO_VERSION}`}
          target="_blank"
          rel="noreferrer"
        >
          Verovio {VEROVIO_VERSION}
        </a>
        .
      </div>
    </footer>
  )
}
