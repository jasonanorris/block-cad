import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { getSolidBodies, type CadObject, type SolidBody } from './cadModel'
import { buildSolidGeometry } from './booleanGeometry'
import { loadManifold } from './manifoldRuntime'
import { zipStore } from './zipStore'

type Point = { x: number; y: number; z: number }
type Part = { name: string; vertices: Point[]; triangles: [number, number, number][] }

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const relationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/>
</Relationships>`

function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
}

function objectMatrix(object: CadObject): Matrix4 {
  const { position, rotation, scale } = object
  return new Matrix4().compose(
    new Vector3(position.x, position.y, position.z),
    new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z)),
    new Vector3(scale.x, scale.y, scale.z),
  )
}

function buildPart(body: SolidBody, index: number, runtime: Awaited<ReturnType<typeof loadManifold>>): Part | null {
  const geometry = buildSolidGeometry(body, runtime)
  try {
    const position = geometry.getAttribute('position')
    const indices = geometry.getIndex()
    if (!position || !indices || indices.count === 0) return null
    const matrix = objectMatrix(body.anchor)
    const point = new Vector3()
    const vertices: Point[] = []
    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(matrix)
      if (![point.x, point.y, point.z].every(Number.isFinite)) {
        throw new Error('The model contains a nonfinite vertex and cannot be exported as 3MF.')
      }
      // The workspace is Y-up. 3MF is Z-up; this is a 90° X rotation.
      vertices.push({ x: point.x, y: -point.z, z: point.y })
    }
    const flipped = body.anchor.scale.x * body.anchor.scale.y * body.anchor.scale.z < 0
    const triangles: [number, number, number][] = []
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      const a = indices.getX(triangle)
      const b = indices.getX(triangle + 1)
      const c = indices.getX(triangle + 2)
      triangles.push(flipped ? [a, c, b] : [a, b, c])
    }
    return { name: body.anchor.name ?? `${body.anchor.type.toUpperCase()} ${index + 1}`, vertices, triangles }
  } finally {
    geometry.dispose()
  }
}

function modelXml(parts: Part[]): string {
  const minimum = { x: Infinity, y: Infinity, z: Infinity }
  for (const part of parts) for (const vertex of part.vertices) {
    minimum.x = Math.min(minimum.x, vertex.x)
    minimum.y = Math.min(minimum.y, vertex.y)
    minimum.z = Math.min(minimum.z, vertex.z)
  }
  const offset = {
    x: Math.max(0, -minimum.x),
    y: Math.max(0, -minimum.y),
    z: Math.max(0, -minimum.z),
  }
  const xml: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    '<metadata name="Application">Block CAD</metadata>',
    '<resources>',
  ]
  parts.forEach((part, index) => {
    xml.push(`<object id="${index + 1}" type="model" name="${escapeXml(part.name)}"><mesh><vertices>`)
    for (const vertex of part.vertices) {
      xml.push(`<vertex x="${vertex.x + offset.x}" y="${vertex.y + offset.y}" z="${vertex.z + offset.z}"/>`)
    }
    xml.push('</vertices><triangles>')
    for (const [a, b, c] of part.triangles) xml.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`)
    xml.push('</triangles></mesh></object>')
  })
  xml.push('</resources><build>')
  parts.forEach((_, index) => xml.push(`<item objectid="${index + 1}"/>`))
  xml.push('</build></model>')
  return xml.join('')
}

export async function export3mf(objects: CadObject[]): Promise<ArrayBuffer> {
  const bodies = getSolidBodies(objects)
  if (bodies.length === 0) throw new Error('Add a solid before exporting 3MF.')
  const runtime = await loadManifold()
  const parts = bodies.map((body, index) => buildPart(body, index, runtime)).filter((part): part is Part => !!part)
  if (parts.length === 0) throw new Error('The model has no printable solid geometry.')
  const archive = zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: relationships },
    { name: '3D/3dmodel.model', data: modelXml(parts) },
  ])
  return archive.buffer as ArrayBuffer
}
