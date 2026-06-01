export function StatusPill({ mode, label }) {
  return (
    <div className={`status-pill is-${mode}`} aria-live="polite">
      <span aria-hidden="true"></span>
      {label}
    </div>
  )
}
