figma.showUI(__html__, { width: 450, height: 650 });

//////////////////////////
// Color utilities
//////////////////////////

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function adjustColor(color: RGB, delta: number): RGB {
  return {
    r: clamp(color.r + delta),
    g: clamp(color.g + delta),
    b: clamp(color.b + delta)
  };
}

//////////////////////////
// Contrast math (WCAG)
//////////////////////////

function getLuminance(r: number, g: number, b: number): number {
  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const [rl, gl, bl] = [r, g, b].map(transform);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getContrastRatio(a: RGB, b: RGB): number {
  const l1 = getLuminance(a.r, a.g, a.b);
  const l2 = getLuminance(b.r, b.g, b.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

//////////////////////////
// Color extraction
//////////////////////////

function getSolidFill(node: SceneNode): RGB | null {
  if ('fills' in node && node.fills !== figma.mixed) {
    const fills = node.fills as Paint[];
    const solid = fills.find(
      f => f.type === 'SOLID' && f.visible !== false && f.opacity !== 0
    );
    return solid && solid.type === 'SOLID' ? solid.color : null;
  }
  return null;
}

function getBackgroundColor(node: SceneNode): RGB {
  let parent = node.parent;
  while (parent) {
    if ('fills' in parent && parent.fills !== figma.mixed) {
      const fills = parent.fills as Paint[];
      const solid = fills.find(
        f => f.type === 'SOLID' && f.visible !== false && f.opacity !== 0
      );
      if (solid && solid.type === 'SOLID') return solid.color;
    }
    parent = parent.parent;
  }
  return { r: 1, g: 1, b: 1 }; // fallback white
}

//////////////////////////
// Suggestions
//////////////////////////

function suggestForeground(
  fg: RGB,
  bg: RGB,
  targetRatio: number
) {
  let delta = 0;
  const step = fg.r + fg.g + fg.b > 1.5 ? -0.02 : 0.02;

  for (let i = 0; i < 100; i++) {
    delta += step;
    const candidate = adjustColor(fg, delta);
    const ratio = getContrastRatio(candidate, bg);
    if (ratio >= targetRatio) {
      return {
        color: candidate,
        ratio
      };
    }
  }
  return null;
}

//////////////////////////
// TEXT ANALYSIS
//////////////////////////

function analyzeText(node: TextNode) {
  const fg = getSolidFill(node);
  if (!fg) return null;

  const bg = getBackgroundColor(node);
  const ratio = getContrastRatio(fg, bg);

  const fontSize =
    typeof node.fontSize === 'number' ? node.fontSize : 16;

  const fontWeight =
    node.fontName !== figma.mixed ? node.fontName.style : 'Regular';

  const isLargeText =
    fontSize >= 24 ||
    (fontSize >= 18.5 && fontWeight.includes('Bold'));

  const passAA = isLargeText ? ratio >= 3 : ratio >= 4.5;
  const passAAA = isLargeText ? ratio >= 4.5 : ratio >= 7;

  let suggestion = null;
  if (!passAA) {
    const target = isLargeText ? 3 : 4.5;
    const suggested = suggestForeground(fg, bg, target);
    if (suggested) {
      suggestion = {
        suggestedForeground: rgbToHex(
          suggested.color.r,
          suggested.color.g,
          suggested.color.b
        ),
        target: 'AA',
        newContrastRatio: suggested.ratio
      };
    }
  }

  return {
    foregroundColor: rgbToHex(fg.r, fg.g, fg.b),
    backgroundColor: rgbToHex(bg.r, bg.g, bg.b),
    contrastRatio: ratio,
    passAA,
    passAAA,
    isLargeText,
    fontSize,
    fontWeight,
    suggestion
  };
}

//////////////////////////
// NON-TEXT ANALYSIS
//////////////////////////

function analyzeNonText(node: SceneNode) {
  const fg = getSolidFill(node);
  if (!fg) return null;

  const bg = getBackgroundColor(node);
  const ratio = getContrastRatio(fg, bg);
  const passNonText = ratio >= 3;

  let suggestion = null;
  if (!passNonText) {
    const suggested = suggestForeground(fg, bg, 3);
    if (suggested) {
      suggestion = {
        suggestedForeground: rgbToHex(
          suggested.color.r,
          suggested.color.g,
          suggested.color.b
        ),
        target: 'NON_TEXT',
        newContrastRatio: suggested.ratio
      };
    }
  }

  return {
    foregroundColor: rgbToHex(fg.r, fg.g, fg.b),
    backgroundColor: rgbToHex(bg.r, bg.g, bg.b),
    contrastRatio: ratio,
    passNonText,
    suggestion
  };
}

//////////////////////////
// Selection
//////////////////////////

function analyzeSelection() {
  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.ui.postMessage({
      type: 'no-selection',
      message: 'Please select text or shapes to check contrast'
    });
    return;
  }

  const results = selection
    .map(node => {
      if (node.type === 'TEXT') {
        const data = analyzeText(node);
        return data
          ? { id: node.id, name: node.name, type: node.type, accessibilityCheck: data }
          : null;
      }

      const data = analyzeNonText(node);
      return data
        ? { id: node.id, name: node.name, type: node.type, accessibilityCheck: data }
        : null;
    })
    .filter(Boolean);

  figma.ui.postMessage({
    type: 'analysis-complete',
    data: results,
    totalSelected: selection.length
  });
}

analyzeSelection();

figma.ui.onmessage = msg => {
  if (msg.type === 'analyze') analyzeSelection();
  if (msg.type === 'cancel') figma.closePlugin();
};

figma.on('selectionchange', analyzeSelection);
