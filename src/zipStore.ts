type ZipEntry = { name: string; data: string }

const encoder = new TextEncoder()
const crcTable = new Uint32Array(256)
for (let index = 0; index < 256; index++) {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  crcTable[index] = value >>> 0
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

// 3MF is an OPC ZIP package. Store its three small XML parts without compression.
export function zipStore(entries: ZipEntry[]): Uint8Array {
  const files = entries.map(({ name, data }) => {
    const filename = encoder.encode(name)
    const contents = encoder.encode(data)
    return { filename, contents, checksum: crc32(contents) }
  })
  const localSize = files.reduce((size, file) => size + 30 + file.filename.length + file.contents.length, 0)
  const directorySize = files.reduce((size, file) => size + 46 + file.filename.length, 0)
  if (files.length > 0xffff || localSize + directorySize + 22 > 0xffffffff) {
    throw new Error('The 3MF package is too large to export.')
  }
  const archive = new Uint8Array(localSize + directorySize + 22)
  const view = new DataView(archive.buffer)
  let offset = 0
  const localOffsets: number[] = []

  for (const file of files) {
    localOffsets.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint32(offset + 14, file.checksum, true)
    view.setUint32(offset + 18, file.contents.length, true)
    view.setUint32(offset + 22, file.contents.length, true)
    view.setUint16(offset + 26, file.filename.length, true)
    offset += 30
    archive.set(file.filename, offset)
    offset += file.filename.length
    archive.set(file.contents, offset)
    offset += file.contents.length
  }

  const directoryOffset = offset
  files.forEach((file, index) => {
    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint32(offset + 16, file.checksum, true)
    view.setUint32(offset + 20, file.contents.length, true)
    view.setUint32(offset + 24, file.contents.length, true)
    view.setUint16(offset + 28, file.filename.length, true)
    view.setUint32(offset + 42, localOffsets[index], true)
    offset += 46
    archive.set(file.filename, offset)
    offset += file.filename.length
  })

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 8, files.length, true)
  view.setUint16(offset + 10, files.length, true)
  view.setUint32(offset + 12, directorySize, true)
  view.setUint32(offset + 16, directoryOffset, true)
  return archive
}
