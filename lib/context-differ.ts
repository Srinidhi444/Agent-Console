export type DiffChangeKind = 'added' | 'removed' | 'changed'

export interface DiffChange {
  path: string
  kind: DiffChangeKind
  oldValue: unknown
  newValue: unknown
}

export function diffObjects(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  path = ''
): DiffChange[] {
  const changes: DiffChange[] = []
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key
    const prevVal = prev[key]
    const nextVal = next[key]

    if (!(key in prev)) {
      changes.push({
        path: fullPath,
        kind: 'added',
        oldValue: undefined,
        newValue: nextVal,
      })
      continue
    }

    if (!(key in next)) {
      changes.push({
        path: fullPath,
        kind: 'removed',
        oldValue: prevVal,
        newValue: undefined,
      })
      continue
    }

    if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
      changes.push(
        ...diffObjects(
          prevVal as Record<string, unknown>,
          nextVal as Record<string, unknown>,
          fullPath
        )
      )
      continue
    }

    if (!deepEqual(prevVal, nextVal)) {
      changes.push({
        path: fullPath,
        kind: 'changed',
        oldValue: prevVal,
        newValue: nextVal,
      })
    }
  }

  return changes
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)

    if (aKeys.length !== bKeys.length) return false

    for (const key of aKeys) {
      if (!(key in b)) return false
      if (!deepEqual(a[key], b[key])) return false
    }

    return true
  }

  return false
}