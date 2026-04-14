import { useDropzone } from 'react-dropzone'
import './WelcomeScreen.css'

interface WelcomeScreenProps {
  onFileDrop: (file: File) => void
}

export default function WelcomeScreen({ onFileDrop }: WelcomeScreenProps) {
  const { getRootProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files[0]) onFileDrop(files[0])
    },
    accept: { 'application/xml': ['.mei', '.xml', '.musicxml'] },
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className={`welcomeScreen${isDragActive ? ' fileDragging' : ''}`}>
      <div className="welcomeContent">
        <p className="welcomeHint">Drop files here</p>
        <p className="welcomeOr">or</p>
        <p className="welcomeMenu">Select a file from File → Open file</p>
      </div>
    </div>
  )
}
