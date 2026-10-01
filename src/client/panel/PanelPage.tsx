/**
 * Background Studio settings panel — the center-column page mounted through
 * the layout's `main` slot. Every control drives the runtime, which paints
 * instantly and persists debounced; nothing here talks to the host itself.
 */
import { useCallback, useId, useRef, useSyncExternalStore } from 'react'
import type { BgStudioRuntime } from '../runtime.ts'
import { imageUrl } from '../api.ts'
import { en, zh, type LocaleKey } from '../locales.ts'
// Plain text at build time; injected once as a <style> below.
import panelCss from './panel.css'

/** Panel copy follows the browser language (zh for Chinese, en otherwise). */
const tt = (key: LocaleKey): string =>
  navigator.language?.toLowerCase().startsWith('zh') ? zh[key] : en[key]

let styleInjected = false
function ensurePanelStyle(): void {
  if (styleInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.id = 'dsh-bg-studio-panel-style'
  style.textContent = panelCss
  document.head.append(style)
  styleInjected = true
}

function Field({ label, value, min, max, step, onChange, format }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}): React.ReactElement {
  const id = useId()
  return (
    <div className="bg-studio-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="bg-studio-value">{format ? format(value) : String(Math.round(value * 100) / 100)}</span>
    </div>
  )
}

const MODES: Array<{ kind: 'none' | 'image' | 'transparent' | 'frosted' | 'animated'; nameKey: LocaleKey; hintKey: LocaleKey }> = [
  { kind: 'none', nameKey: 'mode.none', hintKey: 'mode.none.hint' },
  { kind: 'image', nameKey: 'mode.image', hintKey: 'mode.image.hint' },
  { kind: 'transparent', nameKey: 'mode.transparent', hintKey: 'mode.transparent.hint' },
  { kind: 'frosted', nameKey: 'mode.frosted', hintKey: 'mode.frosted.hint' },
  { kind: 'animated', nameKey: 'mode.animated', hintKey: 'mode.animated.hint' },
]

export function PanelPage({ runtime }: { runtime: BgStudioRuntime }): React.ReactElement {
  ensurePanelStyle()
  const subscribe = useCallback((listener: () => void) => runtime.subscribe(listener), [runtime])
  const snapshot = useCallback(() => `${runtime.library.length}:${runtime.materialSupport}:${JSON.stringify(runtime.current)}`, [runtime])
  useSyncExternalStore(subscribe, snapshot)

  const settings = runtime.current
  const fileRef = useRef<HTMLInputElement>(null)

  if (!settings) {
    return (
      <div className="bg-studio-view" data-dsh-plugin="bg-studio">
        <div className="bg-studio-inner">
          <div className="bg-studio-header">
            <h2>{tt('panel.title')}</h2>
            <p>{tt('action.offline')}</p>
          </div>
        </div>
      </div>
    )
  }

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await runtime.addImage(file)
  }

  const pickImage = (id: string): void => {
    if (settings.kind === 'frosted') runtime.update({ frosted: { ...settings.frosted, imageId: id } })
    else runtime.update({ image: { ...settings.image, imageId: id } })
  }

  const removeLibraryImage = (id: string): void => {
    if (window.confirm(`${tt('library.delete')}?`)) void runtime.removeImage(id)
  }

  const imageSelId = settings.kind === 'frosted' ? settings.frosted.imageId : settings.image.imageId

  return (
    <div className="bg-studio-view" data-dsh-plugin="bg-studio">
      <div className="bg-studio-inner">
      <div className="bg-studio-header">
        <h2>{tt('panel.title')}</h2>
        <p>{tt('panel.subtitle')}</p>
      </div>

      <div className="bg-studio-modes">
        {MODES.map((mode) => {
          const disabled = mode.kind === 'animated'
          const active = !disabled && settings.kind === mode.kind
          return (
            <button
              key={mode.kind}
              type="button"
              className="bg-studio-mode"
              data-active={active}
              data-disabled={disabled}
              onClick={() => { if (!disabled) runtime.update({ kind: mode.kind }) }}
            >
              <span className="bg-studio-mode-name">{tt(mode.nameKey)}</span>
              <span className="bg-studio-mode-hint">{tt(mode.hintKey)}</span>
            </button>
          )
        })}
      </div>

      {settings.kind === 'image' && (
        <div className="bg-studio-section">
          <Field
            label={tt('image.opacity')}
            value={settings.image.opacity}
            min={0} max={1} step={0.05}
            onChange={(v) => runtime.update({ image: { ...settings.image, opacity: v } })}
          />
          <Field
            label={tt('image.blur')}
            value={settings.image.blur}
            min={0} max={40} step={1}
            onChange={(v) => runtime.update({ image: { ...settings.image, blur: v } })}
            format={(v) => `${v}px`}
          />
          <Field
            label={tt('image.dim')}
            value={settings.image.dim}
            min={0} max={0.8} step={0.05}
            onChange={(v) => runtime.update({ image: { ...settings.image, dim: v } })}
          />
          <div className="bg-studio-field">
            <label>{tt('image.fit')}</label>
            <select
              className="bg-studio-select"
              value={settings.image.fit}
              onChange={(event) => runtime.update({ image: { ...settings.image, fit: event.target.value as 'cover' | 'contain' | 'tile' } })}
            >
              <option value="cover">{tt('image.fit.cover')}</option>
              <option value="contain">{tt('image.fit.contain')}</option>
              <option value="tile">{tt('image.fit.tile')}</option>
            </select>
            <span />
          </div>
          <div className="bg-studio-field">
            <label>{tt('image.tint')}</label>
            <input
              type="color"
              className="bg-studio-color"
              value={settings.image.tint ?? '#000000'}
              onChange={(event) => runtime.update({ image: { ...settings.image, tint: event.target.value } })}
            />
            <button type="button" className="bg-studio-button" onClick={() => runtime.update({ image: { ...settings.image, tint: null } })}>
              {tt('image.tint.auto')}
            </button>
          </div>
        </div>
      )}

      {settings.kind === 'transparent' && (
        <div className="bg-studio-section">
          <Field
            label={tt('transparent.surfaceOpacity')}
            value={settings.transparent.surfaceOpacity}
            min={0} max={1} step={0.05}
            onChange={(v) => runtime.update({ transparent: { ...settings.transparent, surfaceOpacity: v } })}
          />
          <Field
            label={tt('transparent.scrim')}
            value={settings.transparent.scrim}
            min={0} max={0.5} step={0.02}
            onChange={(v) => runtime.update({ transparent: { ...settings.transparent, scrim: v } })}
          />
          <p className="bg-studio-note">{tt('transparent.note')}</p>
          {runtime.materialSupport !== 'unknown' && (
            <p className="bg-studio-note">
              {tt(runtime.materialSupport === 'ok' ? 'transparent.material.ok' : 'transparent.material.unavailable')}
            </p>
          )}
        </div>
      )}

      {settings.kind === 'frosted' && (
        <div className="bg-studio-section">
          <Field
            label={tt('frosted.blur')}
            value={settings.frosted.blur}
            min={4} max={48} step={1}
            onChange={(v) => runtime.update({ frosted: { ...settings.frosted, blur: v } })}
            format={(v) => `${v}px`}
          />
          <Field
            label={tt('frosted.surfaceOpacity')}
            value={settings.frosted.surfaceOpacity}
            min={0.15} max={0.9} step={0.05}
            onChange={(v) => runtime.update({ frosted: { ...settings.frosted, surfaceOpacity: v } })}
          />
          <Field
            label={tt('frosted.saturation')}
            value={settings.frosted.saturation}
            min={1} max={1.8} step={0.05}
            onChange={(v) => runtime.update({ frosted: { ...settings.frosted, saturation: v } })}
            format={(v) => `×${v}`}
          />
          <div className="bg-studio-field">
            <label>{tt('frosted.image')}</label>
            <select
              className="bg-studio-select"
              value={settings.frosted.imageId ?? ''}
              onChange={(event) => runtime.update({ frosted: { ...settings.frosted, imageId: event.target.value || null } })}
            >
              <option value="">{tt('frosted.image.auto')}</option>
              {runtime.library.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
            <span />
          </div>
        </div>
      )}

      <div className="bg-studio-section">
        <h3>{tt('section.library')}</h3>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { void onUpload(event) }} />
        <div className="bg-studio-actions">
          <button type="button" className="bg-studio-button" onClick={() => fileRef.current?.click()}>
            {tt('library.add')}
          </button>
          <span className="bg-studio-status">{tt('action.saved')}</span>
        </div>
        {runtime.library.length === 0 ? (
          <p className="bg-studio-note">{tt('library.empty')}</p>
        ) : (
          <div className="bg-studio-library">
            {runtime.library.map((entry) => (
              <div
                key={entry.id}
                className="bg-studio-thumb"
                data-selected={imageSelId === entry.id}
                style={{ backgroundImage: `url("${imageUrl(entry.id)}")` }}
                onClick={() => pickImage(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter') pickImage(entry.id) }}
              >
                {imageSelId === entry.id && <span className="bg-studio-thumb-tag">{tt('library.used')}</span>}
                <button
                  type="button"
                  className="bg-studio-thumb-del"
                  title={tt('library.delete')}
                  onClick={(event) => { event.stopPropagation(); removeLibraryImage(entry.id) }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-studio-actions">
        <button type="button" className="bg-studio-button" onClick={() => { void runtime.reset() }}>
          {tt('action.reset')}
        </button>
      </div>
      </div>
    </div>
  )
}
