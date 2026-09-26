import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { boxSelectedIds, screenRectangle, type ScreenRectangle } from './boxSelection'

export default function BoxSelection({ enabled, onSelect, onRectangle, onExit }: {
  enabled: boolean
  onSelect: (ids: string[], additive: boolean) => void
  onRectangle: (rectangle: ScreenRectangle | null) => void
  onExit: () => void
}) {
  const { camera, scene, gl } = useThree()
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    let drag: { x: number; y: number; pointerId: number; additive: boolean } | null = null
    const coordinates = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)), rect }
    }
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
    const cancel = () => {
      const pointerId = drag?.pointerId
      drag = null
      if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
      onRectangle(null)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return
      stop(event)
      const { x, y } = coordinates(event)
      drag = { x, y, pointerId: event.pointerId, additive: event.shiftKey }
      canvas.setPointerCapture(event.pointerId)
      onRectangle(screenRectangle(x, y, x, y))
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      stop(event)
      const { x, y } = coordinates(event)
      onRectangle(screenRectangle(drag.x, drag.y, x, y))
    }
    const up = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      stop(event)
      const { x, y, rect } = coordinates(event)
      if (Math.hypot(x - drag.x, y - drag.y) >= 3) {
        onSelect(boxSelectedIds(scene, camera, screenRectangle(drag.x, drag.y, x, y), rect.width, rect.height), drag.additive)
      }
      cancel()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable=true]')) return
      stop(event); cancel(); onExit()
    }
    canvas.addEventListener('pointerdown', down, true)
    canvas.addEventListener('pointermove', move, true)
    canvas.addEventListener('pointerup', up, true)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    canvas.addEventListener('click', stop, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', cancel)
    return () => {
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointermove', move, true)
      canvas.removeEventListener('pointerup', up, true)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
      canvas.removeEventListener('click', stop, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', cancel)
      cancel()
    }
  }, [enabled, camera, scene, gl, onSelect, onRectangle, onExit])
  return null
}
