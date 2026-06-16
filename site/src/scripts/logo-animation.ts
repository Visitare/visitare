// Animação da porta do símbolo Visitare.
// Coordenadas do visitare-symbol.svg (100.33 × 142.39).
// Dobradiça à direita (x=100.33); lado esquerdo interpola open→closed.

const OPEN   = [[100.33, 103.94], [100.33, 3.28], [33.73, 41.74], [33.73, 142.39]] as const;
const CLOSED = [[100.33, 100.33], [100.33, 0],    [0,     0],     [0,     100.33]] as const;
const DUR = 420;

function easeInOutBack(x: number): number {
  const c1 = 3.2, c2 = c1 * 1.525;
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (2 * x - 2) + c2) + 2) / 2;
}

function makeController(doorEl: SVGPolygonElement) {
  let raf: number | null = null, startTs: number | null = null;
  let from = 0, to = 0, cur = 0;

  function setPoints(val: number) {
    const pts = OPEN.map(([ox, oy], i) => {
      const [cx, cy] = CLOSED[i];
      return `${ox + (cx - ox) * val},${oy + (cy - oy) * val}`;
    });
    doorEl.setAttribute('points', pts.join(' '));
  }

  function animateTo(target: number) {
    from = cur; to = target; startTs = null;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(ts) {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / DUR, 1);
      cur = from + (to - from) * easeInOutBack(p);
      setPoints(cur);
      if (p < 1) raf = requestAnimationFrame(step);
      else { cur = to; setPoints(to); }
    });
  }

  setPoints(0);
  return animateTo;
}

export function initLogoAnimations() {
  document.querySelectorAll<HTMLElement>('.logo-lockup').forEach((lockup) => {
    const door = lockup.querySelector<SVGPolygonElement>('.door-anim');
    if (!door) return;
    const animateTo = makeController(door);
    lockup.addEventListener('mouseenter', () => animateTo(1));
    lockup.addEventListener('mouseleave', () => animateTo(0));
  });
}
