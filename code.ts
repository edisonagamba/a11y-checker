figma.showUI(__html__, { width: 500, height: 650 });

//////////////////////////
// UTILITIES
//////////////////////////

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

function adjustColor(color: RGB, delta: number): RGB {
  return {
    r: clamp(color.r + delta),
    g: clamp(color.g + delta),
    b: clamp(color.b + delta)
  };
}

function getLuminance(r: number, g: number, b: number) {
  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const [rl, gl, bl] = [r, g, b].map(transform);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getContrastRatio(a: RGB, b: RGB) {
  const l1 = getLuminance(a.r, a.g, a.b);
  const l2 = getLuminance(b.r, b.g, b.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

//////////////////////////
// COLOR EXTRACTION
//////////////////////////

function getFirstVisibleSolid(fills: Paint[]): RGB | null {
  const solid = fills.find(f => f.type === 'SOLID' && f.visible !== false && f.opacity !== 0);
  return solid?.type === 'SOLID' ? solid.color : null;
}

function getSolidFill(node: SceneNode): RGB | null {
  if ('fills' in node && node.fills !== figma.mixed) {
    return getFirstVisibleSolid(node.fills as Paint[]);
  }
  return null;
}

function getBackgroundColor(node: SceneNode): RGB {
  let parent = node.parent;
  while (parent) {
    if ('fills' in parent && parent.fills !== figma.mixed) {
      const color = getFirstVisibleSolid(parent.fills as Paint[]);
      if (color) return color;
    }
    parent = parent.parent;
  }
  return { r: 1, g: 1, b: 1 };
}

//////////////////////////
// SUGGESTIONS
//////////////////////////

function suggestForeground(fg: RGB, bg: RGB, targetRatio: number) {
  const bgLuminance = getLuminance(bg.r, bg.g, bg.b);
  const needsDarker = bgLuminance > 0.5;
  
  let delta = 0;
  const step = needsDarker ? -0.01 : 0.01;
  
  for (let i = 0; i < 200; i++) {
    delta += step;
    const candidate = adjustColor(fg, delta);
    const ratio = getContrastRatio(candidate, bg);
    
    if (ratio >= targetRatio) {
      return { color: candidate, ratio };
    }
  }
  
  return null;
}

//////////////////////////
// NODE ANALYSIS
//////////////////////////

function analyzeNodeContrast(fg: RGB, bg: RGB, type: 'TEXT' | 'NON_TEXT', fontSize?: number, fontWeight?: string) {
  const ratio = getContrastRatio(fg, bg);
  const target = type === 'TEXT'
    ? (fontSize! >= 24 || (fontSize! >= 18.5 && fontWeight!.includes('Bold')) ? 3 : 4.5)
    : 3;

  const pass = ratio >= target;

  let suggestion = null;
  if (!pass) {
    const suggested = suggestForeground(fg, bg, target);
    if (suggested) {
      suggestion = {
        suggestedForeground: rgbToHex(suggested.color.r, suggested.color.g, suggested.color.b),
        target: type === 'TEXT' ? 'AA' : 'NON_TEXT',
        newContrastRatio: suggested.ratio
      };
    }
  }

  return { ratio, pass, suggestion };
}

function analyzeText(node: TextNode) {
  const fg = getSolidFill(node);
  if (!fg) return null;

  const bg = getBackgroundColor(node);
  const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
  const fontWeight = node.fontName !== figma.mixed ? node.fontName.style : 'Regular';
  
  const { ratio, pass, suggestion } = analyzeNodeContrast(fg, bg, 'TEXT', fontSize, fontWeight);

  return {
    foregroundColor: rgbToHex(fg.r, fg.g, fg.b),
    backgroundColor: rgbToHex(bg.r, bg.g, bg.b),
    contrastRatio: ratio,
    passAA: pass,
    passAAA: ratio >= 7,
    isLargeText: fontSize >= 24 || (fontSize >= 18.5 && fontWeight.includes('Bold')),
    fontSize,
    fontWeight,
    suggestion
  };
}

function analyzeNonText(node: SceneNode) {
  const fg = getSolidFill(node);
  if (!fg) return null;

  const bg = getBackgroundColor(node);
  const { ratio, pass, suggestion } = analyzeNodeContrast(fg, bg, 'NON_TEXT');

  return {
    foregroundColor: rgbToHex(fg.r, fg.g, fg.b),
    backgroundColor: rgbToHex(bg.r, bg.g, bg.b),
    contrastRatio: ratio,
    passNonText: pass,
    suggestion
  };
}

//////////////////////////
// SELECTION
//////////////////////////

function analyzeSelection() {
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Please select text or shapes to check contrast' });
    return;
  }

  const results = selection
    .map(node => {
      if (node.type === 'TEXT') {
        const data = analyzeText(node);
        return data ? { id: node.id, name: node.name, type: node.type, accessibilityCheck: data } : null;
      }
      const data = analyzeNonText(node);
      return data ? { id: node.id, name: node.name, type: node.type, accessibilityCheck: data } : null;
    })
    .filter(Boolean);

  figma.ui.postMessage({ type: 'analysis-complete', data: results, totalSelected: selection.length });
}

analyzeSelection();


figma.on("selectionchange", analyzeSelection);