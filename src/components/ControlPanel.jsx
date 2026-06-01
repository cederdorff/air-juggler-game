export function ControlPanel({ isLoading, isRunning, onStartCamera, onStopCamera, tracking }) {
  return (
    <aside className="control-panel">
      <Metric label="Hand" value={tracking.hand} />
      <Metric label="Gesture" value={tracking.gesture} />
      <Metric label="Confidence" value={formatPercent(tracking.confidence)} />
      <Metric label="Pinch" value={tracking.pinching ? "Active" : "Idle"} />

      <button
        type="button"
        className="camera-button"
        onClick={isRunning ? onStopCamera : onStartCamera}
        disabled={isLoading}
      >
        {getCameraButtonLabel(isRunning, isLoading)}
      </button>
    </aside>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCameraButtonLabel(isRunning, isLoading) {
  if (isRunning) {
    return "Stop camera";
  }

  if (isLoading) {
    return "Loading...";
  }

  return "Start camera";
}

function formatPercent(value) {
  const safeValue = Math.min(Math.max(value, 0), 1);

  return `${Math.round(safeValue * 100)}%`;
}
