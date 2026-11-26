const svgNamespace = 'http://www.w3.org/2000/svg';

export function inkSymbol(name: string, className: string): SVGSVGElement {
  const id = 'ink-' + name;
  const source = document.getElementById(id)!;
  const svg = document.createElementNS(svgNamespace, 'svg');
  const use = document.createElementNS(svgNamespace, 'use');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', source.getAttribute('viewBox')!);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const ratio = source.getAttribute('preserveAspectRatio');
  if (ratio) svg.setAttribute('preserveAspectRatio', ratio);
  use.setAttribute('href', '#' + id);
  svg.append(use);
  return svg;
}

const ransomAngles = [-5.5, 3.8, -2.6, 5.2, -4.1, 2.9, -3.5, 4.4];
const ransomShifts = [-0.04, 0.05, -0.02, 0.04, -0.05, 0.03, -0.03, 0.05];
const ransomTones = ['dark', 'light', 'red', 'dark', 'light', 'dark', 'red', 'light'] as const;

export function setRansomText(node: HTMLElement, value: string, highlightIndex?: number): void {
  if (node.dataset.ransom === value) return;
  node.dataset.ransom = value;
  node.classList.add('p5-ransom');
  node.setAttribute('aria-label', value);
  const chars = Array.from(value);
  let visibleIdx = 0;
  const nodes = chars.map((ch) => {
    if (ch === ' ') {
      const gap = document.createElement('span');
      gap.className = 'p5-glyph-space';
      gap.setAttribute('aria-hidden', 'true');
      gap.textContent = ' ';
      return gap;
    }
    const span = document.createElement('span');
    const idx = visibleIdx++;
    const tone = highlightIndex !== undefined && idx === highlightIndex
      ? 'red'
      : ransomTones[idx % ransomTones.length];
    span.className = 'p5-glyph';
    span.dataset.tone = tone;
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--r', ransomAngles[idx % ransomAngles.length] + 'deg');
    span.style.setProperty('--y', ransomShifts[idx % ransomShifts.length] + 'em');
    span.style.setProperty('--i', String(idx));
    span.textContent = ch;
    return span;
  });
  node.replaceChildren(...nodes);
}

let supportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return typeof window !== 'undefined' && Boolean(window.CSS?.supports?.('overlay', 'auto')) && canTransitionDisplay();
}

export async function closeDialogSmooth(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open || dialog.hasAttribute('data-closing')) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map(a => a.finished)),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  dialog.close();
}
