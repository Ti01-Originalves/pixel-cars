#!/usr/bin/env tsx
/**
 * Sprite Importer - Converte imagens (JPEG/PNG) para formato CustomCarAsset do jogo
 *
 * Uso: npx tsx tools/import-sprites.ts
 *      npx tsx tools/import-sprites.ts --input ./sprites --output ./src/assets/custom
 *      npx tsx tools/import-sprites.ts --watch
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPRITES_DIR = path.join(PROJECT_ROOT, 'sprites');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'src', 'assets', 'custom');

// ============================================================================
// TIPOS (mirror do jogo)
// ============================================================================

interface CustomCarAsset {
  id: string;
  name: string;
  createdAt: number;
  width: number;
  height: number;
  pixels: string[];           // Direita (48x24)
  pixelsLeft?: string[];      // Esquerda (48x24)
  pixelsFront?: string[];     // Frente (24x24)
  pixelsRear?: string[];      // Trás (24x24)
  pixelsTop?: string[];       // Topo (48x24)
  basePrimaryColorToken?: string;
  baseSecondaryColorToken?: string;
  accessoryConfig?: CustomCarAccessoryConfig;
  vectorPath?: string;
  encryptedHashId?: string;
  creatorId?: string;
  creatorSignature?: string;
  rarityScore?: number;
  primaryColor?: string;
  secondaryColor?: string;
  neonColor?: string;
  presetBase?: string;
  isAuctionReady?: boolean;
  auctionEstimate?: number;
}

interface CustomCarAccessoryConfig {
  wheels: {
    visible: boolean;
    rearX: number;
    rearY: number;
    frontX: number;
    frontY: number;
    radius: number;
    layer: 'in_front' | 'behind';
    style: 'spokes' | 'steelies' | 'mesh' | 'spiked';
    spinning?: boolean;
    color?: string;
  };
  spoiler: {
    visible: boolean;
    x: number;
    y: number;
    scale: number;
    layer: 'in_front' | 'behind';
    style: 'small' | 'gt_wing' | 'ducktail';
    color?: string;
  };
  nitro: {
    visible: boolean;
    x: number;
    y: number;
    layer: 'in_front' | 'behind';
  };
  headlights: {
    visible: boolean;
    x: number;
    y: number;
    beamVisible: boolean;
    layer: 'in_front' | 'behind';
  };
  neon: {
    visible: boolean;
    color: string;
    y: number;
  };
}

interface ColorTokens {
  primary: string;      // __PRIMARY_BASE__
  primaryHi: string;    // __PRIMARY_HI__
  primaryLight: string; // __PRIMARY_LIGHT__
  primaryDark: string;  // __PRIMARY_DARK__
  primaryDeep: string;  // __PRIMARY_DEEP__
  secondary: string;    // __SECONDARY_BASE__
  secondaryHi: string;
  secondaryDark: string;
  glass: string;
  glassSky: string;
  glassGlare: string;
  lamp: string;
  tail: string;
  dark: string;
  tire: string;
  chrome: string;
}

// ============================================================================
// CONSTANTES DO JOGO
// ============================================================================

const SIDE_W = 48, SIDE_H = 24;
const FRONT_W = 24, FRONT_H = 24;
const TOP_W = 48, TOP_H = 24;

const PALETTE_QUANTIZATION = 32; // reduzir cores para 32 níveis por canal

// Tokens de cor dinâmicos que o jogo reconhece
const COLOR_TOKENS: Record<string, string> = {
  '__PRIMARY_BASE__': '#e11d48',
  '__PRIMARY_HI__': '#fda4af',
  '__PRIMARY_LIGHT__': '#fb7185',
  '__PRIMARY_DARK__': '#9f1239',
  '__PRIMARY_DEEP__': '#7f1d1d',
  '__SECONDARY_BASE__': '#09090b',
  '__SECONDARY_HI__': '#52525b',
  '__SECONDARY_DARK__': '#040405',
};

// ============================================================================
// UTILITÁRIOS DE IMAGEM
// ============================================================================

function createEmptyGrid(w: number, h: number): string[] {
  return new Array(w * h).fill('');
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

function fillRect(
  pixels: string[],
  w: number,
  h: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  color: string
) {
  for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++) {
    for (let x = Math.max(0, rx); x < Math.min(w, rx + rw); x++) {
      pixels[y * w + x] = color;
    }
  }
}

function mirrorGridHorizontally(pixels: string[], w: number, h: number): string[] {
  const result = new Array(w * h).fill('');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      result[y * w + (w - 1 - x)] = pixels[y * w + x];
    }
  }
  return result;
}

// Quantiza cor para paleta reduzida + mapeia para tokens se próximo
function quantizeColor(r: number, g: number, b: number, a: number): string {
  if (a < 128) return 'transparent';

  // Quantização simples
  const qr = Math.round(r / PALETTE_QUANTIZATION) * PALETTE_QUANTIZATION;
  const qg = Math.round(g / PALETTE_QUANTIZATION) * PALETTE_QUANTIZATION;
  const qb = Math.round(b / PALETTE_QUANTIZATION) * PALETTE_QUANTIZATION;

  return `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;
}

// Extrai paleta dominante da imagem (lateral direita)
async function extractColorTokens(imagePath: string): Promise<ColorTokens> {
  const { data, info } = await sharp(imagePath)
    .resize(SIDE_W, SIDE_H, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colorCounts: Record<string, number> = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const hex = quantizeColor(r, g, b, a);
    if (hex === 'transparent') continue;
    colorCounts[hex] = (colorCounts[hex] || 0) + 1;
  }

  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  // Filtrar cores de fundo/preto puro
  const bodyColors = sorted.filter(c => {
    const l = parseInt(c.slice(1), 16);
    const r = (l >> 16) & 255, g = (l >> 8) & 255, b = l & 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 30 && luminance < 220; // não preto puro, não branco puro
  });

  const primary = bodyColors[0] || '#e11d48';
  const secondary = bodyColors[1] || '#09090b';

  // Gerar escala 5-tons baseada na cor primária
  const pr = parseInt(primary.slice(1, 3), 16);
  const pg = parseInt(primary.slice(3, 5), 16);
  const pb = parseInt(primary.slice(5, 7), 16);

  const adjust = (r: number, g: number, b: number, factor: number) => {
    const nr = Math.round(Math.min(255, Math.max(0, r * factor)));
    const ng = Math.round(Math.min(255, Math.max(0, g * factor)));
    const nb = Math.round(Math.min(255, Math.max(0, b * factor)));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  };

  return {
    primary,
    primaryHi: adjust(pr, pg, pb, 1.5),
    primaryLight: adjust(pr, pg, pb, 1.25),
    primaryDark: adjust(pr, pg, pb, 0.7),
    primaryDeep: adjust(pr, pg, pb, 0.45),
    secondary,
    secondaryHi: adjust(
      parseInt(secondary.slice(1, 3), 16),
      parseInt(secondary.slice(3, 5), 16),
      parseInt(secondary.slice(5, 7), 16),
      1.3
    ),
    secondaryDark: adjust(
      parseInt(secondary.slice(1, 3), 16),
      parseInt(secondary.slice(3, 5), 16),
      parseInt(secondary.slice(5, 7), 16),
      0.5
    ),
    glass: '#0f172a',
    glassSky: '#38bdf8',
    glassGlare: '#e0f2fe',
    lamp: '#fef08a',
    tail: '#ef4444',
    dark: '#09090b',
    tire: '#18181b',
    chrome: '#e2e8f0',
  };
}

// ============================================================================
// DETECÇÃO DE FORMATO
// ============================================================================

interface SpriteLayout {
  type: 'sprite_sheet_4row' | 'single_image';
  views: {
    right?: { x: number; y: number; w: number; h: number };
    left?: { x: number; y: number; w: number; h: number };
    front?: { x: number; y: number; w: number; h: number };
    rear?: { x: number; y: number; w: number; h: number };
    top?: { x: number; y: number; w: number; h: number };
  };
}

async function detectSpriteLayout(imagePath: string): Promise<SpriteLayout> {
  const metadata = await sharp(imagePath).metadata();
  const { width, height } = metadata;

  // Heurística: sprite sheet 4-linhas do prompt Gemini = altura ~4x largura da vista
  // Lateral: 48x24, Frente/Trás: 24x24, Topo: 48x24
  // Sprite sheet típico: 4 linhas, cada uma com as vistas lado a lado

  const aspectRatio = width / height;

  // Se for aproximadamente quadrado ou 4:3, pode ser sprite sheet
  // Prompt Gemini: "arranged in 4 rows on transparent background"
  if (height > width * 1.5 || (height >= 900 && width >= 900)) {
    // Provável sprite sheet 4 linhas
    const rowHeight = Math.floor(height / 4);
    return {
      type: 'sprite_sheet_4row',
      views: {
        right: { x: 0, y: 0, w: width, h: rowHeight },
        left: { x: 0, y: rowHeight, w: width, h: rowHeight },
        front: { x: 0, y: rowHeight * 2, w: Math.floor(width / 2), h: rowHeight },
        rear: { x: Math.floor(width / 2), y: rowHeight * 2, w: Math.floor(width / 2), h: rowHeight },
        top: { x: 0, y: rowHeight * 3, w: width, h: rowHeight },
      }
    };
  }

  // Imagem única - vamos gerar as outras vistas
  return {
    type: 'single_image',
    views: {
      right: { x: 0, y: 0, w: width, h: height }
    }
  };
}

// ============================================================================
// PROCESSAMENTO DE VISTA INDIVIDUAL
// ============================================================================

async function extractViewGrid(
  imagePath: string,
  viewRect: { x: number; y: number; w: number; h: number },
  targetW: number,
  targetH: number,
  tokens: ColorTokens
): Promise<string[]> {
  const { data } = await sharp(imagePath)
    .extract({ left: viewRect.x, top: viewRect.y, width: viewRect.w, height: viewRect.h })
    .resize(targetW, targetH, { fit: 'fill', kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const grid = createEmptyGrid(targetW, targetH);

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

      if (a < 128) {
        grid[y * targetW + x] = 'transparent';
        continue;
      }

      const hex = quantizeColor(r, g, b, a);

      // Mapear para tokens dinâmicos baseado na similaridade com cores extraídas
      const mapped = mapToToken(hex, tokens);
      grid[y * targetW + x] = mapped;
    }
  }

  return grid;
}

function mapToToken(hex: string, tokens: ColorTokens): string {
  if (hex === 'transparent') return 'transparent';

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Calcular distância para cada token conhecido
  const tokenColors: Record<string, [number, number, number]> = {
    '__PRIMARY_HI__': hexToRgb(tokens.primaryHi),
    '__PRIMARY_LIGHT__': hexToRgb(tokens.primaryLight),
    '__PRIMARY_BASE__': hexToRgb(tokens.primary),
    '__PRIMARY_DARK__': hexToRgb(tokens.primaryDark),
    '__PRIMARY_DEEP__': hexToRgb(tokens.primaryDeep),
    '__SECONDARY_HI__': hexToRgb(tokens.secondaryHi),
    '__SECONDARY_BASE__': hexToRgb(tokens.secondary),
    '__SECONDARY_DARK__': hexToRgb(tokens.secondaryDark),
    '#0f172a': [15, 23, 42],      // glass
    '#38bdf8': [56, 189, 248],    // glassSky
    '#e0f2fe': [224, 242, 254],   // glassGlare
    '#fef08a': [254, 240, 138],   // lamp
    '#ef4444': [239, 68, 68],     // tail
    '#09090b': [9, 9, 11],        // dark
    '#18181b': [24, 24, 27],      // tire
    '#e2e8f0': [226, 232, 240],   // chrome
  };

  let bestToken = '__PRIMARY_BASE__';
  let bestDist = Infinity;

  for (const [token, [tr, tg, tb]] of Object.entries(tokenColors)) {
    const dist = Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
    if (dist < bestDist) {
      bestDist = dist;
      bestToken = token;
    }
  }

  // Se muito diferente de qualquer token, usar cor direta
  if (bestDist > 100) return hex;
  return bestToken;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

// ============================================================================
// GERAÇÃO DE VISTAS SINTÉTICAS (para imagem única)
// ============================================================================

function generateGenericFrontFromRight(pixelsRight: string[], tokens: ColorTokens): string[] {
  const w = FRONT_W, h = FRONT_H;
  const p = createEmptyGrid(w, h);
  const { primary, primaryHi, secondary, glass, glassSky, lamp, dark, tire } = tokens;

  // Front lower bumper & air dam
  fillRect(p, w, h, 3, 17, 18, 2, secondary);
  fillRect(p, w, h, 4, 14, 16, 3, primary);

  // Front radiator grille
  fillRect(p, w, h, 8, 15, 8, 2, dark);

  // Front Headlights
  fillRect(p, w, h, 4, 13, 3, 2, lamp);
  fillRect(p, w, h, 17, 13, 3, 2, lamp);

  // Hood central crease
  fillRect(p, w, h, 11, 14, 2, 2, secondary);

  // Windshield & Glare
  fillRect(p, w, h, 6, 9, 12, 5, glass);
  fillRect(p, w, h, 8, 10, 3, 3, glassSky);

  // Roof
  fillRect(p, w, h, 7, 8, 10, 1, primary);

  // Front Camber Tires
  fillRect(p, w, h, 2, 16, 2, 3, tire);
  fillRect(p, w, h, 20, 16, 2, 3, tire);

  return p;
}

function generateGenericRearFromRight(pixelsRight: string[], tokens: ColorTokens): string[] {
  const w = FRONT_W, h = FRONT_H;
  const p = createEmptyGrid(w, h);
  const { primary, secondary, glass, tail, dark, tire } = tokens;

  // Rear diffuser & bumper
  fillRect(p, w, h, 3, 17, 18, 2, secondary);
  fillRect(p, w, h, 4, 14, 16, 3, primary);

  // Taillight cluster
  fillRect(p, w, h, 4, 13, 4, 2, tail);
  fillRect(p, w, h, 16, 13, 4, 2, tail);

  // Center license plate area & exhausts
  fillRect(p, w, h, 9, 14, 6, 2, dark);
  fillRect(p, w, h, 6, 17, 2, 1, '#94a3b8');
  fillRect(p, w, h, 16, 17, 2, 1, '#94a3b8');

  // Rear window
  fillRect(p, w, h, 6, 9, 12, 5, glass);

  // Roof
  fillRect(p, w, h, 7, 8, 10, 1, primary);

  // Aero spoiler top wing
  fillRect(p, w, h, 3, 6, 18, 1, secondary);
  fillRect(p, w, h, 6, 7, 1, 2, secondary);
  fillRect(p, w, h, 17, 7, 1, 2, secondary);

  // Wide Rear Tires
  fillRect(p, w, h, 2, 16, 2, 3, tire);
  fillRect(p, w, h, 20, 16, 2, 3, tire);

  return p;
}

function generateGenericTopFromRight(pixelsRight: string[], tokens: ColorTokens): string[] {
  const w = TOP_W, h = TOP_H;
  const p = createEmptyGrid(w, h);
  const { primary, secondary, glass, tire } = tokens;

  // Main car hull
  fillRect(p, w, h, 6, 5, 36, 14, primary);

  // Hood styling (front facing right)
  fillRect(p, w, h, 34, 10, 8, 4, secondary);

  // Windshield
  fillRect(p, w, h, 26, 6, 6, 12, glass);

  // Roof
  fillRect(p, w, h, 18, 6, 8, 12, primary);

  // Rear windshield
  fillRect(p, w, h, 12, 6, 6, 12, glass);

  // Rear wing blade
  fillRect(p, w, h, 4, 4, 2, 16, secondary);

  // Side mirrors
  fillRect(p, w, h, 28, 3, 2, 2, primary);
  fillRect(p, w, h, 28, 19, 2, 2, primary);

  // 4 Tires at corners
  fillRect(p, w, h, 10, 3, 6, 2, tire);
  fillRect(p, w, h, 10, 19, 6, 2, tire);
  fillRect(p, w, h, 32, 3, 6, 2, tire);
  fillRect(p, w, h, 32, 19, 6, 2, tire);

  // Front splitter
  fillRect(p, w, h, 42, 7, 2, 10, secondary);

  return p;
}

// ============================================================================
// VECTOR PATH EXTRACTION (para hash criptográfico)
// ============================================================================

function generateVectorPathFromGrid(pixels: string[], w: number, h: number): string {
  const topPoints: { x: number; y: number }[] = [];
  const bottomPoints: { x: number; y: number }[] = [];
  let minCol = w, maxCol = -1;

  for (let x = 0; x < w; x++) {
    let topY = -1, botY = -1;
    for (let y = 0; y < h; y++) {
      const col = pixels[y * w + x];
      if (col && col !== 'transparent' && col !== '') {
        if (topY === -1) topY = y;
        botY = y;
      }
    }
    if (topY !== -1 && botY !== -1) {
      topPoints.push({ x, y: topY });
      bottomPoints.push({ x, y: botY });
      if (x < minCol) minCol = x;
      if (x > maxCol) maxCol = x;
    }
  }

  if (topPoints.length < 4 || minCol >= maxCol) {
    return 'M 6 18 C 6 15, 9 14, 12 14 L 17 14 C 20 10, 24 8, 30 8 L 34 8 C 38 8, 42 12, 44 14 L 46 16 C 46 18, 44 19, 41 19 C 39 19, 39 17, 36 17 C 33 17, 33 19, 21 19 C 19 19, 19 17, 16 17 C 13 17, 13 19, 8 19 Z';
  }

  const smoothedTop: { x: number; y: number }[] = [];
  for (let i = 0; i < topPoints.length; i += 2) smoothedTop.push(topPoints[i]);
  if (smoothedTop[smoothedTop.length - 1]?.x !== topPoints[topPoints.length - 1]?.x) {
    smoothedTop.push(topPoints[topPoints.length - 1]);
  }

  const smoothedBottom: { x: number; y: number }[] = [];
  for (let i = bottomPoints.length - 1; i >= 0; i -= 2) smoothedBottom.push(bottomPoints[i]);
  if (smoothedBottom[smoothedBottom.length - 1]?.x !== bottomPoints[0]?.x) {
    smoothedBottom.push(bottomPoints[0]);
  }

  let pathStr = `M ${smoothedTop[0].x} ${smoothedTop[0].y + 1}`;
  for (let i = 1; i < smoothedTop.length; i++) {
    const prev = smoothedTop[i - 1];
    const curr = smoothedTop[i];
    const midX = ((prev.x + curr.x) / 2).toFixed(1);
    pathStr += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const frontEnd = smoothedTop[smoothedTop.length - 1];
  const frontBottom = smoothedBottom[0];
  pathStr += ` L ${frontEnd.x} ${frontBottom.y}`;

  for (let i = 1; i < smoothedBottom.length; i++) {
    pathStr += ` L ${smoothedBottom[i].x} ${smoothedBottom[i].y}`;
  }
  pathStr += ` Z`;
  return pathStr;
}

// ============================================================================
// HASH CRIPTOGRÁFICO (mesmo algoritmo do AssetStudioView)
// ============================================================================

function generateCryptoHash(input: string): string {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h0 = (Math.imul(h0 ^ code, 0x5bd1e995) + (h1 << 5) + (h1 >>> 2)) >>> 0;
    h1 = (Math.imul(h1 ^ (code * 31), 0x1b873593) + (h2 << 5) + (h2 >>> 2)) >>> 0;
    h2 = (Math.imul(h2 ^ (code * 73), 0x85ebca6b) + (h3 << 5) + (h3 >>> 2)) >>> 0;
    h3 = (Math.imul(h3 ^ (code * 127), 0xc2b2ae35) + (h4 << 5) + (h4 >>> 2)) >>> 0;
    h4 = (Math.imul(h4 ^ (code * 199), 0x27d4eb2f) + (h5 << 5) + (h5 >>> 2)) >>> 0;
    h5 = (Math.imul(h5 ^ (code * 251), 0x165667b1) + (h6 << 5) + (h6 >>> 2)) >>> 0;
    h6 = (Math.imul(h6 ^ (code * 311), 0x9e3779b9) + (h7 << 5) + (h7 >>> 2)) >>> 0;
    h7 = (Math.imul(h7 ^ (code * 397), 0x45bf92e1) + (h0 << 5) + (h0 >>> 2)) >>> 0;
  }

  const toHex = (n: number) => ('00000000' + (n >>> 0).toString(16)).slice(-8);
  return (
    toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) +
    toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7)
  ).toUpperCase();
}

function createAssetCredentials(
  creatorId: string,
  assetName: string,
  vectorPath: string,
  width: number,
  height: number,
  timestamp: number
) {
  const payload = `${creatorId}::${assetName}::${vectorPath}::${width}x${height}::${timestamp}::CRYPTO_TOKEN_AUCTION_V2`;
  const rawHash = generateCryptoHash(payload);
  const encryptedHashId = `CIPHER-SHA256-${rawHash.slice(0, 24)}`;
  const creatorPrefix = creatorId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const creatorSignature = `SIG-ECDSA-v2.${rawHash.slice(24, 48)}.${creatorPrefix}`;

  const pointCount = (vectorPath.match(/[MLCQZ]/g) || []).length;
  const pathLength = vectorPath.length;
  const rawScore = Math.min(99, Math.max(45, Math.floor(pointCount * 3.2 + pathLength * 0.12)));
  const auctionEstimateCoins = Math.floor(rawScore * 280 + 3500);

  return { encryptedHashId, creatorSignature, rarityScore: rawScore, auctionEstimateCoins };
}

// ============================================================================
// ACCESSORY CONFIG PADRÃO
// ============================================================================

function createDefaultAccessoryConfig(): CustomCarAccessoryConfig {
  return {
    wheels: {
      visible: true,
      rearX: 10, rearY: 17, frontX: 38, frontY: 17,
      radius: 3.5, layer: 'in_front', style: 'spokes', spinning: true, color: '#18181b'
    },
    spoiler: {
      visible: true, x: 4, y: 7, scale: 1, layer: 'in_front', style: 'gt_wing', color: '#09090b'
    },
    nitro: { visible: true, x: 1, y: 17, layer: 'behind' },
    headlights: { visible: true, x: 42, y: 14, beamVisible: true, layer: 'in_front' },
    neon: { visible: false, color: '#00f0ff', y: 20 }
  };
}

// ============================================================================
// PROCESSAMENTO PRINCIPAL
// ============================================================================

async function processImage(filePath: string, fileName: string): Promise<CustomCarAsset | null> {
  console.log(`\n📷 Processando: ${fileName}`);

  try {
    const layout = await detectSpriteLayout(filePath);
    console.log(`   Layout detectado: ${layout.type}`);

    // Extrair tokens de cor da vista direita (ou imagem inteira)
    const tokens = await extractColorTokens(filePath);
    console.log(`   Cor primária: ${tokens.primary}, Secundária: ${tokens.secondary}`);

    let pixelsRight: string[];
    let pixelsLeft: string[];
    let pixelsFront: string[];
    let pixelsRear: string[];
    let pixelsTop: string[];

    if (layout.type === 'sprite_sheet_4row' && layout.views.right) {
      // Extrair cada vista do sprite sheet
      console.log(`   Extraindo vistas do sprite sheet...`);

      pixelsRight = await extractViewGrid(filePath, layout.views.right, SIDE_W, SIDE_H, tokens);

      if (layout.views.left) {
        pixelsLeft = await extractViewGrid(filePath, layout.views.left, SIDE_W, SIDE_H, tokens);
      } else {
        pixelsLeft = mirrorGridHorizontally(pixelsRight, SIDE_W, SIDE_H);
      }

      if (layout.views.front) {
        pixelsFront = await extractViewGrid(filePath, layout.views.front, FRONT_W, FRONT_H, tokens);
      } else {
        pixelsFront = generateGenericFrontFromRight(pixelsRight, tokens);
      }

      if (layout.views.rear) {
        pixelsRear = await extractViewGrid(filePath, layout.views.rear, FRONT_W, FRONT_H, tokens);
      } else {
        pixelsRear = generateGenericRearFromRight(pixelsRight, tokens);
      }

      if (layout.views.top) {
        pixelsTop = await extractViewGrid(filePath, layout.views.top, TOP_W, TOP_H, tokens);
      } else {
        pixelsTop = generateGenericTopFromRight(pixelsRight, tokens);
      }
    } else {
      // Imagem única - extrair direita e gerar demais
      console.log(`   Imagem única - extraindo lateral e gerando demais vistas...`);

      pixelsRight = await extractViewGrid(filePath, layout.views.right!, SIDE_W, SIDE_H, tokens);
      pixelsLeft = mirrorGridHorizontally(pixelsRight, SIDE_W, SIDE_H);
      pixelsFront = generateGenericFrontFromRight(pixelsRight, tokens);
      pixelsRear = generateGenericRearFromRight(pixelsRight, tokens);
      pixelsTop = generateGenericTopFromRight(pixelsRight, tokens);
    }

    // Gerar vector path e credenciais
    const vectorPath = generateVectorPathFromGrid(pixelsRight, SIDE_W, SIDE_H);
    const timestamp = Date.now();
    const creatorId = 'sprite-importer-v1';
    const assetName = path.basename(fileName, path.extname(fileName)).replace(/[_\-]/g, ' ');

    const creds = createAssetCredentials(creatorId, assetName, vectorPath, SIDE_W, SIDE_H, timestamp);

    const asset: CustomCarAsset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: assetName,
      createdAt: timestamp,
      width: SIDE_W,
      height: SIDE_H,
      pixels: pixelsRight,
      pixelsLeft,
      pixelsFront,
      pixelsRear,
      pixelsTop,
      basePrimaryColorToken: '__PRIMARY_BASE__',
      baseSecondaryColorToken: '__SECONDARY_BASE__',
      accessoryConfig: createDefaultAccessoryConfig(),
      vectorPath,
      encryptedHashId: creds.encryptedHashId,
      creatorId,
      creatorSignature: creds.creatorSignature,
      rarityScore: creds.rarityScore,
      primaryColor: tokens.primary,
      secondaryColor: tokens.secondary,
      neonColor: '#00f0ff',
      presetBase: 'imported',
      isAuctionReady: true,
      auctionEstimate: creds.auctionEstimateCoins
    };

    console.log(`   ✅ Asset criado: ${asset.name} (${asset.id})`);
    console.log(`   📊 Rarity: ${asset.rarityScore}/99 | Est. Leilão: ${asset.auctionEstimate?.toLocaleString()} coins`);

    return asset;

  } catch (error) {
    console.error(`   ❌ Erro ao processar ${fileName}:`, error);
    return null;
  }
}

async function processAllSprites(inputDir: string = SPRITES_DIR): Promise<CustomCarAsset[]> {
  const files = fs.readdirSync(inputDir)
    .filter(f => /\.(jpe?g|jpe|png|webp)$/i.test(f))
    .sort();

  console.log(`\n🔍 Encontrados ${files.length} arquivos em ${inputDir}`);

  const assets: CustomCarAsset[] = [];

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const asset = await processImage(filePath, file);
    if (asset) assets.push(asset);
  }

  return assets;
}

async function saveAssets(assets: CustomCarAsset[], outputDir: string = OUTPUT_DIR) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Salvar cada asset individualmente
  for (const asset of assets) {
    const filePath = path.join(outputDir, `${asset.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(asset, null, 2));
    console.log(`💾 Salvo: ${filePath}`);
  }

  // Salvar manifest combinado
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ assets: assets.map(a => a.id), count: assets.length }, null, 2));
  console.log(`📋 Manifest salvo: ${manifestPath}`);

  // Gerar código TypeScript para injeção no localStorage
  const tsCode = `// Auto-generated by import-sprites.ts - ${new Date().toISOString()}
export const IMPORTED_CUSTOM_ASSETS: CustomCarAsset[] = ${JSON.stringify(assets, null, 2)};
`;
  const tsPath = path.join(outputDir, 'imported-assets.ts');
  fs.writeFileSync(tsPath, tsCode);
  console.log(`📝 TypeScript export salvo: ${tsPath}`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const inputDir = args.includes('--input') ? args[args.indexOf('--input') + 1] : SPRITES_DIR;
  const outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : OUTPUT_DIR;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     PIXEL CARS - SPRITE IMPORTER v1.0                   ║');
  console.log('║     Converte JPEG/PNG → CustomCarAsset (5 vistas)       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (watchMode) {
    console.log('\n👀 Modo WATCH ativo - monitorando pasta sprites/');
    console.log('   Pressione Ctrl+C para sair\n');

    fs.watch(inputDir, { persistent: true }, async (eventType, filename) => {
      if (filename && /\.(jpe?g|jpe|png|webp)$/i.test(filename) && eventType === 'rename') {
        console.log(`\n📥 Novo arquivo detectado: ${filename}`);
        const asset = await processImage(path.join(inputDir, filename), filename);
        if (asset) {
          await saveAssets([asset], outputDir);
          console.log(`✅ Importado e salvo automaticamente!`);
        }
      }
    });

    // Manter processo vivo
    await new Promise(() => {});
  } else {
    const assets = await processAllSprites(inputDir);
    await saveAssets(assets, outputDir);

    console.log(`\n🎉 CONCLUÍDO! ${assets.length} assets processados.`);
    console.log(`📁 Saída: ${outputDir}`);
    console.log(`\n📋 Para usar no jogo:`);
    console.log(`   1. Importe: import { IMPORTED_CUSTOM_ASSETS } from './assets/custom/imported-assets';`);
    console.log(`   2. Adicione ao profile.customAssets no localStorage`);
    console.log(`   3. Ou use a aba "Asset Studio" no jogo para equipar`);
  }
}

main().catch(console.error);