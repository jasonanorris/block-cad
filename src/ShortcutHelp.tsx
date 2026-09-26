import { useEffect, useRef } from 'react'

const groups = [
  { title: 'Selection and view', rows: [
    ['Select one shape', 'Click'], ['Add or remove a shape', 'Shift + click'],
    ['Add with Box select', 'Shift + drag'], ['Clear selection / leave Box select', 'Escape'],
    ['Frame selection', 'F'], ['Orbit in Perspective', 'Left drag'],
    ['Pan', 'Right drag'], ['Zoom', 'Scroll'],
  ] },
  { title: 'Editing', rows: [
    ['Undo', 'Ctrl/Cmd + Z'], ['Redo', 'Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y'],
    ['Copy selection and assemblies', 'Ctrl/Cmd + C'], ['Paste', 'Ctrl/Cmd + V'],
    ['Duplicate selection', 'Ctrl/Cmd + D'], ['Delete selection', 'Delete or Backspace'],
  ] },
  { title: 'Movement', rows: [
    ['Nudge −X / +X', 'Left / Right arrow'], ['Nudge −Z / +Z', 'Up / Down arrow'],
    ['Nudge +Y / −Y', 'Page Up / Page Down'], ['Nudge ten grid spaces', 'Shift + nudge key'],
  ] },
]

export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return <dialog ref={dialog} className="export-review shortcut-help" aria-labelledby="shortcut-help-title"
    onCancel={onClose} onKeyDown={(event) => event.stopPropagation()}>
    <h2 id="shortcut-help-title">Keyboard and mouse shortcuts</h2>
    <p>Open this guide with <kbd>?</kbd>. Close with <kbd>Escape</kbd>.</p>
    {groups.map((group) => <section key={group.title}>
      <h3>{group.title}</h3>
      <table><tbody>{group.rows.map(([action, shortcut]) => <tr key={action}>
        <th scope="row">{action}</th><td><kbd>{shortcut}</kbd></td>
      </tr>)}</tbody></table>
    </section>)}
    <p>Nudges move 1 mm with Snap off, or one grid space with Snap on. Holding a nudge key is one Undo step. Object snap applies only to Move-handle drags.</p>
    <p>Modeling shortcuts pause while typing in a field or while a dialog is open. Locked shapes must be unlocked before editing.</p>
    <div className="export-review-actions"><button type="button" autoFocus onClick={onClose}>Close shortcuts</button></div>
  </dialog>
}
