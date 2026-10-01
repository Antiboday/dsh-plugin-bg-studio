/**
 * DSH theme bridge — flip the app's own light/dark preference the same way
 * the Settings dialog does: a settings/mutate RPC against the `ui-theme`
 * namespace. Verified against the live wire format (revision omitted is
 * accepted; the change applies immediately, including body attributes).
 */
export type ThemePreference = 'light' | 'dark'

export function setDshThemePreference(preference: ThemePreference): Promise<boolean> {
  const payload = {
    type: 'client-request',
    rpcId: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
    method: 'settings/mutate',
    payload: {
      args: {
        ns: 'ui-theme',
        ops: [{ op: 'set', path: ['preference'], value: preference }],
      },
    },
  }
  return fetch('api/settings/mutate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => res.ok)
    .catch(() => false)
}
