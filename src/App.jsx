import { ControlPanel } from './components/ControlPanel'
import { StatusPill } from './components/StatusPill'
import { TrackingStage } from './components/TrackingStage'
import { useHandTracking } from './hooks/useHandTracking'
import './App.css'

function App() {
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    startCamera,
    stopCamera,
    tracking,
    webcamRef,
  } = useHandTracking()

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Webcam control</p>
          <h1>Hand Puck</h1>
        </div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>

      <section className="workspace" aria-label="Hand controlled object">
        <TrackingStage
          canvasRef={canvasRef}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          isLoading={isLoading}
          isRunning={isRunning}
          onStartCamera={startCamera}
          puckRef={puckRef}
          webcamRef={webcamRef}
        />

        <ControlPanel
          isLoading={isLoading}
          isRunning={isRunning}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
          tracking={tracking}
        />
      </section>
    </main>
  )
}

export default App
