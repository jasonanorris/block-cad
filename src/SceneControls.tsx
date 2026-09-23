import { useEffect, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import type { Mesh } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls, type TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import type { ObjectTransform } from './cadModel'

type SceneControlsProps = {
  selectedMeshRef: RefObject<Mesh | null>
  gizmoInteractionRef: RefObject<boolean>
  selectedObjectId: string | null
  toolMode: TransformControlsMode
  onTransformObject: (id: string, transform: ObjectTransform) => void
  onTransformStart: () => void
  onTransformEnd: () => void
}

export default function SceneControls({
  selectedMeshRef,
  gizmoInteractionRef,
  selectedObjectId,
  toolMode,
  onTransformObject,
  onTransformStart,
  onTransformEnd,
}: SceneControlsProps) {
  const { camera, gl, scene } = useThree()
  const transformRef = useRef<TransformControls | null>(null)
  const selectedIdRef = useRef(selectedObjectId)
  selectedIdRef.current = selectedObjectId

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    orbit.target.set(0, 8, 0)
    orbit.minDistance = 25
    orbit.maxDistance = 400
    orbit.update()

    const controls = new TransformControls(camera, gl.domElement)
    const helper = controls.getHelper()
    scene.add(helper)
    transformRef.current = controls
    let clearInteraction: number | undefined

    const onDraggingChanged = (event: { value: unknown }) => {
      orbit.enabled = event.value !== true
    }
    const onMouseDown = () => {
      window.clearTimeout(clearInteraction)
      gizmoInteractionRef.current = true
      onTransformStart()
    }
    const onMouseUp = () => {
      // A click follows pointer-up; keep the gizmo from counting as empty workspace.
      clearInteraction = window.setTimeout(() => { gizmoInteractionRef.current = false }, 0)
      onTransformEnd()
    }
    const onObjectChange = () => {
      const mesh = controls.object
      const id = selectedIdRef.current
      if (!mesh || !id) return
      onTransformObject(id, {
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
      })
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('mouseDown', onMouseDown)
    controls.addEventListener('mouseUp', onMouseUp)
    controls.addEventListener('objectChange', onObjectChange)

    return () => {
      window.clearTimeout(clearInteraction)
      gizmoInteractionRef.current = false
      controls.detach()
      scene.remove(helper)
      controls.dispose()
      orbit.dispose()
      transformRef.current = null
    }
  }, [camera, gl, scene, gizmoInteractionRef, onTransformObject, onTransformStart, onTransformEnd])

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    controls.setMode(toolMode)
    if (selectedObjectId && selectedMeshRef.current) {
      controls.attach(selectedMeshRef.current)
    } else {
      controls.detach()
    }
  }, [selectedObjectId, selectedMeshRef, toolMode])

  return null
}
