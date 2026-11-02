/** The nav-icon swap against a hand-rolled DOM stub: matching, layout-class carry-over, self-healing, and degradation. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAV_GLYPH_MARKER, swapSubscriptionsNavIcon } from '../src/client/nav-icon.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Minimal element good enough for the swap: parent links, ordered children, attributes. */
class StubElement {
  readonly children: StubElement[] = []
  readonly attributes = new Map<string, string>()
  parentElement: StubElement | null = null
  /** createElementNS records the namespace here for assertions. */
  namespace: string | null = null

  constructor(readonly nodeName: string, public textContent = '') {}

  get childElementCount(): number { return this.children.length }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  hasAttribute(name: string): boolean { return this.attributes.has(name) }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null }
  appendChild(child: StubElement): StubElement {
    child.parentElement = this
    this.children.push(child)
    return child
  }
  replaceWith(next: StubElement): void {
    const parent = this.parentElement
    if (!parent) return
    parent.children.splice(parent.children.indexOf(this), 1, next)
    next.parentElement = parent
  }
  remove(): void {
    const parent = this.parentElement
    if (!parent) return
    parent.children.splice(parent.children.indexOf(this), 1)
    this.parentElement = null
  }
  querySelectorAll(selector: string): StubElement[] {
    assert.equal(selector, 'span,div')
    return walk(this)
  }
}

/** A document-order walk over span/div descendants, like querySelectorAll('span,div'). */
function walk(node: StubElement, into: StubElement[] = []): StubElement[] {
  for (const child of node.children) {
    if (child.nodeName === 'span' || child.nodeName === 'div') into.push(child)
    walk(child, into)
  }
  return into
}

interface Fixture {
  scope: StubElement
  document: Document
  cell: StubElement
  gear: StubElement
  decoyCell: StubElement
  decoyGear: StubElement
}

/** dialog > nav > (gear + label) plus a decoy cell carrying a different section's label. */
function mount(label = '订阅'): Fixture {
  const gear = new StubElement('svg')
  gear.setAttribute('class', 'AnXs9G_navIcon')
  const cell = new StubElement('div')
  cell.appendChild(gear)
  cell.appendChild(new StubElement('span', label))
  const decoyGear = new StubElement('svg')
  const decoyCell = new StubElement('div')
  decoyCell.appendChild(decoyGear)
  decoyCell.appendChild(new StubElement('span', '通用'))
  const nav = new StubElement('nav')
  nav.appendChild(cell)
  nav.appendChild(decoyCell)
  const scope = new StubElement('div')
  scope.appendChild(nav)
  const document = {
    createElementNS: (namespace: string, name: string) => {
      const element = new StubElement(name)
      element.namespace = namespace
      return element
    },
  } as unknown as Document
  return { scope, document, cell, gear, decoyCell, decoyGear }
}

test('the labeled cell swaps its gear for a marked gauge, keeping the layout class', () => {
  const { scope, document, cell, gear } = mount()
  assert.equal(swapSubscriptionsNavIcon(scope as unknown as ParentNode, document, '订阅'), true)
  assert.equal(cell.children.length, 2)
  const glyph = cell.children[0]
  assert.equal(glyph.nodeName, 'svg')
  assert.equal(glyph.namespace, SVG_NS)
  assert.notEqual(glyph, gear, 'the gear svg itself is replaced')
  assert.equal(glyph.hasAttribute(NAV_GLYPH_MARKER), true, 'the gauge carries the idempotency marker')
  assert.equal(glyph.getAttribute('class'), 'AnXs9G_navIcon', 'the gear layout class carries over')
  assert.equal(glyph.getAttribute('aria-hidden'), 'true')
  const paths = glyph.children
  assert.equal(paths.length, 3)
  assert.equal(paths[0].getAttribute('stroke-width'), '1.3')
  assert.match(paths[0].getAttribute('d')!, /^M3\.4041 13\.096/)
  assert.match(paths[1].getAttribute('d')!, /^M8 8\.49994/)
  assert.equal(paths[2].getAttribute('fill'), 'currentColor')
})

test('a live gauge makes further runs no-ops, and the decoy cell stays untouched', () => {
  const { scope, document, cell, decoyCell, decoyGear } = mount()
  const scopeNode = scope as unknown as ParentNode
  assert.equal(swapSubscriptionsNavIcon(scopeNode, document, '订阅'), true)
  const gauge = cell.children[0]
  assert.equal(swapSubscriptionsNavIcon(scopeNode, document, '订阅'), true, 'live gauge reports success')
  assert.equal(cell.children[0], gauge, 'the gauge node is not rebuilt')
  assert.equal(decoyCell.hasAttribute(NAV_GLYPH_MARKER), false)
  assert.equal(decoyCell.children[0], decoyGear, 'the decoy keeps its original svg')
})

test('a resurrected gear is re-swapped, and strays next to a live gauge are dropped', () => {
  const { scope, document, cell } = mount()
  const scopeNode = scope as unknown as ParentNode
  assert.equal(swapSubscriptionsNavIcon(scopeNode, document, '订阅'), true)
  const gauge = cell.children[0]
  // React re-render reverted the icon: the gauge node is gone, an unmarked gear is back.
  const resurrected = new StubElement('svg')
  resurrected.setAttribute('class', 'AnXs9G_navIcon')
  resurrected.parentElement = cell // the fixture must keep parent links consistent, like a real DOM
  cell.children.splice(0, 1, resurrected)
  assert.equal(swapSubscriptionsNavIcon(scopeNode, document, '订阅'), true, 'self-heals')
  assert.notEqual(cell.children[0], resurrected, 'the resurrected gear is replaced again')
  assert.equal(cell.children[0].hasAttribute(NAV_GLYPH_MARKER), true)
  const healed = cell.children[0]

  // A stray unmarked gear appears beside the live gauge: dropped, gauge kept.
  const stray = new StubElement('svg')
  stray.parentElement = cell
  cell.children.splice(0, 0, stray)
  assert.equal(swapSubscriptionsNavIcon(scopeNode, document, '订阅'), true)
  assert.equal(cell.children.includes(stray), false, 'the stray is removed')
  assert.equal(cell.children[0], healed, 'the live gauge survives')
})

test('structural mismatches degrade to leaving the DOM alone: wrong label, no svg, no label', () => {
  const wrong = mount()
  assert.equal(swapSubscriptionsNavIcon(wrong.scope as unknown as ParentNode, wrong.document, '不存在的入口'), false)
  assert.equal(wrong.cell.hasAttribute(NAV_GLYPH_MARKER), false)

  const noSvg = mount()
  noSvg.cell.children.splice(0, 1) // drop the gear, keep the label
  assert.equal(swapSubscriptionsNavIcon(noSvg.scope as unknown as ParentNode, noSvg.document, '订阅'), false)

  const noLabel = mount()
  noLabel.cell.children.pop() // drop the label span, keep the gear
  assert.equal(swapSubscriptionsNavIcon(noLabel.scope as unknown as ParentNode, noLabel.document, '订阅'), false)
})
