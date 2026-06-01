import { useEffect, useRef, useState } from 'react'
import {
  READY_STATUS,
  clearCanvas,
  createHandLandmarker,
  drawHand,
  resizeCanvasToVideo,
} from '../handTracking'
import { getHandGesture, movePuckWithGesture } from '../gestures'

export function useHandTracking() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const puckRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  const [isRunning, setIsRunning] = useState(false)
  const [tracking, setTracking] = useState(READY_STATUS)

  function stopCamera() {
    cancelAnimationFrame(animationRef.current)

    animationRef.current = 0
    lastVideoTimeRef.current = -1

    clearCanvas(canvasRef.current)
    showSearchingPuck(puckRef.current)
    setIsRunning(false)
    setTracking(READY_STATUS)
  }

  function runFrameLoop() {
    const video = webcamRef.current?.video
    const canvas = canvasRef.current
    const puck = puckRef.current
    const handLandmarker = handLandmarkerRef.current

    if (!video || !canvas || !puck || !handLandmarker) {
      return
    }

    resizeCanvasToVideo(canvas, video)

    if (hasNewVideoFrame(video, lastVideoTimeRef.current)) {
      lastVideoTimeRef.current = video.currentTime
      const results = handLandmarker.detectForVideo(video, performance.now())
      const landmarks = results.landmarks?.[0]

      if (landmarks) {
        drawHand(canvas, landmarks)
        const gesture = getHandGesture(landmarks)

        movePuckWithGesture(gesture, puck)
        setTracking(createTrackingStatus(results, gesture))
      } else {
        clearCanvas(canvas)
        showSearchingPuck(puck)
        setTracking(createSearchingStatus())
      }
    }

    animationRef.current = requestAnimationFrame(runFrameLoop)
  }

  async function startCamera() {
    if (isRunning || tracking.mode === 'loading') {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setTracking(createErrorStatus('Camera unavailable'))
      return
    }

    setTracking({
      ...READY_STATUS,
      mode: 'loading',
      label: 'Loading model',
    })

    try {
      if (!handLandmarkerRef.current) {
        handLandmarkerRef.current = await createHandLandmarker()
      }

      setIsRunning(true)
      setTracking(createSearchingStatus())
    } catch (error) {
      console.error(error)
      stopCamera()
      setTracking(createErrorStatus(getCameraErrorLabel(error)))
    }
  }

  function handleCameraReady() {
    cancelAnimationFrame(animationRef.current)
    runFrameLoop()
  }

  function handleCameraError(error) {
    console.error(error)
    stopCamera()
    setTracking(createErrorStatus(getCameraErrorLabel(error)))
  }

  useEffect(() => {
    showSearchingPuck(puckRef.current)

    return () => {
      cancelAnimationFrame(animationRef.current)
      handLandmarkerRef.current?.close()
    }
  }, [])

  return {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading: tracking.mode === 'loading',
    isRunning,
    puckRef,
    startCamera,
    stopCamera,
    tracking,
    webcamRef,
  }
}

function hasNewVideoFrame(video, lastVideoTime) {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.currentTime !== lastVideoTime
  )
}

function showSearchingPuck(puck) {
  puck?.setAttribute('data-searching', 'true')
  puck?.removeAttribute('data-gripped')
}

function createSearchingStatus() {
  return {
    ...READY_STATUS,
    mode: 'searching',
    label: 'Looking for hand',
  }
}

function createTrackingStatus(results, gesture) {
  const hand = results.handednesses?.[0]?.[0]

  return {
    mode: 'tracking',
    label: gesture.isPinching ? 'Pinch active' : gesture.name,
    hand: hand?.categoryName ?? 'Hand',
    confidence: hand?.score ?? gesture.grip,
    gesture: gesture.name,
    pinching: gesture.isPinching,
  }
}

function createErrorStatus(label) {
  return {
    ...READY_STATUS,
    mode: 'error',
    label,
  }
}

function getCameraErrorLabel(error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera blocked'
  }

  return 'Tracking failed'
}
