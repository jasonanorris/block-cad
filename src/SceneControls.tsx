import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Matrix4, Mesh, OrthographicCamera, type PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls, type TransformControlsMode } from 'three/addons/controls/TransformControls.js'
import type { ObjectTransform } from './cadModel'
import { frameCamera, type FrameRequest } from './frameCamera'

export type CameraView = 'perspective' | 'top' | 'front' | 'right' | 'bottom' | 'back' | 'left'

type SceneControlsProps = {
  selectedMeshRef: RefObject<Mesh | null>
  gizmoInteractionRef: RefObject<boolean>
  selectedObjectId: string | null
  toolMode: TransformControlsMode
  snapEnabled: boolean
  gridSize: number
  cameraView: CameraView
  frameRequest: FrameRequest | null
  frameSelectionIds: Set<string>
  onCameraOrientation: (transform: string) => void
  onTransformObject: (id: string, transform: ObjectTransform) => void
  onTransformStart: () => void
  onTransformEnd: () => void
}

export default function SceneControls({
  selectedMeshRef,
  gizmoInteractionRef,
  selectedObjectId,
  toolMode,
  snapEnabled,
  gridSize,
  cameraView,
  frameRequest,
  frameSelectionIds,
  onCameraOrientation,
  onTransformObject,
  onTransformStart,
  onTransformEnd,
}: SceneControlsProps) {
  const { camera, gl, scene, size, get, set } = useThree()
  const perspectiveCamera = useRef(camera as PerspectiveCamera)
  const orthographicCamera = useMemo(() => new OrthographicCamera(-120, 120, 60, -60, 0.1, 1000), [])
  const orbitRef = useRef<OrbitControls | null>(null)
  const transformRef = useRef<TransformControls | null>(null)
  const selectedIdRef = useRef(selectedObjectId)
  const lastFrameRequest = useRef<FrameRequest | null>(null)
  selectedIdRef.current = selectedObjectId

  const updateViewCube = useMemo(() => {
    const rotation = new Matrix4()
    return (activeCamera: PerspectiveCamera | OrthographicCamera) => {
      rotation.makeRotationFromQuaternion(activeCamera.quaternion).invert()
      const signs = [1, -1, 1, 1]
      const values = rotation.elements.map((value, index) => value * signs[index % 4] * signs[Math.floor(index / 4)])
      onCameraOrientation(`matrix3d(${values.join(',')})`)
    }
  }, [onCameraOrientation])

  useEffect(() => {
    if (size.height === 0) return
    const halfHeight = 60
    const halfWidth = halfHeight * size.width / size.height
    orthographicCamera.left = -halfWidth
    orthographicCamera.right = halfWidth
    orthographicCamera.top = halfHeight
    orthographicCamera.bottom = -halfHeight
    orthographicCamera.updateProjectionMatrix()
  }, [orthographicCamera, size.width, size.height])

  useEffect(() => {
    const nextCamera = cameraView === 'perspective' ? perspectiveCamera.current : orthographicCamera
    const target = [0, 8, 0] as const
    const positions: Record<CameraView, readonly [number, number, number]> = {
      perspective: [65, 50, 65],
      top: [0, 158, 0],
      front: [0, 8, 150],
      right: [150, 8, 0],
      bottom: [0, -142, 0],
      back: [0, 8, -150],
      left: [-150, 8, 0],
    }
    nextCamera.position.set(...positions[cameraView])
    nextCamera.zoom = 1
    nextCamera.near = 0.1
    nextCamera.far = 1000
    nextCamera.up.set(0, cameraView === 'top' || cameraView === 'bottom' ? 0 : 1, cameraView === 'top' ? -1 : cameraView === 'bottom' ? 1 : 0)
    nextCamera.lookAt(...target)
    nextCamera.updateProjectionMatrix()

    if (get().camera !== nextCamera) set({ camera: nextCamera })
    if (orbitRef.current?.object === nextCamera) {
      orbitRef.current.target.set(...target)
      orbitRef.current.enableRotate = cameraView === 'perspective'
      orbitRef.current.update()
    }
    updateViewCube(nextCamera)
  }, [cameraView, get, orthographicCamera, set, updateViewCube])

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    orbitRef.current = orbit
    orbit.target.set(0, 8, 0)
    orbit.minDistance = 25
    orbit.maxDistance = 400
    orbit.minZoom = 0.25
    orbit.maxZoom = 8
    orbit.enableRotate = camera === perspectiveCamera.current
    orbit.addEventListener('change', () => updateViewCube(camera))
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
      orbitRef.current = null
      transformRef.current = null
    }
  }, [camera, gl, scene, gizmoInteractionRef, onTransformObject, onTransformStart, onTransformEnd, updateViewCube])

  useEffect(() => {
    if (!frameRequest || lastFrameRequest.current === frameRequest) return
    lastFrameRequest.current = frameRequest
    const orbit = orbitRef.current
    if (!orbit || gizmoInteractionRef.current) return
    const bounds = new Box3()
    const meshBounds = new Box3()
    scene.updateMatrixWorld(true)
    scene.traverseVisible((object) => {
      if (!(object instanceof Mesh) || typeof object.userData.cadObjectId !== 'string') return
      if (frameRequest.scope === 'selection' && !frameSelectionIds.has(object.userData.cadObjectId)) return
      object.geometry.computeBoundingBox()
      if (object.geometry.boundingBox) {
        meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld)
        bounds.union(meshBounds)
      }
    })
    const target = frameCamera(camera as PerspectiveCamera | OrthographicCamera, bounds)
    if (!target) return
    orbit.target.copy(target)
    const distance = camera.position.distanceTo(target)
    orbit.minDistance = Math.min(25, distance / 100)
    orbit.maxDistance = Math.max(400, distance * 10)
    orbit.minZoom = Math.min(0.25, camera.zoom / 100)
    orbit.maxZoom = Math.max(8, camera.zoom * 100)
    orbit.update()
  }, [camera, scene, frameRequest, frameSelectionIds, gizmoInteractionRef])

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    controls.setMode(toolMode)
    if (selectedObjectId && selectedMeshRef.current) {
      controls.attach(selectedMeshRef.current)
    } else {
      controls.detach()
    }
  }, [camera, selectedObjectId, selectedMeshRef, toolMode])

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    controls.setTranslationSnap(snapEnabled ? gridSize : null)
    controls.setRotationSnap(snapEnabled ? Math.PI / 12 : null)
  }, [camera, snapEnabled, gridSize])

  return null
}
