// @ts-nocheck
"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

interface PulseMarker {
  id: string
  location: [number, number]
  delay: number
  label?: string
}

interface GlobePulseProps {
  markers?: PulseMarker[]
  className?: string
  speed?: number
  baseColor?: [number, number, number]
  markerColor?: [number, number, number]
  glowColor?: [number, number, number]
  dark?: number
  mapBrightness?: number
  theta?: number
  pulseColor?: string
  onMarkerClick?: (markerId: string) => void
}

export function GlobePulse({
  markers = [],
  className = "",
  speed = 0.003,
  baseColor = [0.5, 0.5, 0.5],
  markerColor = [0.2, 0.8, 0.9],
  glowColor = [0.05, 0.05, 0.05],
  dark = 1,
  mapBrightness = 10,
  theta = 0.2,
  pulseColor = "#33ccdd",
  onMarkerClick,
}: GlobePulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const currentPhiRef = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (pointerDownPos.current && onMarkerClick && canvasRef.current) {
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const rect = canvasRef.current.getBoundingClientRect()
        const cx = rect.width / 2
        const cy = rect.height / 2
        const radius = rect.width / 2
        const nx = (e.clientX - rect.left - cx) / radius
        const ny = (e.clientY - rect.top - cy) / radius
        const currentPhi = currentPhiRef.current + phiOffsetRef.current + dragOffset.current.phi
        const currentTheta = theta + thetaOffsetRef.current + dragOffset.current.theta
        let bestDist = Infinity
        let bestId = ""
        for (const m of markers) {
          const [lat, lng] = m.location
          const mPhi = (90 - lat) * (Math.PI / 180)
          const mTheta = (lng + 180) * (Math.PI / 180)
          const rotatedTheta = mTheta - currentPhi
          const sx = Math.sin(mPhi) * Math.sin(rotatedTheta)
          const sy = -(Math.cos(mPhi) * Math.cos(currentTheta) - Math.sin(mPhi) * Math.cos(rotatedTheta) * Math.sin(currentTheta))
          const sz = Math.cos(mPhi) * Math.sin(currentTheta) + Math.sin(mPhi) * Math.cos(rotatedTheta) * Math.cos(currentTheta)
          if (sz < 0) continue
          const dist = Math.sqrt((sx - nx) ** 2 + (sy - ny) ** 2)
          if (dist < bestDist) { bestDist = dist; bestId = m.id }
        }
        if (bestId && bestDist < 0.25) onMarkerClick(bestId)
      }
    }
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    pointerDownPos.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [markers, onMarkerClick, theta])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width, height: width,
        phi: 0, theta, dark, diffuse: 1.5,
        mapSamples: 16000, mapBrightness,
        baseColor, markerColor, glowColor,
        markerElevation: 0,
        markers: markers.map((m) => ({ location: m.location, size: 0.04, id: m.id })),
        arcs: [], arcColor: [0.3, 0.85, 0.95],
        arcWidth: 0.5, arcHeight: 0.25, opacity: 0.7,
      })
      function animate() {
        if (!isPausedRef.current) phi += speed
        currentPhiRef.current = phi
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init() }
      })
      ro.observe(canvas)
    }
    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed, baseColor, markerColor, glowColor, dark, mapBrightness, theta])

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <style>{`
        @keyframes pulse-expand {
          0% { transform: scaleX(0.3) scaleY(0.3); opacity: 0.8; }
          100% { transform: scaleX(1.5) scaleY(1.5); opacity: 0; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%", height: "100%", cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none",
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            // @ts-expect-error CSS Anchor Positioning
            positionAnchor: `--cobe-${m.id}`,
            bottom: "anchor(center)",
            left: "anchor(center)",
            translate: "-50% 50%",
            width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            transition: "opacity 0.4s, filter 0.4s",
          }}
        >
          <span style={{
            position: "absolute", inset: 0,
            border: `2px solid ${pulseColor}`, borderRadius: "50%", opacity: 0,
            animation: `pulse-expand 2s ease-out infinite ${m.delay}s`,
          }} />
          <span style={{
            position: "absolute", inset: 0,
            border: `2px solid ${pulseColor}`, borderRadius: "50%", opacity: 0,
            animation: `pulse-expand 2s ease-out infinite ${m.delay + 0.5}s`,
          }} />
          <span style={{
            width: 10, height: 10, background: pulseColor, borderRadius: "50%",
            boxShadow: `0 0 0 3px #111, 0 0 0 5px ${pulseColor}`,
          }} />
        </div>
      ))}
    </div>
  )
}
