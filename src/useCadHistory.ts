import { useCallback, useReducer } from 'react'
import type { CadObject } from './cadModel'

type SceneSnapshot = {
  objects: CadObject[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
}

type SceneChange = (scene: SceneSnapshot) => SceneSnapshot

export type CadHistoryState = {
  past: SceneSnapshot[]
  present: SceneSnapshot
  future: SceneSnapshot[]
  transactionStart: SceneSnapshot | null
}

export type CadHistoryAction =
  | { type: 'commit' | 'edit'; change: SceneChange }
  | { type: 'select'; id: string | null; additive: boolean }
  | { type: 'reset'; objects: CadObject[] }
  | { type: 'begin' | 'end' | 'undo' | 'redo' }

const HISTORY_LIMIT = 100

export function createInitialHistory(objects: CadObject[]): CadHistoryState {
  return {
    past: [],
    present: { objects, selectedObjectId: null, selectedObjectIds: [] },
    future: [],
    transactionStart: null,
  }
}

function sameObjects(a: SceneSnapshot, b: SceneSnapshot) {
  if (a.objects === b.objects) return true
  return JSON.stringify(a.objects) === JSON.stringify(b.objects)
}

function recordChange(state: CadHistoryState, before: SceneSnapshot, after: SceneSnapshot): CadHistoryState {
  if (sameObjects(before, after)) return { ...state, present: after, transactionStart: null }
  return {
    past: [...state.past, before].slice(-HISTORY_LIMIT),
    present: after,
    future: [],
    transactionStart: null,
  }
}

export function cadHistoryReducer(state: CadHistoryState, action: CadHistoryAction): CadHistoryState {
  switch (action.type) {
    case 'reset':
      return createInitialHistory(action.objects)
    case 'select': {
      if (!action.id) {
        return { ...state, present: { ...state.present, selectedObjectId: null, selectedObjectIds: [] } }
      }
      if (!action.additive) {
        return { ...state, present: { ...state.present, selectedObjectId: action.id, selectedObjectIds: [action.id] } }
      }
      const selectedObjectIds = state.present.selectedObjectIds.includes(action.id)
        ? state.present.selectedObjectIds.filter((id) => id !== action.id)
        : [...state.present.selectedObjectIds, action.id]
      return { ...state, present: {
        ...state.present,
        selectedObjectIds,
        selectedObjectId: selectedObjectIds.includes(action.id)
          ? action.id
          : selectedObjectIds.at(-1) ?? null,
      } }
    }
    case 'begin':
      return state.transactionStart ? state : { ...state, transactionStart: state.present }
    case 'edit': {
      const next = action.change(state.present)
      return state.transactionStart
        ? { ...state, present: next }
        : recordChange(state, state.present, next)
    }
    case 'commit': {
      const next = action.change(state.present)
      return recordChange(state, state.transactionStart ?? state.present, next)
    }
    case 'end':
      return state.transactionStart
        ? recordChange(state, state.transactionStart, state.present)
        : state
    case 'undo': {
      if (state.transactionStart && !sameObjects(state.transactionStart, state.present)) {
        return {
          ...state,
          present: state.transactionStart,
          future: [state.present, ...state.future],
          transactionStart: null,
        }
      }
      const previous = state.past.at(-1)
      if (!previous) return { ...state, transactionStart: null }
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        transactionStart: null,
      }
    }
    case 'redo': {
      if (state.transactionStart && !sameObjects(state.transactionStart, state.present)) return state
      const next = state.future[0]
      if (!next) return { ...state, transactionStart: null }
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: state.future.slice(1),
        transactionStart: null,
      }
    }
  }
}

export function useCadHistory(createObjects: () => CadObject[]) {
  const [state, dispatch] = useReducer(cadHistoryReducer, createObjects, (create) => createInitialHistory(create()))

  const commit = useCallback((change: SceneChange) => dispatch({ type: 'commit', change }), [])
  const editObjects = useCallback((update: (objects: CadObject[]) => CadObject[]) => {
    dispatch({ type: 'edit', change: (scene) => ({ ...scene, objects: update(scene.objects) }) })
  }, [])
  const select = useCallback((id: string | null, additive = false) => dispatch({ type: 'select', id, additive }), [])
  const begin = useCallback(() => dispatch({ type: 'begin' }), [])
  const end = useCallback(() => dispatch({ type: 'end' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback((objects: CadObject[]) => dispatch({ type: 'reset', objects }), [])

  return {
    scene: state.present,
    canUndo: state.past.length > 0 || !!(state.transactionStart && !sameObjects(state.transactionStart, state.present)),
    canRedo: state.future.length > 0 && !(state.transactionStart && !sameObjects(state.transactionStart, state.present)),
    commit,
    editObjects,
    select,
    begin,
    end,
    undo,
    redo,
    reset,
  }
}
