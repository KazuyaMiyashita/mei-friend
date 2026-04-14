interface FileStatusProps {
  schemaStatus: string | null
  fileName: string | null
  isDirty: boolean
}

export default function FileStatus({ schemaStatus, fileName, isDirty }: FileStatusProps) {
  return (
    <div className={`fileStatus${isDirty ? ' changed' : ''}`}>
      <span className="schemaStatus">{schemaStatus ?? '?'}</span>
      {isDirty && <span title="File has unsaved changes">*</span>}
      <span className="fileName">{fileName ?? ''}</span>
    </div>
  )
}
