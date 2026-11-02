/**
 * The settings nav glyph for this plugin's section. The host maps nav cells to
 * glyphs by section id and falls back to the settings gear for unknown ids —
 * the section contract carries no icon field — so `subscriptions` rendered the
 * same gear as the settings entry itself. Once the settings dialog renders,
 * this module swaps that gear for a gauge: artwork from the host's 16px icon
 * set at the nav's Medium weight (1.3 stroke), inheriting the gear's layout
 * class so the cell metrics never shift. Matching goes by the localized label
 * text because the host's CSS class names are build-hashed; the swap is
 * self-healing (a React re-render that resurrects the gear is re-swapped on
 * the next run) and every structural mismatch degrades to leaving the DOM
 * alone.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const NAV_WEIGHT_STROKE = '1.3'

/** Marks the gauge svg this module installed, so re-runs never rebuild it. */
export const NAV_GLYPH_MARKER = 'data-dsh-subscriptions-nav-glyph'

/** The host's IconGaugeOutlineMedium artwork, verbatim from its 16px icon set. */
const GAUGE_ARTWORK = {
  arc: 'M3.4041 13.096C2.49514 12.187 1.87614 11.0288 1.62537 9.76798C1.37459 8.50716 1.50331 7.20028 1.99525 6.01261C2.48719 4.82494 3.32025 3.80981 4.3891 3.09557C5.45795 2.38134 6.71458 2.00008 8.0001 2C9.28563 2.00008 10.5423 2.38134 11.6111 3.09557C12.68 3.80981 13.513 4.82494 14.005 6.01261C14.4969 7.20028 14.6256 8.50716 14.3748 9.76798C14.1241 11.0288 13.5051 12.187 12.5961 13.096',
  needle: 'M8 8.49994L11.6114 4.88855',
  hub: 'M8 9.75C8.69036 9.75 9.25 9.19036 9.25 8.5C9.25 7.80964 8.69036 7.25 8 7.25C7.30964 7.25 6.75 7.80964 6.75 8.5C6.75 9.19036 7.30964 9.75 8 9.75Z',
} as const

/** One standalone copy of the gauge glyph, laid out like the gear it replaces. */
function gaugeGlyph(document: Document, layoutClass: string | null): Element {
  const svg = document.createElementNS(SVG_NS, 'svg')
  for (const [name, value] of [
    ['width', '16'], ['height', '16'], ['viewBox', '0 0 16 16'],
    ['fill', 'none'], ['aria-hidden', 'true'], [NAV_GLYPH_MARKER, '1'],
  ] as const) svg.setAttribute(name, value)
  if (layoutClass) svg.setAttribute('class', layoutClass)
  for (const d of [GAUGE_ARTWORK.arc, GAUGE_ARTWORK.needle]) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', NAV_WEIGHT_STROKE)
    svg.appendChild(path)
  }
  const hub = document.createElementNS(SVG_NS, 'path')
  hub.setAttribute('d', GAUGE_ARTWORK.hub)
  hub.setAttribute('fill', 'currentColor')
  svg.appendChild(hub)
  return svg
}

/**
 * Replace the fallback gear in the nav cell labeled `label` within `scope`.
 * Idempotent through the marker on the installed gauge, and self-healing: a
 * run re-swaps a gear that came back and drops stray gears next to a live
 * gauge. Returns false when the cell was not found or the structure did not
 * match — the DOM then simply stays as the host rendered it.
 */
export function swapSubscriptionsNavIcon(scope: ParentNode, document: Document, label: string): boolean {
  for (const candidate of Array.from(scope.querySelectorAll<HTMLElement>('span,div'))) {
    if (candidate.childElementCount !== 0 || candidate.textContent !== label) continue
    const cell = candidate.parentElement
    if (!cell) continue
    const icons = Array.from(cell.children).filter(child => child.nodeName === 'svg')
    if (icons.length === 0) continue
    const gauge = icons.find(icon => icon.hasAttribute(NAV_GLYPH_MARKER))
    if (gauge !== undefined) {
      for (const stray of icons) if (stray !== gauge) stray.remove()
      return true
    }
    // Build the replacement before touching the DOM, so a partial swap can
    // never leave the cell marked without a gauge.
    const replacement = gaugeGlyph(document, icons[0].getAttribute('class'))
    icons[0].replaceWith(replacement)
    return true
  }
  return false
}
