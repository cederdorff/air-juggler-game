import { ControlPanel } from "./components/ControlPanel";
import { StatusPill } from "./components/StatusPill";
import { TrackingStage } from "./components/TrackingStage";
import { useHandTracking } from "./hooks/useHandTracking";
import "./App.css";

function App() {
  const {
    ballRef,
    canvasRef,
    game,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    resetGame,
    startCamera,
    stopCamera,
    tracking,
    webcamRef
  } = useHandTracking();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Webcam mini game</p>
          <h1>Air Juggler</h1>
        </div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>

      <section className="workspace" aria-label="Air juggler game area">
        <TrackingStage
          ballRef={ballRef}
          canvasRef={canvasRef}
          game={game}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          isLoading={isLoading}
          isRunning={isRunning}
          onStartCamera={startCamera}
          puckRef={puckRef}
          webcamRef={webcamRef}
        />

        <ControlPanel
          game={game}
          isLoading={isLoading}
          isRunning={isRunning}
          onResetGame={resetGame}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
          tracking={tracking}
        />
      </section>
    </main>
  );
}

export default App;
