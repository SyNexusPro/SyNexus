/** After the fullscreen boot intro completes, callers can defer heavy UI until this is true. */
let complete = false;
const listeners = new Set<() => void>();

export function notifySynexusBootComplete(): void {
  complete = true;
  for (const l of listeners) l();
  listeners.clear();
}

export function subscribeSynexusBootComplete(cb: () => void): () => void {
  if (complete) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isSynexusBootComplete(): boolean {
  return complete;
}
