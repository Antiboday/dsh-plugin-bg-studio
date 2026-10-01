/** Sidebar row glyph; the shell owns the button chrome, this draws the icon. */
import { BG_STUDIO_PANEL_ID } from '../ids.ts'

export function PanelIcon({ size }: { size: number; active: boolean }): React.ReactElement {
  return (
    <svg
      data-dsh-panel-entry={BG_STUDIO_PANEL_ID}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* picture-in-frame glyph */}
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.6" cy="6" r="1" />
      <path d="M2.5 11l3-3 2.4 2.4L10 8l3.5 3.5" />
    </svg>
  )
}
