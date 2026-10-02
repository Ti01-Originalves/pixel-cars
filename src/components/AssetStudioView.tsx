import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  RotateCcw,
  RotateCw,
  Trash2,
  Save,
  Download,
  Upload,
  Check,
  Eye,
  Car as CarIcon,
  Sparkles,
  Grid,
  Zap,
  Sliders,
  Layers,
  Copy,
  FileCode,
  FolderOpen,
  ShieldCheck,
  Flame,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Compass,
  CheckCircle2,
  Coins,
  Plus,
  LayoutGrid,
  X
} from 'lucide-react';
import {
  AccessoryLayer,
  Car,
  ChassisAngle,
  CustomCarAccessoryConfig,
  CustomCarAsset,
  PlayerProfile
} from '../types';
import { drawCustomChassisCar, adjustBrightness } from '../utils/pixelCarEngine';
import { SPRITE_CAR_PRESETS } from '../data/carTemplates';

export interface AssetStudioViewProps {
  activeCar: Car;
  playerProfile?: PlayerProfile;
  customAssets?: CustomCarAsset[];
  onSaveAsset: (asset: CustomCarAsset) => void;
  onEquipAssetToCar: (carId: string, asset: CustomCarAsset) => void;
  onDeleteAsset?: (assetId: string) => void;
}

// -----------------------------------------------------------------------------
// CRYPTOGRAPHIC ENGINE FOR P2P TRADE & AUCTION VALIDATION
// -----------------------------------------------------------------------------
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

function createAssetCryptographicCredentials(
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

  return {
    encryptedHashId,
    creatorSignature,
    rarityScore: rawScore,
    auctionEstimateCoins
  };
}

// -----------------------------------------------------------------------------
// SILHOUETTE VECTOR CONTOUR CONVERTER
// -----------------------------------------------------------------------------
function generateVectorPathFromGrid(pixels: string[], w: number, h: number): string {
  const topPoints: { x: number; y: number }[] = [];
  const bottomPoints: { x: number; y: number }[] = [];

  let minCol = w;
  let maxCol = -1;

  for (let x = 0; x < w; x++) {
    let topY = -1;
    let botY = -1;
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
    return `M 6 18 C 6 15, 9 14, 12 14 L 17 14 C 20 10, 24 8, 30 8 L 34 8 C 38 8, 42 12, 44 14 L 46 16 C 46 18, 44 19, 41 19 C 39 19, 39 17, 36 17 C 33 17, 33 19, 21 19 C 19 19, 19 17, 16 17 C 13 17, 13 19, 8 19 Z`;
  }

  const smoothedTop: { x: number; y: number }[] = [];
  for (let i = 0; i < topPoints.length; i += 2) {
    smoothedTop.push(topPoints[i]);
  }
  if (smoothedTop[smoothedTop.length - 1]?.x !== topPoints[topPoints.length - 1]?.x) {
    smoothedTop.push(topPoints[topPoints.length - 1]);
  }

  const smoothedBottom: { x: number; y: number }[] = [];
  for (let i = bottomPoints.length - 1; i >= 0; i -= 2) {
    smoothedBottom.push(bottomPoints[i]);
  }
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
    const curr = smoothedBottom[i];
    pathStr += ` L ${curr.x} ${curr.y}`;
  }
  pathStr += ` Z`;
  return pathStr;
}

// -----------------------------------------------------------------------------
// GRID UTILITIES
// -----------------------------------------------------------------------------
function createEmptyGrid(w: number, h: number): string[] {
  return new Array(w * h).fill('');
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

// Extract dominant colors from the right profile to generate generic Front/Rear/Top views
export function extractColorsFromRightView(pixelsRight: string[]) {
  const counts: Record<string, number> = {};
  let hasPrimaryTag = false;
  let hasSecondaryTag = false;

  for (const c of pixelsRight) {
    if (!c || c === 'transparent' || c === '') continue;
    if (c.startsWith('__PRIMARY_')) {
      hasPrimaryTag = true;
      continue;
    }
    if (c.startsWith('__SECONDARY_')) {
      hasSecondaryTag = true;
      continue;
    }
    counts[c] = (counts[c] || 0) + 1;
  }

  const sortedColors = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  const bodyCandidates = sortedColors.filter(
    (c) => !['#000000', '#09090b', '#18181b', '#27272a', '#71717a'].includes(c.toLowerCase())
  );

  const primary = hasPrimaryTag
    ? '__PRIMARY_BASE__'
    : (bodyCandidates[0] || sortedColors[0] || '__PRIMARY_BASE__');

  const secondary = hasSecondaryTag
    ? '__SECONDARY_BASE__'
    : (bodyCandidates[1] || sortedColors.find((c) => ['#0f172a', '#18181b', '#334155'].includes(c.toLowerCase())) || '__SECONDARY_BASE__');

  // Detect windshield glass color
  const glassCandidates = sortedColors.filter((c) => {
    const lc = c.toLowerCase();
    return lc.includes('0369a1') || lc.includes('0284c7') || lc.includes('38bdf8') || lc.includes('0ea5e9') || lc.includes('67e8f9');
  });
  const glass = glassCandidates[0] || '#0369a1';

  // Detect headlight color
  const lampCandidates = sortedColors.filter((c) => {
    const lc = c.toLowerCase();
    return lc.includes('fef08a') || lc.includes('facc15') || lc.includes('eab308') || lc.includes('ffffff');
  });
  const lamp = lampCandidates[0] || '#fef08a';

  return {
    primary,
    secondary,
    glass,
    lamp,
    tail: '#ef4444',
    dark: '#09090b',
    tire: '#18181b'
  };
}

export function generateGenericFrontFromRight(pixelsRight: string[]): string[] {
  const w = 24, h = 24;
  const p = createEmptyGrid(w, h);
  const { primary: pri, secondary: sec, glass, lamp, dark, tire } = extractColorsFromRightView(pixelsRight);

  // Front lower bumper & air dam
  fillRect(p, w, h, 3, 17, 18, 2, sec);
  fillRect(p, w, h, 4, 14, 16, 3, pri);

  // Front radiator grille
  fillRect(p, w, h, 8, 15, 8, 2, dark);

  // Front Headlights
  fillRect(p, w, h, 4, 13, 3, 2, lamp);
  fillRect(p, w, h, 17, 13, 3, 2, lamp);

  // Hood central crease
  fillRect(p, w, h, 11, 14, 2, 2, sec);

  // Windshield & Glare
  fillRect(p, w, h, 6, 9, 12, 5, glass);
  fillRect(p, w, h, 8, 10, 3, 3, '#38bdf8');

  // Roof
  fillRect(p, w, h, 7, 8, 10, 1, pri);

  // Front Camber Tires
  fillRect(p, w, h, 2, 16, 2, 3, tire);
  fillRect(p, w, h, 20, 16, 2, 3, tire);

  return p;
}

export function generateGenericRearFromRight(pixelsRight: string[]): string[] {
  const w = 24, h = 24;
  const p = createEmptyGrid(w, h);
  const { primary: pri, secondary: sec, glass, tail, dark, tire } = extractColorsFromRightView(pixelsRight);

  // Rear diffuser & bumper
  fillRect(p, w, h, 3, 17, 18, 2, sec);
  fillRect(p, w, h, 4, 14, 16, 3, pri);

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
  fillRect(p, w, h, 7, 8, 10, 1, pri);

  // Aero spoiler top wing
  fillRect(p, w, h, 3, 6, 18, 1, sec);
  fillRect(p, w, h, 6, 7, 1, 2, sec);
  fillRect(p, w, h, 17, 7, 1, 2, sec);

  // Wide Rear Tires
  fillRect(p, w, h, 2, 16, 2, 3, tire);
  fillRect(p, w, h, 20, 16, 2, 3, tire);

  return p;
}

export function generateGenericTopFromRight(pixelsRight: string[]): string[] {
  const w = 48, h = 24;
  const p = createEmptyGrid(w, h);
  const { primary: pri, secondary: sec, glass, tire } = extractColorsFromRightView(pixelsRight);

  // Main car hull
  fillRect(p, w, h, 6, 5, 36, 14, pri);

  // Hood styling (front facing right)
  fillRect(p, w, h, 34, 10, 8, 4, sec);

  // Windshield
  fillRect(p, w, h, 26, 6, 6, 12, glass);

  // Roof
  fillRect(p, w, h, 18, 6, 8, 12, pri);

  // Rear windshield
  fillRect(p, w, h, 12, 6, 6, 12, glass);

  // Rear wing blade
  fillRect(p, w, h, 4, 4, 2, 16, sec);

  // Side mirrors
  fillRect(p, w, h, 28, 3, 2, 2, pri);
  fillRect(p, w, h, 28, 19, 2, 2, pri);

  // 4 Tires at corners
  fillRect(p, w, h, 10, 3, 6, 2, tire);
  fillRect(p, w, h, 10, 19, 6, 2, tire);
  fillRect(p, w, h, 32, 3, 6, 2, tire);
  fillRect(p, w, h, 32, 19, 6, 2, tire);

  // Front splitter
  fillRect(p, w, h, 42, 7, 2, 10, sec);

  return p;
}

// -----------------------------------------------------------------------------
// MULTI-VIEW PRESET TEMPLATES
// -----------------------------------------------------------------------------
interface MultiViewPreset {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  neonColor: string;
  generateRight: () => string[];
  generateLeft: () => string[];
  generateFront: () => string[];
  generateRear: () => string[];
  generateTop: () => string[];
  accessoryConfig: CustomCarAccessoryConfig;
}

const MULTI_VIEW_PRESETS: Record<string, MultiViewPreset> = {
  ...SPRITE_CAR_PRESETS,
  tuner_mk4: {
    name: 'Tuner MK4 Supra (Oficial)',
    description: 'Chassi lendário japonês com curvatura aerodinâmica suave, faróis duplos xenon, asa Supra integrada e intercooler frontal FMIC',
    primaryColor: '#e11d48',
    secondaryColor: '#09090b',
    neonColor: '#f43f5e',
    accessoryConfig: {
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'spokes',
        spinning: true
      },
      spoiler: {
        visible: true,
        x: 4,
        y: 7,
        scale: 1,
        layer: 'in_front',
        style: 'gt_wing'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 42,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: true,
        color: '#f43f5e',
        y: 20
      }
    },
    generateRight: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const hi = '__PRIMARY_HI__';
      const light = '__PRIMARY_LIGHT__';
      const pri = '__PRIMARY_BASE__';
      const dark = '__PRIMARY_DARK__';
      const deep = '__PRIMARY_DEEP__';
      const sec = '__SECONDARY_BASE__';
      const secDark = '__SECONDARY_DARK__';
      const glass = '#0f172a';
      const glassSky = '#38bdf8';
      const glassGlare = '#e0f2fe';
      const xenon = '#e0f2fe';
      const amber = '#fef08a';
      const tail = '#ef4444';
      const ruby = '#dc2626';

      // 1. Carbon Splitter & Side Skirts (Y = 19)
      fillRect(p, w, h, 4, 19, 41, 1, sec);
      fillRect(p, w, h, 43, 19, 2, 1, secDark);
      fillRect(p, w, h, 3, 19, 3, 1, secDark);

      // 2. Lower Body Shadow & Rocker Seam (Y = 18)
      fillRect(p, w, h, 4, 18, 41, 1, deep);
      fillRect(p, w, h, 5, 17, 39, 1, dark);

      // 3. Main Muscular Body Waistline (Y = 15 - 16)
      fillRect(p, w, h, 4, 15, 41, 2, pri);

      // 4. Upper Haunch & Hood Light Reflection (Y = 14)
      fillRect(p, w, h, 5, 14, 39, 1, light);

      // 5. Sunlit Specular Ridge (Y = 13)
      fillRect(p, w, h, 28, 13, 14, 1, hi);
      fillRect(p, w, h, 5, 13, 10, 1, hi);

      // 6. Front Intercooler Mouth (FMIC) & aluminum cooling tubes
      fillRect(p, w, h, 40, 16, 4, 3, '#09090b');
      fillRect(p, w, h, 41, 17, 3, 1, '#94a3b8');
      fillRect(p, w, h, 41, 18, 3, 1, '#cbd5e1');

      // 7. Hood Twin Vents
      fillRect(p, w, h, 33, 13, 2, 1, '#09090b');
      fillRect(p, w, h, 37, 13, 2, 1, '#09090b');

      // 8. Streamlined Cabin & Glass
      fillRect(p, w, h, 14, 10, 19, 4, glass);
      fillRect(p, w, h, 18, 9, 11, 1, glass);

      // Roof panel
      fillRect(p, w, h, 18, 8, 10, 1, pri);
      fillRect(p, w, h, 19, 8, 8, 1, hi);

      // Sky reflection blades across windshield & side glass
      fillRect(p, w, h, 27, 10, 4, 4, glassSky);
      fillRect(p, w, h, 29, 9, 2, 5, glassGlare);
      fillRect(p, w, h, 20, 10, 3, 3, glassSky);

      // Driver silhouette & steering wheel
      fillRect(p, w, h, 23, 11, 2, 2, '#1e293b');
      fillRect(p, w, h, 26, 11, 1, 3, '#09090b');

      // B-pillar divider
      fillRect(p, w, h, 25, 9, 1, 5, sec);

      // 9. Aerodynamic Supra Rear Spoiler
      fillRect(p, w, h, 4, 10, 4, 1, pri);
      fillRect(p, w, h, 4, 9, 4, 1, hi);
      fillRect(p, w, h, 4, 11, 1, 4, sec);
      fillRect(p, w, h, 7, 11, 1, 4, sec);

      // 10. Front Headlight Cluster (xenon projector + amber signal)
      fillRect(p, w, h, 43, 14, 2, 1, xenon);
      fillRect(p, w, h, 42, 14, 1, 1, amber);
      fillRect(p, w, h, 43, 15, 2, 1, '#64748b');

      // 11. Rear Taillight Quad Rings
      fillRect(p, w, h, 4, 14, 1, 1, ruby);
      fillRect(p, w, h, 4, 15, 1, 1, tail);
      fillRect(p, w, h, 5, 14, 1, 1, amber);

      // 12. Wheel Arch Openings (clean wheel wells at X=10 and X=38)
      fillRect(p, w, h, 7, 17, 7, 3, '');
      fillRect(p, w, h, 35, 17, 7, 3, '');
      fillRect(p, w, h, 8, 16, 5, 1, '#09090b');
      fillRect(p, w, h, 36, 16, 5, 1, '#09090b');

      return p;
    },
    generateLeft: () => {
      const right = MULTI_VIEW_PRESETS.tuner_mk4.generateRight();
      return mirrorGridHorizontally(right, 48, 24);
    },
    generateFront: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', hi = '__PRIMARY_HI__', sec = '__SECONDARY_BASE__';
      const glass = '#0f172a', sky = '#38bdf8';

      fillRect(p, w, h, 2, 19, 20, 1, sec);
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      fillRect(p, w, h, 7, 16, 10, 3, '#09090b');
      fillRect(p, w, h, 8, 17, 8, 2, '#94a3b8');
      fillRect(p, w, h, 3, 14, 3, 1, '#e0f2fe');
      fillRect(p, w, h, 18, 14, 3, 1, '#e0f2fe');
      fillRect(p, w, h, 4, 15, 1, 1, '#fef08a');
      fillRect(p, w, h, 19, 15, 1, 1, '#fef08a');
      fillRect(p, w, h, 5, 13, 14, 2, pri);
      fillRect(p, w, h, 6, 12, 12, 1, hi);
      fillRect(p, w, h, 6, 8, 12, 4, glass);
      fillRect(p, w, h, 9, 8, 3, 4, sky);
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateRear: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      const tail = '#ef4444', ruby = '#dc2626';

      fillRect(p, w, h, 3, 19, 18, 1, sec);
      fillRect(p, w, h, 5, 18, 2, 2, '#94a3b8');
      fillRect(p, w, h, 5, 19, 2, 1, '#09090b');
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      fillRect(p, w, h, 4, 14, 4, 2, '#09090b');
      fillRect(p, w, h, 16, 14, 4, 2, '#09090b');
      fillRect(p, w, h, 4, 14, 1, 1, ruby);
      fillRect(p, w, h, 6, 14, 1, 1, tail);
      fillRect(p, w, h, 17, 14, 1, 1, tail);
      fillRect(p, w, h, 19, 14, 1, 1, ruby);
      fillRect(p, w, h, 6, 8, 12, 5, '#0f172a');
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      fillRect(p, w, h, 3, 6, 18, 1, pri);
      fillRect(p, w, h, 5, 7, 1, 2, sec);
      fillRect(p, w, h, 18, 7, 1, 2, sec);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateTop: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__', hi = '__PRIMARY_HI__';
      fillRect(p, w, h, 4, 4, 40, 16, pri);
      fillRect(p, w, h, 32, 7, 8, 10, hi);
      fillRect(p, w, h, 20, 6, 11, 12, '#0f172a');
      fillRect(p, w, h, 24, 6, 5, 12, pri);
      fillRect(p, w, h, 12, 6, 7, 12, '#0f172a');
      fillRect(p, w, h, 4, 4, 2, 16, sec);
      fillRect(p, w, h, 43, 6, 2, 12, sec);
      fillRect(p, w, h, 8, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 8, 20, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 20, 5, 2, '#18181b');
      return p;
    }
  },

  muscle_gt500: {
    name: 'Muscle GT500 Eleanor (Oficial)',
    description: 'Carro clássico musculoso com nariz agressivo, cowl scoop no capô, saídas de escape laterais cromadas e persianas traseiras',
    primaryColor: '#71717a',
    secondaryColor: '#18181b',
    neonColor: '#f97316',
    accessoryConfig: {
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'steelies',
        spinning: true
      },
      spoiler: {
        visible: true,
        x: 4,
        y: 11,
        scale: 1,
        layer: 'in_front',
        style: 'ducktail'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 43,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: true,
        color: '#f97316',
        y: 20
      }
    },
    generateRight: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const hi = '__PRIMARY_HI__';
      const light = '__PRIMARY_LIGHT__';
      const pri = '__PRIMARY_BASE__';
      const dark = '__PRIMARY_DARK__';
      const deep = '__PRIMARY_DEEP__';
      const sec = '__SECONDARY_BASE__';
      const secHi = '__SECONDARY_HI__';
      const chrome = '#e2e8f0';
      const glass = '#0f172a';
      const lamp = '#fef08a';
      const ruby = '#dc2626';

      // 1. Bottom Rocker & Chrome Side Exhaust Exit
      fillRect(p, w, h, 4, 19, 41, 1, sec);
      fillRect(p, w, h, 20, 19, 4, 1, chrome); // side exhaust tip

      // 2. Lower Body Shadow & Creases
      fillRect(p, w, h, 4, 18, 41, 1, deep);
      fillRect(p, w, h, 5, 17, 39, 1, dark);

      // 3. Eleanor Racing Stripes & Muscular Body
      fillRect(p, w, h, 4, 15, 41, 2, pri);
      fillRect(p, w, h, 4, 14, 41, 1, light);

      // Le Mans Twin Black Racing Stripes
      fillRect(p, w, h, 26, 14, 16, 1, sec);
      fillRect(p, w, h, 4, 14, 8, 1, sec);

      // 4. Cowl Induction Hood Scoop
      fillRect(p, w, h, 30, 12, 8, 2, pri);
      fillRect(p, w, h, 30, 12, 8, 1, hi);
      fillRect(p, w, h, 37, 13, 2, 1, '#09090b'); // scoop intake

      // 5. Muscular Rear Haunch (Coke-Bottle Hip)
      fillRect(p, w, h, 6, 13, 10, 1, hi);

      // 6. Fastback Cabin with Sail Panel Louvers
      fillRect(p, w, h, 14, 9, 17, 5, glass);
      fillRect(p, w, h, 16, 8, 11, 1, pri);
      fillRect(p, w, h, 17, 8, 8, 1, hi);
      // Fastback louvers
      fillRect(p, w, h, 15, 10, 1, 3, pri);
      fillRect(p, w, h, 17, 10, 1, 3, pri);
      fillRect(p, w, h, 19, 10, 1, 3, pri);

      // 7. Chrome Front Bumperette & Quad Round Headlights
      fillRect(p, w, h, 43, 17, 2, 2, chrome);
      fillRect(p, w, h, 3, 17, 2, 2, chrome);
      fillRect(p, w, h, 43, 14, 2, 2, lamp);
      fillRect(p, w, h, 41, 14, 1, 2, '#94a3b8');

      // 8. Triple Vertical Taillights
      fillRect(p, w, h, 3, 14, 1, 1, ruby);
      fillRect(p, w, h, 3, 15, 1, 1, ruby);
      fillRect(p, w, h, 3, 16, 1, 1, ruby);

      // 9. Wheel Arches
      fillRect(p, w, h, 7, 17, 7, 3, '');
      fillRect(p, w, h, 35, 17, 7, 3, '');
      fillRect(p, w, h, 8, 16, 5, 1, '#09090b');
      fillRect(p, w, h, 36, 16, 5, 1, '#09090b');

      return p;
    },
    generateLeft: () => {
      const right = MULTI_VIEW_PRESETS.muscle_gt500.generateRight();
      return mirrorGridHorizontally(right, 48, 24);
    },
    generateFront: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__', chrome = '#e2e8f0', lamp = '#fef08a';

      fillRect(p, w, h, 3, 18, 18, 2, chrome);
      fillRect(p, w, h, 4, 14, 16, 4, pri);
      // Twin stripes
      fillRect(p, w, h, 10, 10, 2, 8, sec);
      fillRect(p, w, h, 13, 10, 2, 8, sec);
      // Grille & fog lights
      fillRect(p, w, h, 6, 15, 12, 3, '#09090b');
      fillRect(p, w, h, 9, 15, 2, 2, lamp);
      fillRect(p, w, h, 14, 15, 2, 2, lamp);
      // Outer headlights
      fillRect(p, w, h, 4, 14, 2, 2, lamp);
      fillRect(p, w, h, 18, 14, 2, 2, lamp);
      // Cowl bulge & windshield
      fillRect(p, w, h, 9, 11, 6, 2, pri);
      fillRect(p, w, h, 6, 8, 12, 5, '#0f172a');
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      // Tires
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateRear: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__', ruby = '#dc2626', chrome = '#e2e8f0';

      fillRect(p, w, h, 3, 18, 18, 2, chrome);
      fillRect(p, w, h, 4, 13, 16, 5, pri);
      fillRect(p, w, h, 6, 14, 12, 3, '#09090b');
      // Triple vertical taillights
      fillRect(p, w, h, 6, 14, 1, 3, ruby);
      fillRect(p, w, h, 8, 14, 1, 3, ruby);
      fillRect(p, w, h, 10, 14, 1, 3, ruby);
      fillRect(p, w, h, 14, 14, 1, 3, ruby);
      fillRect(p, w, h, 16, 14, 1, 3, ruby);
      fillRect(p, w, h, 18, 14, 1, 3, ruby);
      // Window & ducktail
      fillRect(p, w, h, 6, 8, 12, 5, '#0f172a');
      fillRect(p, w, h, 4, 12, 16, 1, pri);
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateTop: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      fillRect(p, w, h, 4, 4, 40, 16, pri);
      // Twin racing stripes down the center
      fillRect(p, w, h, 4, 10, 40, 2, sec);
      fillRect(p, w, h, 4, 13, 40, 2, sec);
      // Cabin & Cowl
      fillRect(p, w, h, 17, 6, 13, 12, '#0f172a');
      fillRect(p, w, h, 30, 9, 8, 6, '#475569');
      // Tires
      fillRect(p, w, h, 8, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 8, 20, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 20, 5, 2, '#18181b');
      return p;
    }
  },

  supercar_gt3: {
    name: 'Supercar GT3 RS (Oficial)',
    description: 'Hipercarro de pista ultra-baixo com perfil aerodinâmico afiado, asa alta swan-neck de carbono e tomadas de ar laterais',
    primaryColor: '#059669',
    secondaryColor: '#09090b',
    neonColor: '#10b981',
    accessoryConfig: {
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'mesh',
        spinning: true
      },
      spoiler: {
        visible: true,
        x: 4,
        y: 6,
        scale: 1.1,
        layer: 'in_front',
        style: 'gt_wing'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 43,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: true,
        color: '#10b981',
        y: 20
      }
    },
    generateRight: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const hi = '__PRIMARY_HI__';
      const light = '__PRIMARY_LIGHT__';
      const pri = '__PRIMARY_BASE__';
      const dark = '__PRIMARY_DARK__';
      const deep = '__PRIMARY_DEEP__';
      const sec = '__SECONDARY_BASE__';
      const glass = '#0f172a';
      const glassSky = '#34d399';

      // 1. Carbon Aero Splitter & Side Skirts
      fillRect(p, w, h, 3, 19, 43, 1, sec);
      fillRect(p, w, h, 44, 19, 2, 1, sec);

      // 2. Low-slung wedge body
      fillRect(p, w, h, 4, 18, 41, 1, deep);
      fillRect(p, w, h, 4, 17, 40, 1, dark);
      fillRect(p, w, h, 4, 15, 41, 2, pri);
      fillRect(p, w, h, 5, 14, 38, 1, light);
      fillRect(p, w, h, 28, 13, 14, 1, hi);

      // 3. Side Carbon Air Scoop / Intercooler Duct
      fillRect(p, w, h, 16, 14, 4, 4, '#09090b');
      fillRect(p, w, h, 17, 14, 2, 3, sec);

      // 4. Low Canopy & Glass
      fillRect(p, w, h, 16, 9, 16, 5, glass);
      fillRect(p, w, h, 20, 8, 8, 1, pri);
      fillRect(p, w, h, 21, 8, 6, 1, hi);
      fillRect(p, w, h, 26, 9, 3, 4, glassSky);

      // 5. Swan-neck GT Wing (High mount)
      fillRect(p, w, h, 3, 7, 7, 1, sec);
      fillRect(p, w, h, 5, 8, 1, 6, sec);
      fillRect(p, w, h, 8, 8, 1, 6, sec);

      // 6. Laser Headlights & Lightbar Taillights
      fillRect(p, w, h, 43, 14, 2, 1, '#a7f3d0');
      fillRect(p, w, h, 4, 14, 1, 1, '#ef4444');

      // 7. Wheel Arches
      fillRect(p, w, h, 7, 17, 7, 3, '');
      fillRect(p, w, h, 35, 17, 7, 3, '');
      fillRect(p, w, h, 8, 16, 5, 1, '#09090b');
      fillRect(p, w, h, 36, 16, 5, 1, '#09090b');

      return p;
    },
    generateLeft: () => {
      const right = MULTI_VIEW_PRESETS.supercar_gt3.generateRight();
      return mirrorGridHorizontally(right, 48, 24);
    },
    generateFront: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__', hi = '__PRIMARY_HI__';

      fillRect(p, w, h, 1, 19, 22, 1, sec);
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      fillRect(p, w, h, 5, 16, 14, 3, '#09090b');
      fillRect(p, w, h, 3, 13, 3, 2, '#a7f3d0');
      fillRect(p, w, h, 18, 13, 3, 2, '#a7f3d0');
      fillRect(p, w, h, 6, 12, 12, 2, hi);
      fillRect(p, w, h, 6, 8, 12, 4, '#0f172a');
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateRear: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';

      fillRect(p, w, h, 2, 19, 20, 1, sec);
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      // Continuous LED lightbar
      fillRect(p, w, h, 4, 14, 16, 1, '#ef4444');
      fillRect(p, w, h, 6, 8, 12, 5, '#0f172a');
      // GT Swan Neck Wing
      fillRect(p, w, h, 2, 5, 20, 1, sec);
      fillRect(p, w, h, 6, 6, 1, 4, sec);
      fillRect(p, w, h, 17, 6, 1, 4, sec);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateTop: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      fillRect(p, w, h, 4, 4, 40, 16, pri);
      fillRect(p, w, h, 18, 7, 14, 10, '#0f172a');
      fillRect(p, w, h, 3, 3, 3, 18, sec); // carbon wing
      fillRect(p, w, h, 43, 6, 2, 12, sec); // splitter
      fillRect(p, w, h, 8, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 8, 20, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 20, 5, 2, '#18181b');
      return p;
    }
  },

  apex_gt: {
    name: 'Apex GT Wedge (Oficial)',
    description: 'Chassi aerodinâmico estilo supercarro GT moderno com linhas agressivas e iluminação xenon',
    primaryColor: '#3b82f6',
    secondaryColor: '#0f172a',
    neonColor: '#38bdf8',
    accessoryConfig: {
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'spokes',
        spinning: true
      },
      spoiler: {
        visible: true,
        x: 4,
        y: 7,
        scale: 1,
        layer: 'behind',
        style: 'gt_wing'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 42,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: true,
        color: '#38bdf8',
        y: 20
      }
    },
    generateRight: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const hi = '__PRIMARY_HI__';
      const pri = '__PRIMARY_BASE__';
      const dark = '__PRIMARY_DARK__';
      const deep = '__PRIMARY_DEEP__';
      const sec = '__SECONDARY_BASE__';
      const glass = '#0369a1', lamp = '#fef08a', tail = '#ef4444';

      fillRect(p, w, h, 4, 19, 41, 1, sec);
      fillRect(p, w, h, 4, 18, 41, 1, deep);
      fillRect(p, w, h, 5, 17, 39, 1, dark);
      fillRect(p, w, h, 4, 15, 41, 2, pri);
      fillRect(p, w, h, 28, 13, 14, 1, hi);

      fillRect(p, w, h, 16, 8, 16, 1, pri);
      fillRect(p, w, h, 18, 9, 7, 4, glass);
      fillRect(p, w, h, 26, 9, 6, 4, glass);
      fillRect(p, w, h, 25, 9, 1, 4, sec);

      fillRect(p, w, h, 43, 14, 2, 2, lamp);
      fillRect(p, w, h, 4, 14, 1, 2, tail);

      fillRect(p, w, h, 4, 8, 5, 1, sec);
      fillRect(p, w, h, 5, 9, 1, 4, sec);
      fillRect(p, w, h, 8, 9, 1, 4, sec);

      fillRect(p, w, h, 7, 17, 7, 3, '');
      fillRect(p, w, h, 35, 17, 7, 3, '');
      fillRect(p, w, h, 8, 16, 5, 1, '#09090b');
      fillRect(p, w, h, 36, 16, 5, 1, '#09090b');
      return p;
    },
    generateLeft: () => {
      const right = MULTI_VIEW_PRESETS.apex_gt.generateRight();
      return mirrorGridHorizontally(right, 48, 24);
    },
    generateFront: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      fillRect(p, w, h, 2, 19, 20, 1, sec);
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      fillRect(p, w, h, 7, 16, 10, 3, '#09090b');
      fillRect(p, w, h, 3, 14, 3, 2, '#fef08a');
      fillRect(p, w, h, 18, 14, 3, 2, '#fef08a');
      fillRect(p, w, h, 6, 8, 12, 5, '#0369a1');
      fillRect(p, w, h, 7, 7, 10, 1, pri);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateRear: () => {
      const w = 24, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      fillRect(p, w, h, 3, 19, 18, 1, sec);
      fillRect(p, w, h, 3, 15, 18, 4, pri);
      fillRect(p, w, h, 4, 14, 4, 2, '#ef4444');
      fillRect(p, w, h, 16, 14, 4, 2, '#ef4444');
      fillRect(p, w, h, 6, 8, 12, 5, '#0369a1');
      fillRect(p, w, h, 3, 6, 18, 1, sec);
      fillRect(p, w, h, 1, 16, 2, 4, '#18181b');
      fillRect(p, w, h, 21, 16, 2, 4, '#18181b');
      return p;
    },
    generateTop: () => {
      const w = 48, h = 24;
      const p = createEmptyGrid(w, h);
      const pri = '__PRIMARY_BASE__', sec = '__SECONDARY_BASE__';
      fillRect(p, w, h, 4, 4, 40, 16, pri);
      fillRect(p, w, h, 18, 6, 16, 12, '#0369a1');
      fillRect(p, w, h, 4, 3, 6, 18, sec);
      fillRect(p, w, h, 8, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 8, 20, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 2, 5, 2, '#18181b');
      fillRect(p, w, h, 36, 20, 5, 2, '#18181b');
      return p;
    }
  },

  blank: {
    name: 'Tela em Branco (Novo Modelo)',
    description: 'Comece do zero com canvas 100% limpo e escala milimétrica calibrada com os carros oficiais',
    primaryColor: '#3b82f6',
    secondaryColor: '#0f172a',
    neonColor: '#38bdf8',
    accessoryConfig: {
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'spokes',
        spinning: true
      },
      spoiler: {
        visible: false,
        x: 4,
        y: 8,
        scale: 1,
        layer: 'behind',
        style: 'gt_wing'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 42,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: false,
        color: '#38bdf8',
        y: 20
      }
    },
    generateRight: () => createEmptyGrid(48, 24),
    generateLeft: () => createEmptyGrid(48, 24),
    generateFront: () => createEmptyGrid(24, 24),
    generateRear: () => createEmptyGrid(24, 24),
    generateTop: () => createEmptyGrid(48, 24)
  }
};

const PresetThumbnailCanvas: React.FC<{ presetKey: string; scale?: number }> = ({ presetKey, scale = 2.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const preset = MULTI_VIEW_PRESETS[presetKey];
    if (!preset) return;

    const mockAsset: CustomCarAsset = {
      id: presetKey,
      name: preset.name,
      createdAt: 0,
      width: 48,
      height: 24,
      pixels: preset.generateRight(),
      pixelsLeft: preset.generateLeft(),
      pixelsFront: preset.generateFront(),
      pixelsRear: preset.generateRear(),
      pixelsTop: preset.generateTop(),
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      neonColor: preset.neonColor,
      accessoryConfig: preset.accessoryConfig
    };

    const mockCar: Car = {
      id: 'mock_preview_' + presetKey,
      name: preset.name,
      starterTier: 'torque_focus',
      condition: 'brand_new',
      rarity: 'legendary',
      baseStats: { topSpeed: 20, acceleration: 20, torque: 20 },
      visuals: {
        bodyType: 'supercar',
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        neonColor: preset.neonColor,
        hasNeon: true,
        spoiler: preset.accessoryConfig.spoiler.style,
        wheelStyle: preset.accessoryConfig.wheels.style
      },
      equippedParts: {},
      totalRaces: 0,
      wins: 0,
      acquiredAt: 0
    };

    drawCustomChassisCar(
      ctx,
      mockCar,
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      scale,
      'right',
      90,
      0,
      false,
      false,
      mockAsset
    );
  }, [presetKey, scale]);

  return <canvas ref={canvasRef} width={160} height={80} className="w-full h-auto bg-slate-950/80 rounded-lg border border-slate-800/80 shadow-inner" />;
};

const COLOR_SWATCHES = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#a855f7', '#ec4899', '#06b6d4', '#f97316',
  '#e2e8f0', '#94a3b8', '#0f172a', '#18181b',
  '#fef08a', '#38bdf8', '#22c55e', '#ffffff'
];

export const AssetStudioView: React.FC<AssetStudioViewProps> = ({
  activeCar,
  playerProfile,
  customAssets = [],
  onSaveAsset,
  onEquipAssetToCar,
  onDeleteAsset
}) => {
  // 1. Current Active View Angle for the Editor Grid
  const [activeAngle, setActiveAngle] = useState<ChassisAngle>('right');

  // 2. Grids for all 5 cardinal views:
  // - Right: 48x24
  // - Left: 48x24
  // - Front: 24x24
  // - Rear: 24x24
  // - Top: 48x24
  const [pixelsRight, setPixelsRight] = useState<string[]>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixels)) return parsed.pixels;
      } catch {}
    }
    return MULTI_VIEW_PRESETS.apex_gt.generateRight();
  });

  const [pixelsLeft, setPixelsLeft] = useState<string[]>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixels)) {
          return mirrorGridHorizontally(parsed.pixels, 48, 24);
        }
      } catch {}
    }
    return mirrorGridHorizontally(MULTI_VIEW_PRESETS.apex_gt.generateRight(), 48, 24);
  });

  const [pixelsFront, setPixelsFront] = useState<string[]>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixelsFront)) return parsed.pixelsFront;
      } catch {}
    }
    return MULTI_VIEW_PRESETS.apex_gt.generateFront();
  });

  const [pixelsRear, setPixelsRear] = useState<string[]>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixelsRear)) return parsed.pixelsRear;
      } catch {}
    }
    return MULTI_VIEW_PRESETS.apex_gt.generateRear();
  });

  const [pixelsTop, setPixelsTop] = useState<string[]>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixelsTop)) return parsed.pixelsTop;
      } catch {}
    }
    return MULTI_VIEW_PRESETS.apex_gt.generateTop();
  });

  // Current Grid Dimensions based on active view
  const currentGridWidth = activeAngle === 'front' || activeAngle === 'rear' ? 24 : 48;
  const currentGridHeight = 24;

  // Active Pixels accessor & mutator
  const activePixels = useMemo(() => {
    switch (activeAngle) {
      case 'left': return pixelsLeft;
      case 'front': return pixelsFront;
      case 'rear': return pixelsRear;
      case 'top': return pixelsTop;
      case 'right':
      default:
        return pixelsRight;
    }
  }, [activeAngle, pixelsRight, pixelsLeft, pixelsFront, pixelsRear, pixelsTop]);

  // Auto-mirror toggle: Left view is always horizontally mirrored Right view
  const [autoMirrorLeft, setAutoMirrorLeft] = useState<boolean>(true);
  const [genericGeneratedToast, setGenericGeneratedToast] = useState<string | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<'all' | 'JDM' | 'Muscle' | 'Supercar' | 'Rally'>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  const [equipSuccessToast, setEquipSuccessToast] = useState<string | null>(null);

  const setActivePixels = useCallback((newPixels: string[]) => {
    switch (activeAngle) {
      case 'left':
        setPixelsLeft(newPixels);
        break;
      case 'front':
        setPixelsFront(newPixels);
        break;
      case 'rear':
        setPixelsRear(newPixels);
        break;
      case 'top':
        setPixelsTop(newPixels);
        break;
      case 'right':
      default:
        setPixelsRight(newPixels);
        if (autoMirrorLeft) {
          const mirrored = mirrorGridHorizontally(newPixels, 48, 24);
          setPixelsLeft(mirrored);
        }
        break;
    }
  }, [activeAngle, autoMirrorLeft]);

  // Sync when active car's custom chassis data changes or loads
  useEffect(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && Array.isArray(parsed.pixels)) {
          setPixelsRight(parsed.pixels);
          setPixelsLeft(mirrorGridHorizontally(parsed.pixels, 48, 24));
          if (Array.isArray(parsed.pixelsFront)) setPixelsFront(parsed.pixelsFront);
          if (Array.isArray(parsed.pixelsRear)) setPixelsRear(parsed.pixelsRear);
          if (Array.isArray(parsed.pixelsTop)) setPixelsTop(parsed.pixelsTop);
          if (parsed.name) setAssetName(parsed.name);
          if (parsed.accessoryConfig) setAccessories(parsed.accessoryConfig);
        }
      } catch {}
    }
  }, [activeCar.id, activeCar.visuals.customPixelData]);

  // Guarantee left view mirrors right profile whenever selecting left angle if autoMirrorLeft is active
  useEffect(() => {
    if (activeAngle === 'left' && autoMirrorLeft) {
      setPixelsLeft(mirrorGridHorizontally(pixelsRight, 48, 24));
    }
  }, [activeAngle, autoMirrorLeft, pixelsRight]);

  // History Stacks per Angle
  const [history, setHistory] = useState<Record<ChassisAngle, string[][]>>({
    right: [pixelsRight],
    left: [pixelsLeft],
    front: [pixelsFront],
    rear: [pixelsRear],
    top: [pixelsTop]
  });
  const [historyIndices, setHistoryIndices] = useState<Record<ChassisAngle, number>>({
    right: 0,
    left: 0,
    front: 0,
    rear: 0,
    top: 0
  });

  const pushHistory = useCallback((angle: ChassisAngle, newPixels: string[]) => {
    setHistory((prev) => {
      const curIndex = historyIndices[angle];
      const stack = prev[angle].slice(0, curIndex + 1);
      return {
        ...prev,
        [angle]: [...stack, newPixels]
      };
    });
    setHistoryIndices((prev) => ({
      ...prev,
      [angle]: prev[angle] + 1
    }));
  }, [historyIndices]);

  // Generate generic Front, Rear, and Top views from Right profile colors
  const handleGenerateAllGenericViews = useCallback(() => {
    const front = generateGenericFrontFromRight(pixelsRight);
    const rear = generateGenericRearFromRight(pixelsRight);
    const top = generateGenericTopFromRight(pixelsRight);
    const left = mirrorGridHorizontally(pixelsRight, 48, 24);

    setPixelsFront(front);
    setPixelsRear(rear);
    setPixelsTop(top);
    setPixelsLeft(left);

    pushHistory('front', front);
    pushHistory('rear', rear);
    pushHistory('top', top);
    pushHistory('left', left);

    setGenericGeneratedToast('Vistas Frente, Trás e Cima geradas com as cores da Direita! Pronto para retoques.');
    setTimeout(() => setGenericGeneratedToast(null), 3500);
  }, [pixelsRight, pushHistory]);

  const handleGenerateSingleGenericView = useCallback((angle: ChassisAngle) => {
    if (angle === 'front') {
      const front = generateGenericFrontFromRight(pixelsRight);
      setPixelsFront(front);
      pushHistory('front', front);
      setGenericGeneratedToast('Frente genérica gerada com as cores da Direita!');
    } else if (angle === 'rear') {
      const rear = generateGenericRearFromRight(pixelsRight);
      setPixelsRear(rear);
      pushHistory('rear', rear);
      setGenericGeneratedToast('Traseira genérica gerada com as cores da Direita!');
    } else if (angle === 'top') {
      const top = generateGenericTopFromRight(pixelsRight);
      setPixelsTop(top);
      pushHistory('top', top);
      setGenericGeneratedToast('Vista de Cima gerada com as cores da Direita!');
    } else if (angle === 'left') {
      const left = mirrorGridHorizontally(pixelsRight, 48, 24);
      setPixelsLeft(left);
      pushHistory('left', left);
      setGenericGeneratedToast('Lado Esquerdo sincronizado como espelho horizontal da Direita!');
    }
    setTimeout(() => setGenericGeneratedToast(null), 3000);
  }, [pixelsRight, pushHistory]);

  const handleUndo = () => {
    const curIndex = historyIndices[activeAngle];
    if (curIndex > 0) {
      const prevPixels = history[activeAngle][curIndex - 1];
      setActivePixels(prevPixels);
      setHistoryIndices((prev) => ({ ...prev, [activeAngle]: curIndex - 1 }));
    }
  };

  const handleRedo = () => {
    const curIndex = historyIndices[activeAngle];
    const stack = history[activeAngle];
    if (curIndex < stack.length - 1) {
      const nextPixels = stack[curIndex + 1];
      setActivePixels(nextPixels);
      setHistoryIndices((prev) => ({ ...prev, [activeAngle]: curIndex + 1 }));
    }
  };

  // 3. Accessory Positioning & Layering Configuration
  const [accessories, setAccessories] = useState<CustomCarAccessoryConfig>(() => {
    if (activeCar.visuals.customPixelData) {
      try {
        const parsed = JSON.parse(activeCar.visuals.customPixelData);
        if (parsed && parsed.accessoryConfig) return parsed.accessoryConfig;
      } catch {}
    }
    return MULTI_VIEW_PRESETS.apex_gt.accessoryConfig;
  });

  // 4. Colors & Dynamic Base Color Tokens
  // Supports dynamic tokens with smooth shading:
  // __PRIMARY_HI__, __PRIMARY_LIGHT__, __PRIMARY_BASE__, __PRIMARY_DARK__, __PRIMARY_DEEP__
  // __SECONDARY_HI__, __SECONDARY_BASE__, __SECONDARY_DARK__
  const [paintMode, setPaintMode] = useState<string>('__PRIMARY_BASE__');
  const [customPaintColor, setCustomPaintColor] = useState<string>('#3b82f6');

  // Preview live color overrides (to test dynamic color changes in real time)
  const [previewPrimaryColor, setPreviewPrimaryColor] = useState<string>(activeCar.visuals.primaryColor || '#3b82f6');
  const [previewSecondaryColor, setPreviewSecondaryColor] = useState<string>(activeCar.visuals.secondaryColor || '#0f172a');
  const [previewNeonColor, setPreviewNeonColor] = useState<string>(accessories.neon.color || activeCar.visuals.neonColor || '#38bdf8');

  // Active color token applied when drawing
  const currentDrawToken = useMemo(() => {
    if (paintMode === 'custom') return customPaintColor;
    return paintMode;
  }, [paintMode, customPaintColor]);

  // Tools
  const [activeTool, setActiveTool] = useState<'pencil' | 'line' | 'bucket' | 'eraser' | 'picker'>('pencil');
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [showWheelGuides, setShowWheelGuides] = useState<boolean>(true);
  const [editorZoom, setEditorZoom] = useState<number>(14);

  // Preview State
  const [previewAngle, setPreviewAngle] = useState<ChassisAngle | 'rotation'>('right');
  const [previewRotation, setPreviewRotation] = useState<number>(90); // 90 = right
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [testNitro, setTestNitro] = useState<boolean>(false);
  const [testHeadlights, setTestHeadlights] = useState<boolean>(accessories.headlights.beamVisible);
  const [previewZoom, setPreviewZoom] = useState<number>(1.3);

  // Asset Metadata
  const [assetName, setAssetName] = useState<string>('Meu Chassi Custom');
  const [assetId, setAssetId] = useState<string>(() => `asset_${Date.now()}`);
  const [activeTab, setActiveTab] = useState<'editor' | 'accessories' | 'library' | 'crypto'>('editor');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Canvas Refs
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMouseDownRef = useRef<boolean>(false);
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Derive Vector Path from Right profile silhouette
  const vectorPathData = useMemo(() => {
    return generateVectorPathFromGrid(pixelsRight, 48, 24);
  }, [pixelsRight]);

  // Derive Cryptographic Credentials
  const cryptoCredentials = useMemo(() => {
    const creatorId = playerProfile?.id || 'player_pilot';
    return createAssetCryptographicCredentials(
      creatorId,
      assetName,
      vectorPathData,
      48,
      24,
      Date.now()
    );
  }, [playerProfile?.id, assetName, vectorPathData]);

  // Construct current asset object
  const currentAsset: CustomCarAsset = useMemo(() => {
    return {
      id: assetId,
      name: assetName,
      createdAt: Date.now(),
      width: 48,
      height: 24,
      pixels: pixelsRight,
      pixelsLeft: autoMirrorLeft ? mirrorGridHorizontally(pixelsRight, 48, 24) : pixelsLeft,
      pixelsFront,
      pixelsRear,
      pixelsTop,
      basePrimaryColorToken: '__PRIMARY_BASE__',
      baseSecondaryColorToken: '__SECONDARY_BASE__',
      accessoryConfig: {
        ...accessories,
        headlights: {
          ...accessories.headlights,
          beamVisible: testHeadlights
        },
        neon: {
          ...accessories.neon,
          color: previewNeonColor
        }
      },
      vectorPath: vectorPathData,
      encryptedHashId: cryptoCredentials.encryptedHashId,
      creatorId: playerProfile?.id || 'player_pilot',
      creatorSignature: cryptoCredentials.creatorSignature,
      rarityScore: cryptoCredentials.rarityScore,
      isAuctionReady: true,
      auctionEstimate: cryptoCredentials.auctionEstimateCoins,
      primaryColor: previewPrimaryColor,
      secondaryColor: previewSecondaryColor,
      neonColor: previewNeonColor
    };
  }, [
    assetId,
    assetName,
    pixelsRight,
    pixelsLeft,
    pixelsFront,
    pixelsRear,
    pixelsTop,
    accessories,
    testHeadlights,
    previewNeonColor,
    vectorPathData,
    cryptoCredentials,
    playerProfile?.id,
    previewPrimaryColor,
    previewSecondaryColor
  ]);

  // ---------------------------------------------------------------------------
  // DRAWING CANVAS LOGIC
  // ---------------------------------------------------------------------------
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / editorZoom);
    const y = Math.floor((e.clientY - rect.top) / editorZoom);
    return {
      x: Math.max(0, Math.min(currentGridWidth - 1, x)),
      y: Math.max(0, Math.min(currentGridHeight - 1, y))
    };
  };

  const applyPixelEdit = (x: number, y: number, color: string) => {
    const updated = [...activePixels];
    updated[y * currentGridWidth + x] = color;
    setActivePixels(updated);
  };

  const floodFill = (startX: number, startY: number, targetCol: string, fillCol: string) => {
    if (targetCol === fillCol) return;
    const updated = [...activePixels];
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const [cx, cy] = queue.pop()!;
      const idx = cy * currentGridWidth + cx;
      if (visited.has(idx)) continue;
      visited.add(idx);

      if (updated[idx] === targetCol) {
        updated[idx] = fillCol;
        if (cx > 0) queue.push([cx - 1, cy]);
        if (cx < currentGridWidth - 1) queue.push([cx + 1, cy]);
        if (cy > 0) queue.push([cx, cy - 1]);
        if (cy < currentGridHeight - 1) queue.push([cx, cy + 1]);
      }
    }
    setActivePixels(updated);
    pushHistory(activeAngle, updated);
  };

  const drawLine = (x0: number, y0: number, x1: number, y1: number, color: string) => {
    const updated = [...activePixels];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      if (cx >= 0 && cx < currentGridWidth && cy >= 0 && cy < currentGridHeight) {
        updated[cy * currentGridWidth + cx] = color;
      }
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
    setActivePixels(updated);
    pushHistory(activeAngle, updated);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    isMouseDownRef.current = true;

    if (activeTool === 'picker') {
      const picked = activePixels[y * currentGridWidth + x];
      if (picked && picked.startsWith('__')) {
        setPaintMode(picked);
      } else if (picked && picked !== 'transparent') {
        setPaintMode('custom');
        setCustomPaintColor(picked);
      }
      setActiveTool('pencil');
      return;
    }

    if (activeTool === 'bucket') {
      const targetCol = activePixels[y * currentGridWidth + x] || '';
      floodFill(x, y, targetCol, currentDrawToken);
      return;
    }

    if (activeTool === 'line') {
      lineStartRef.current = { x, y };
      return;
    }

    const col = activeTool === 'eraser' ? '' : currentDrawToken;
    applyPixelEdit(x, y, col);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    if (activeTool === 'line' || activeTool === 'bucket' || activeTool === 'picker') return;
    const { x, y } = getCanvasCoords(e);
    const col = activeTool === 'eraser' ? '' : currentDrawToken;
    applyPixelEdit(x, y, col);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;

    if (activeTool === 'line' && lineStartRef.current) {
      const { x, y } = getCanvasCoords(e);
      drawLine(lineStartRef.current.x, lineStartRef.current.y, x, y, currentDrawToken);
      lineStartRef.current = null;
      return;
    }

    pushHistory(activeAngle, activePixels);
  };

  // Convert all matching colors to dynamic primary/secondary base tokens
  const handleConvertCurrentColorToBase = (slot: 'primary' | 'secondary') => {
    const targetToken = slot === 'primary' ? '__PRIMARY_BASE__' : '__SECONDARY_BASE__';
    const updated = activePixels.map((c) => (c === customPaintColor ? targetToken : c));
    setActivePixels(updated);
    pushHistory(activeAngle, updated);
  };

  // Mirror Right profile into Left profile
  const handleMirrorRightToLeft = () => {
    const mirrored = mirrorGridHorizontally(pixelsRight, 48, 24);
    setPixelsLeft(mirrored);
    pushHistory('left', mirrored);
    setActiveAngle('left');
  };

  // Load Preset into all 5 views and accessories
  const handleLoadPreset = (key: string) => {
    const preset = MULTI_VIEW_PRESETS[key];
    if (!preset) return;
    setAssetName(preset.name);
    const r = preset.generateRight();
    setPixelsRight(r);
    setPixelsLeft(mirrorGridHorizontally(r, 48, 24));
    setPixelsFront(preset.generateFront());
    setPixelsRear(preset.generateRear());
    setPixelsTop(preset.generateTop());
    setAccessories(preset.accessoryConfig);
    setPreviewPrimaryColor(preset.primaryColor);
    setPreviewSecondaryColor(preset.secondaryColor);
    setPreviewNeonColor(preset.neonColor);
    pushHistory('right', r);
    setEquipSuccessToast(`Template "${preset.name}" carregado nas 5 vistas do Editor!`);
    setTimeout(() => setEquipSuccessToast(null), 3000);
  };

  // Directly equip preset as custom asset to active car
  const handleDirectEquipPreset = (key: string) => {
    const preset = MULTI_VIEW_PRESETS[key];
    if (!preset) return;
    const r = preset.generateRight();
    const l = mirrorGridHorizontally(r, 48, 24);
    const f = preset.generateFront();
    const rr = preset.generateRear();
    const t = preset.generateTop();
    const vectorPath = generateVectorPathFromGrid(r, 48, 24);
    const cryptoCreds = createAssetCryptographicCredentials(
      playerProfile?.id || 'creator_player',
      preset.name,
      vectorPath,
      48,
      24,
      Date.now()
    );

    const asset: CustomCarAsset = {
      id: 'asset_' + Math.random().toString(36).substring(2, 9),
      name: preset.name,
      createdAt: Date.now(),
      width: 48,
      height: 24,
      pixels: r,
      pixelsLeft: l,
      pixelsFront: f,
      pixelsRear: rr,
      pixelsTop: t,
      accessoryConfig: preset.accessoryConfig,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      neonColor: preset.neonColor,
      vectorPath,
      encryptedHashId: cryptoCreds.encryptedHashId,
      creatorId: playerProfile?.id || 'creator_player',
      creatorSignature: cryptoCreds.creatorSignature,
      rarityScore: cryptoCreds.rarityScore,
      auctionEstimate: cryptoCreds.auctionEstimateCoins
    };

    onSaveAsset(asset);
    onEquipAssetToCar(activeCar.id, asset);
    setEquipSuccessToast(`Template "${preset.name}" equipado com sucesso no carro ativo!`);
    setTimeout(() => setEquipSuccessToast(null), 3500);
  };

  // Dedicated blank canvas creator
  const handleClearToBlank = () => {
    setAssetName('Novo Modelo Custom');
    const blankRight = createEmptyGrid(48, 24);
    const blankLeft = createEmptyGrid(48, 24);
    const blankFront = createEmptyGrid(24, 24);
    const blankRear = createEmptyGrid(24, 24);
    const blankTop = createEmptyGrid(48, 24);
    setPixelsRight(blankRight);
    setPixelsLeft(blankLeft);
    setPixelsFront(blankFront);
    setPixelsRear(blankRear);
    setPixelsTop(blankTop);
    setAccessories({
      wheels: {
        visible: true,
        rearX: 10,
        rearY: 17,
        frontX: 38,
        frontY: 17,
        radius: 3.5,
        layer: 'in_front',
        style: 'spokes',
        spinning: true
      },
      spoiler: {
        visible: false,
        x: 4,
        y: 8,
        scale: 1,
        layer: 'behind',
        style: 'gt_wing'
      },
      nitro: {
        visible: true,
        x: 1,
        y: 17,
        layer: 'behind'
      },
      headlights: {
        visible: true,
        x: 42,
        y: 14,
        beamVisible: true,
        layer: 'in_front'
      },
      neon: {
        visible: false,
        color: '#38bdf8',
        y: 20
      }
    });
    pushHistory(activeAngle, activeAngle === 'front' || activeAngle === 'rear' ? blankFront : blankRight);
  };

  // Save / Equip Actions
  const handleSave = () => {
    const finalAsset = {
      ...currentAsset,
      pixelsLeft: autoMirrorLeft ? mirrorGridHorizontally(pixelsRight, 48, 24) : pixelsLeft
    };
    onSaveAsset(finalAsset);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleEquip = () => {
    const finalAsset = {
      ...currentAsset,
      pixelsLeft: autoMirrorLeft ? mirrorGridHorizontally(pixelsRight, 48, 24) : pixelsLeft
    };
    onEquipAssetToCar(activeCar.id, finalAsset);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Import Image Handler (client-side processing)
  const handleImportImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processImportedImage(img, file.name);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input to allow re-importing same file
    e.target.value = '';
  }, [onSaveAsset]);

  // Client-side image processing (simplified version of server script)
  const processImportedImage = async (img: HTMLImageElement, fileName: string) => {
    try {
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const SIDE_W = 48, SIDE_H = 24;
      const FRONT_W = 24, FRONT_H = 24;
      const TOP_W = 48, TOP_H = 24;

      // Resize to side view dimensions
      canvas.width = SIDE_W;
      canvas.height = SIDE_H;
      ctx.drawImage(img, 0, 0, SIDE_W, SIDE_H);

      const imageData = ctx.getImageData(0, 0, SIDE_W, SIDE_H);
      const data = imageData.data;

      // Extract dominant colors (simplified)
      const colorCounts: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a < 128) continue;
        const hex = '#' + [r, g, b].map(c => Math.round(c/32)*32.toString(16).padStart(2,'0')).join('');
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      const sortedColors = Object.entries(colorCounts).sort((a,b) => b[1]-a[1]).map(([c]) => c);
      const bodyColors = sortedColors.filter(c => {
        const l = parseInt(c.slice(1),16);
        const r = (l>>16)&255, g = (l>>8)&255, b = l&255;
        const lum = 0.299*r + 0.587*g + 0.114*b;
        return lum > 30 && lum < 220;
      });

      const primary = bodyColors[0] || '#e11d48';
      const secondary = bodyColors[1] || '#09090b';

      // Generate 5-tone palette
      const pr = parseInt(primary.slice(1,3),16), pg = parseInt(primary.slice(3,5),16), pb = parseInt(primary.slice(5,7),16);
      const adjust = (r:number,g:number,b:number,f:number) => '#'+[r,g,b].map(c=>Math.min(255,Math.max(0,Math.round(c*f))).toString(16).padStart(2,'0')).join('');

      const tokens = {
        primary,
        primaryHi: adjust(pr,pg,pb,1.5),
        primaryLight: adjust(pr,pg,pb,1.25),
        primaryDark: adjust(pr,pg,pb,0.7),
        primaryDeep: adjust(pr,pg,pb,0.45),
        secondary,
        glass: '#0f172a',
        glassSky: '#38bdf8',
        glassGlare: '#e0f2fe',
        lamp: '#fef08a',
        tail: '#ef4444',
        dark: '#09090b',
        tire: '#18181b',
        chrome: '#e2e8f0'
      };

      // Build right view grid with token mapping
      const pixelsRight: string[] = new Array(SIDE_W * SIDE_H).fill('');
      for (let y = 0; y < SIDE_H; y++) {
        for (let x = 0; x < SIDE_W; x++) {
          const i = (y * SIDE_W + x) * 4;
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 128) { pixelsRight[y * SIDE_W + x] = 'transparent'; continue; }
          const hex = '#' + [r,g,b].map(c => Math.round(c/32)*32.toString(16).padStart(2,'0')).join('');

          // Map to nearest token
          const tokenColors: Record<string, [number,number,number]> = {
            '__PRIMARY_HI__': [parseInt(tokens.primaryHi.slice(1,3),16), parseInt(tokens.primaryHi.slice(3,5),16), parseInt(tokens.primaryHi.slice(5,7),16)],
            '__PRIMARY_LIGHT__': [parseInt(tokens.primaryLight.slice(1,3),16), parseInt(tokens.primaryLight.slice(3,5),16), parseInt(tokens.primaryLight.slice(5,7),16)],
            '__PRIMARY_BASE__': [pr, pg, pb],
            '__PRIMARY_DARK__': [parseInt(tokens.primaryDark.slice(1,3),16), parseInt(tokens.primaryDark.slice(3,5),16), parseInt(tokens.primaryDark.slice(5,7),16)],
            '__PRIMARY_DEEP__': [parseInt(tokens.primaryDeep.slice(1,3),16), parseInt(tokens.primaryDeep.slice(3,5),16), parseInt(tokens.primaryDeep.slice(5,7),16)],
            '__SECONDARY_BASE__': [parseInt(secondary.slice(1,3),16), parseInt(secondary.slice(3,5),16), parseInt(secondary.slice(5,7),16)],
            '#0f172a': [15,23,42], '#38bdf8': [56,189,248], '#e0f2fe': [224,242,254],
            '#fef08a': [254,240,138], '#ef4444': [239,68,68], '#09090b': [9,9,11],
            '#18181b': [24,24,27], '#e2e8f0': [226,232,240]
          };

          let bestToken = '__PRIMARY_BASE__', bestDist = Infinity;
          for (const [token, [tr,tg,tb]] of Object.entries(tokenColors)) {
            const dist = Math.abs(r-tr) + Math.abs(g-tg) + Math.abs(b-tb);
            if (dist < bestDist) { bestDist = dist; bestToken = token; }
          }
          pixelsRight[y * SIDE_W + x] = bestDist > 100 ? hex : bestToken;
        }
      }

      // Generate other views
      const mirrorGrid = (pixels: string[], w: number, h: number) => {
        const r = new Array(w*h).fill('');
        for (let y=0;y<h;y++) for (let x=0;x<w;x++) r[y*w+(w-1-x)] = pixels[y*w+x];
        return r;
      };

      const pixelsLeft = mirrorGrid(pixelsRight, SIDE_W, SIDE_H);

      const genFront = () => {
        const p = new Array(FRONT_W*FRONT_H).fill('');
        const fill = (p:string[], w:number, h:number, rx:number, ry:number, rw:number, rh:number, c:string) => {
          for (let y=Math.max(0,ry);y<Math.min(h,ry+rh);y++) for (let x=Math.max(0,rx);x<Math.min(w,rx+rw);x++) p[y*w+x]=c;
        };
        fill(p,FRONT_W,FRONT_H,3,17,18,2,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,4,14,16,3,tokens.primary);
        fill(p,FRONT_W,FRONT_H,8,15,8,2,tokens.dark);
        fill(p,FRONT_W,FRONT_H,4,13,3,2,tokens.lamp);
        fill(p,FRONT_W,FRONT_H,17,13,3,2,tokens.lamp);
        fill(p,FRONT_W,FRONT_H,11,14,2,2,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,6,9,12,5,tokens.glass);
        fill(p,FRONT_W,FRONT_H,8,10,3,3,tokens.glassSky);
        fill(p,FRONT_W,FRONT_H,7,8,10,1,tokens.primary);
        fill(p,FRONT_W,FRONT_H,2,16,2,3,tokens.tire);
        fill(p,FRONT_W,FRONT_H,20,16,2,3,tokens.tire);
        return p;
      };

      const genRear = () => {
        const p = new Array(FRONT_W*FRONT_H).fill('');
        const fill = (p:string[], w:number, h:number, rx:number, ry:number, rw:number, rh:number, c:string) => {
          for (let y=Math.max(0,ry);y<Math.min(h,ry+rh);y++) for (let x=Math.max(0,rx);x<Math.min(w,rx+rw);x++) p[y*w+x]=c;
        };
        fill(p,FRONT_W,FRONT_H,3,17,18,2,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,4,14,16,3,tokens.primary);
        fill(p,FRONT_W,FRONT_H,4,13,4,2,tokens.tail);
        fill(p,FRONT_W,FRONT_H,16,13,4,2,tokens.tail);
        fill(p,FRONT_W,FRONT_H,9,14,6,2,tokens.dark);
        fill(p,FRONT_W,FRONT_H,6,17,2,1,'#94a3b8');
        fill(p,FRONT_W,FRONT_H,16,17,2,1,'#94a3b8');
        fill(p,FRONT_W,FRONT_H,6,9,12,5,tokens.glass);
        fill(p,FRONT_W,FRONT_H,7,8,10,1,tokens.primary);
        fill(p,FRONT_W,FRONT_H,3,6,18,1,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,6,7,1,2,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,17,7,1,2,tokens.secondary);
        fill(p,FRONT_W,FRONT_H,2,16,2,3,tokens.tire);
        fill(p,FRONT_W,FRONT_H,20,16,2,3,tokens.tire);
        return p;
      };

      const genTop = () => {
        const p = new Array(TOP_W*TOP_H).fill('');
        const fill = (p:string[], w:number, h:number, rx:number, ry:number, rw:number, rh:number, c:string) => {
          for (let y=Math.max(0,ry);y<Math.min(h,ry+rh);y++) for (let x=Math.max(0,rx);x<Math.min(w,rx+rw);x++) p[y*w+x]=c;
        };
        fill(p,TOP_W,TOP_H,6,5,36,14,tokens.primary);
        fill(p,TOP_W,TOP_H,34,10,8,4,tokens.secondary);
        fill(p,TOP_W,TOP_H,26,6,6,12,tokens.glass);
        fill(p,TOP_W,TOP_H,18,6,8,12,tokens.primary);
        fill(p,TOP_W,TOP_H,12,6,6,12,tokens.glass);
        fill(p,TOP_W,TOP_H,4,4,2,16,tokens.secondary);
        fill(p,TOP_W,TOP_H,28,3,2,2,tokens.primary);
        fill(p,TOP_W,TOP_H,28,19,2,2,tokens.primary);
        fill(p,TOP_W,TOP_H,10,3,6,2,tokens.tire);
        fill(p,TOP_W,TOP_H,10,19,6,2,tokens.tire);
        fill(p,TOP_W,TOP_H,32,3,6,2,tokens.tire);
        fill(p,TOP_W,TOP_H,32,19,6,2,tokens.tire);
        fill(p,TOP_W,TOP_H,42,7,2,10,tokens.secondary);
        return p;
      };

      const pixelsFront = genFront();
      const pixelsRear = genRear();
      const pixelsTop = genTop();

      // Generate vector path (simplified)
      const topPoints: {x:number,y:number}[] = [], bottomPoints: {x:number,y:number}[] = [];
      let minCol = SIDE_W, maxCol = -1;
      for (let x=0; x<SIDE_W; x++) {
        let topY=-1, botY=-1;
        for (let y=0; y<SIDE_H; y++) {
          const c = pixelsRight[y*SIDE_W+x];
          if (c && c!=='transparent' && c!=='') { if (topY===-1) topY=y; botY=y; }
        }
        if (topY!==-1) { topPoints.push({x,y:topY}); bottomPoints.push({x,y:botY}); if(x<minCol)minCol=x; if(x>maxCol)maxCol=x; }
      }

      let vectorPath = 'M 6 18 C 6 15, 9 14, 12 14 L 17 14 C 20 10, 24 8, 30 8 L 34 8 C 38 8, 42 12, 44 14 L 46 16 C 46 18, 44 19, 41 19 C 39 19, 39 17, 36 17 C 33 17, 33 19, 21 19 C 19 19, 19 17, 16 17 C 13 17, 13 19, 8 19 Z';
      if (topPoints.length >= 4 && minCol < maxCol) {
        const smoothTop = topPoints.filter((_,i)=>i%2===0);
        if (smoothTop[smoothTop.length-1]?.x !== topPoints[topPoints.length-1]?.x) smoothTop.push(topPoints[topPoints.length-1]);
        const smoothBot = bottomPoints.filter((_,i)=>i%2===0).reverse();
        if (smoothBot[smoothBot.length-1]?.x !== bottomPoints[0]?.x) smoothBot.push(bottomPoints[0]);

        let path = `M ${smoothTop[0].x} ${smoothTop[0].y+1}`;
        for (let i=1;i<smoothTop.length;i++) {
          const midX = ((smoothTop[i-1].x+smoothTop[i].x)/2).toFixed(1);
          path += ` C ${midX} ${smoothTop[i-1].y}, ${midX} ${smoothTop[i].y}, ${smoothTop[i].x} ${smoothTop[i].y}`;
        }
        path += ` L ${smoothTop[smoothTop.length-1].x} ${smoothBot[0].y}`;
        for (let i=1;i<smoothBot.length;i++) path += ` L ${smoothBot[i].x} ${smoothBot[i].y}`;
        path += ` Z`;
        vectorPath = path;
      }

      // Crypto hash (same as server)
      const cryptoHash = (input: string) => {
        let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
        for(let i=0;i<input.length;i++){const c=input.charCodeAt(i);h0=(Math.imul(h0^c,0x5bd1e995)+(h1<<5)+(h1>>>2))>>>0;h1=(Math.imul(h1^(c*31),0x1b873593)+(h2<<5)+(h2>>>2))>>>0;h2=(Math.imul(h2^(c*73),0x85ebca6b)+(h3<<5)+(h3>>>2))>>>0;h3=(Math.imul(h3^(c*127),0xc2b2ae35)+(h4<<5)+(h4>>>2))>>>0;h4=(Math.imul(h4^(c*199),0x27d4eb2f)+(h5<<5)+(h5>>>2))>>>0;h5=(Math.imul(h5^(c*251),0x165667b1)+(h6<<5)+(h6>>>2))>>>0;h6=(Math.imul(h6^(c*311),0x9e3779b9)+(h7<<5)+(h7>>>2))>>>0;h7=(Math.imul(h7^(c*397),0x45bf92e1)+(h0<<5)+(h0>>>2))>>>0;}
        const toHex=(n:number)=>('00000000'+(n>>>0).toString(16)).slice(-8);
        return (toHex(h0)+toHex(h1)+toHex(h2)+toHex(h3)+toHex(h4)+toHex(h5)+toHex(h6)+toHex(h7)).toUpperCase();
      };

      const creatorId = 'web-importer-v1';
      const assetName = fileName.replace(/\.[^.]+$/,'').replace(/[_\-]/g,' ');
      const timestamp = Date.now();
      const payload = `${creatorId}::${assetName}::${vectorPath}::${SIDE_W}x${SIDE_H}::${timestamp}::CRYPTO_TOKEN_AUCTION_V2`;
      const rawHash = cryptoHash(payload);
      const encryptedHashId = `CIPHER-SHA256-${rawHash.slice(0,24)}`;
      const creatorPrefix = creatorId.replace(/[^a-zA-Z0-9]/g,'').slice(0,8);
      const creatorSignature = `SIG-ECDSA-v2.${rawHash.slice(24,48)}.${creatorPrefix}`;
      const pointCount = (vectorPath.match(/[MLCQZ]/g)||[]).length;
      const rawScore = Math.min(99,Math.max(45,Math.floor(pointCount*3.2+vectorPath.length*0.12)));
      const auctionEstimate = Math.floor(rawScore*280+3500);

      const asset = {
        id: `custom_${timestamp}_${Math.random().toString(36).slice(2,8)}`,
        name: assetName,
        createdAt: timestamp,
        width: SIDE_W, height: SIDE_H,
        pixels: pixelsRight, pixelsLeft, pixelsFront, pixelsRear, pixelsTop,
        basePrimaryColorToken: '__PRIMARY_BASE__', baseSecondaryColorToken: '__SECONDARY_BASE__',
        accessoryConfig: {
          wheels: {visible:true, rearX:10, rearY:17, frontX:38, frontY:17, radius:3.5, layer:'in_front' as const, style:'spokes' as const, spinning:true, color:'#18181b'},
          spoiler: {visible:true, x:4, y:7, scale:1, layer:'in_front' as const, style:'gt_wing' as const, color:'#09090b'},
          nitro: {visible:true, x:1, y:17, layer:'behind' as const},
          headlights: {visible:true, x:42, y:14, beamVisible:true, layer:'in_front' as const},
          neon: {visible:false, color:'#00f0ff', y:20}
        },
        vectorPath,
        encryptedHashId, creatorId, creatorSignature,
        rarityScore: rawScore, primaryColor: primary, secondaryColor: secondary, neonColor: '#00f0ff',
        presetBase: 'imported', isAuctionReady: true, auctionEstimate
      };

      onSaveAsset(asset);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);

      // Switch to library tab to show the new asset
      setActiveTab('library');

    } catch (err) {
      console.error('Erro ao importar imagem:', err);
      alert('Falha ao processar imagem. Verifique o console para detalhes.');
    }
  };

  // ---------------------------------------------------------------------------
  // DRAW EDITOR CANVAS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = currentGridWidth * editorZoom;
    canvas.height = currentGridHeight * editorZoom;
    ctx.imageSmoothingEnabled = false;

    // Checkerboard Background
    for (let y = 0; y < currentGridHeight; y++) {
      for (let x = 0; x < currentGridWidth; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#0f172a' : '#1e293b';
        ctx.fillRect(x * editorZoom, y * editorZoom, editorZoom, editorZoom);

        const col = activePixels[y * currentGridWidth + x];
        if (col && col !== 'transparent' && col !== '') {
          // Resolve display color for smooth shading tokens
          let displayCol = col;
          if (col === '__PRIMARY_BASE__') displayCol = previewPrimaryColor;
          else if (col === '__PRIMARY_HI__') displayCol = adjustBrightness(previewPrimaryColor, 38);
          else if (col === '__PRIMARY_LIGHT__') displayCol = adjustBrightness(previewPrimaryColor, 18);
          else if (col === '__PRIMARY_DARK__') displayCol = adjustBrightness(previewPrimaryColor, -22);
          else if (col === '__PRIMARY_DEEP__') displayCol = adjustBrightness(previewPrimaryColor, -45);
          else if (col === '__SECONDARY_BASE__') displayCol = previewSecondaryColor;
          else if (col === '__SECONDARY_HI__') displayCol = adjustBrightness(previewSecondaryColor, 30);
          else if (col === '__SECONDARY_DARK__') displayCol = adjustBrightness(previewSecondaryColor, -25);

          ctx.fillStyle = displayCol;
          ctx.fillRect(x * editorZoom, y * editorZoom, editorZoom, editorZoom);

          // Subtle indicator pattern for base tokens so designer knows which is dynamic
          if (col.startsWith('__PRIMARY_')) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(x * editorZoom, y * editorZoom, 2, 2);
          } else if (col.startsWith('__SECONDARY_')) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(x * editorZoom, y * editorZoom, 2, 2);
          }
        }
      }
    }

    // Wheel position guides (for side profiles)
    if (showWheelGuides && (activeAngle === 'right' || activeAngle === 'left')) {
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);

      const isLeft = activeAngle === 'left';
      const rX = isLeft ? (currentGridWidth - 1 - accessories.wheels.rearX) : accessories.wheels.rearX;
      const fX = isLeft ? (currentGridWidth - 1 - accessories.wheels.frontX) : accessories.wheels.frontX;
      const wRadius = accessories.wheels.radius * editorZoom * 0.55;

      ctx.beginPath();
      ctx.arc((rX + 0.5) * editorZoom, (accessories.wheels.rearY + 0.5) * editorZoom, wRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc((fX + 0.5) * editorZoom, (accessories.wheels.frontY + 0.5) * editorZoom, wRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Grid lines
    if (showGridLines) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= currentGridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * editorZoom, 0);
        ctx.lineTo(x * editorZoom, currentGridHeight * editorZoom);
        ctx.stroke();
      }
      for (let y = 0; y <= currentGridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * editorZoom);
        ctx.lineTo(currentGridWidth * editorZoom, y * editorZoom);
        ctx.stroke();
      }
    }
  }, [
    activeAngle,
    activePixels,
    currentGridWidth,
    currentGridHeight,
    editorZoom,
    showGridLines,
    showWheelGuides,
    accessories.wheels,
    previewPrimaryColor,
    previewSecondaryColor
  ]);

  // ---------------------------------------------------------------------------
  // ANIMATED PREVIEW RENDER LOOP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let frame = 0;
    let active = true;

    const renderPreview = () => {
      if (!active) return;
      frame++;

      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let angleToRender: ChassisAngle = activeAngle;
          let currentRot = previewRotation;

          if (previewAngle === 'rotation') {
            currentRot = (frame * 1.5) % 360;
          } else {
            angleToRender = previewAngle;
            currentRot = angleToRender === 'front' ? 0 : angleToRender === 'right' ? 90 : angleToRender === 'rear' ? 180 : 270;
          }

          // Mock Car object to pass to drawCustomChassisCar
          const mockCar: Car = {
            ...activeCar,
            visuals: {
              ...activeCar.visuals,
              primaryColor: previewPrimaryColor,
              secondaryColor: previewSecondaryColor,
              neonColor: previewNeonColor,
              hasNeon: accessories.neon.visible,
              wheelStyle: accessories.wheels.style,
              spoiler: accessories.spoiler.style
            }
          };

          drawCustomChassisCar(
            ctx,
            mockCar,
            canvas.width / 2,
            canvas.height / 2,
            previewZoom,
            previewAngle === 'rotation' ? 'rotation' : angleToRender,
            currentRot,
            frame,
            testNitro,
            accessories.wheels.spinning,
            currentAsset
          );
        }
      }

      animFrameRef.current = requestAnimationFrame(renderPreview);
    };

    renderPreview();
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    previewAngle,
    previewRotation,
    previewZoom,
    testNitro,
    currentAsset,
    previewPrimaryColor,
    previewSecondaryColor,
    previewNeonColor,
    accessories,
    activeAngle,
    activeCar
  ]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* HEADER & TOP CONTROLS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <CarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="text-lg md:text-xl font-bold font-mono text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1"
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                PRO 360°
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Defina as 5 visões cardinais, posicione rodas e acessórios em camadas (frente/trás) com cor base dinâmica.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {savedSuccess && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" /> Salvo com Sucesso!
            </span>
          )}

          <button
            onClick={handleSave}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Chassi</span>
          </button>

          <button
            onClick={handleEquip}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Equipar no Carro</span>
          </button>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Editor 5 Visões</span>
          </button>

          <button
            onClick={() => setActiveTab('accessories')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'accessories'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Acessórios & Camadas</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Meus Chasis ({customAssets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'crypto'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ID Cripto & Leilão</span>
          </button>
        </div>

        {/* Toast Notification Banner */}
        {equipSuccessToast && (
          <div className="p-3 mb-2 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-mono flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{equipSuccessToast}</span>
            </div>
            <button
              onClick={() => setEquipSuccessToast(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Presets Menu */}
        <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/80 transition-all text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
            title="Abrir galeria visual com os 12 templates e modelos oficiais de pixel art baseados na folha de sprites"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-200" />
            <span>Catálogo de Templates (12)</span>
          </button>

          <button
            onClick={handleClearToBlank}
            className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/60 hover:border-rose-500 transition-all text-[11px] font-bold flex items-center gap-1.5 shadow-sm"
            title="Criar novo chassi em tela em branco com escala e proporção padrão (48x24)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tela em Branco</span>
          </button>

          <span className="text-slate-500 hidden sm:inline ml-1">Atalhos:</span>
          {Object.entries(MULTI_VIEW_PRESETS).filter(([k]) => k !== 'blank').map(([key, p]) => (
            <button
              key={key}
              onClick={() => handleLoadPreset(key)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors text-[11px]"
              title={p.description}
            >
              {p.name.replace(' (Oficial)', '')}
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TEMPLATES CATALOG MODAL (VISUAL GALLERY)                              */}
      {/* ===================================================================== */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white font-mono flex items-center gap-2">
                    <span>Galeria de Templates & Modelos Oficiais</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Pixel Art 48x24
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Selecione um dos 12 chassis icônicos para editar no Asset Developer ou equipar diretamente no seu carro ativo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplatesModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'JDM', 'Supercar', 'Muscle', 'Rally'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                      templateCategoryFilter === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {cat === 'all' ? 'Todos (12)' : cat === 'JDM' ? 'JDM Legends' : cat === 'Supercar' ? 'Supercarros' : cat === 'Muscle' ? 'Muscle Americano' : 'Rali WRC'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar modelo..."
                value={templateSearchQuery}
                onChange={e => setTemplateSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono w-full sm:w-56"
              />
            </div>

            {/* Template Cards Grid */}
            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(MULTI_VIEW_PRESETS)
                .filter(([k]) => k !== 'blank')
                .filter(([_, p]) => {
                  if (templateCategoryFilter !== 'all') {
                    const presetCat = (p as any).category || (
                      p.name.includes('Skyline') || p.name.includes('Supra') || p.name.includes('RX-7') ? 'JDM' :
                      p.name.includes('Viper') || p.name.includes('Corvette') || p.name.includes('Muscle') ? 'Muscle' :
                      p.name.includes('WRX') || p.name.includes('Lancer') ? 'Rally' : 'Supercar'
                    );
                    if (presetCat !== templateCategoryFilter) return false;
                  }
                  if (templateSearchQuery.trim()) {
                    const q = templateSearchQuery.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                  }
                  return true;
                })
                .map(([key, p]) => (
                  <div
                    key={key}
                    className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-xl group"
                  >
                    <div>
                      {/* Mini Preview Canvas */}
                      <div className="relative mb-3 overflow-hidden rounded-xl bg-slate-950 border border-slate-800 group-hover:border-indigo-500/50 transition-colors">
                        <PresetThumbnailCanvas presetKey={key} scale={2.1} />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                            style={{ backgroundColor: p.primaryColor }}
                            title={`Cor Primária: ${p.primaryColor}`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                            style={{ backgroundColor: p.secondaryColor }}
                            title={`Cor Secundária: ${p.secondaryColor}`}
                          />
                        </div>
                      </div>

                      {/* Header & Badges */}
                      <div className="space-y-1 mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-white font-mono text-sm group-hover:text-indigo-300 transition-colors">
                            {p.name.replace(' (Oficial)', '')}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                          {p.description}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-900">
                      <button
                        onClick={() => {
                          handleLoadPreset(key);
                          setIsTemplatesModalOpen(false);
                        }}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        title="Carregar no Editor nas 5 vistas para desenhar e modificar"
                      >
                        <Paintbrush className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => {
                          handleDirectEquipPreset(key);
                          setIsTemplatesModalOpen(false);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        title="Equipar agora mesmo este chassi no carro ativo"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Equipar</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Escala e resolução calibradas com os chassis originais (48x24 px).</span>
              <button
                onClick={() => setIsTemplatesModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: 5-VIEW EDITOR & ANIMATED PREVIEW                               */}
      {/* ===================================================================== */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Tools & Colors (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Drawing Tools */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Ferramentas</span>
                <span className="text-[10px] text-slate-500 font-mono">Pixels</span>
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setActiveTool('pencil')}
                  className={`p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    activeTool === 'pencil'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>Pincel</span>
                </button>

                <button
                  onClick={() => setActiveTool('line')}
                  className={`p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    activeTool === 'line'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Reta</span>
                </button>

                <button
                  onClick={() => setActiveTool('bucket')}
                  className={`p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    activeTool === 'bucket'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <PaintBucket className="w-4 h-4" />
                  <span>Balde</span>
                </button>

                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    activeTool === 'eraser'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>Borracha</span>
                </button>

                <button
                  onClick={() => setActiveTool('picker')}
                  className={`p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    activeTool === 'picker'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <Pipette className="w-4 h-4" />
                  <span>Conta-gotas</span>
                </button>

                <button
                  onClick={() => {
                    const empty = createEmptyGrid(currentGridWidth, currentGridHeight);
                    setActivePixels(empty);
                    pushHistory(activeAngle, empty);
                  }}
                  className="p-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center gap-1 border bg-slate-800/70 text-rose-400 hover:bg-rose-950/40 border-slate-700 transition-all cursor-pointer"
                  title="Limpar grid atual"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpar</span>
                </button>
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={handleUndo}
                  disabled={historyIndices[activeAngle] <= 0}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 flex items-center justify-center gap-1 border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desfazer</span>
                </button>

                <button
                  onClick={handleRedo}
                  disabled={historyIndices[activeAngle] >= history[activeAngle].length - 1}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 flex items-center justify-center gap-1 border border-slate-700"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refazer</span>
                </button>
              </div>
            </div>

            {/* DYNAMIC BASE COLOR DEFINITIONS */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Shading e Cores Suaves</span>
                <span className="text-[10px] text-amber-400 font-bold">Auto-Tuning</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono leading-tight">
                Use os tons de brilho e sombra idênticos aos modelos oficiais. Eles adaptam dinamicamente na garagem e na pista!
              </p>

              {/* Primary Color Shading Stack */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wide">
                  Pintura Primária (5 Tons)
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { token: '__PRIMARY_HI__', label: 'Brilho', color: adjustBrightness(previewPrimaryColor, 38) },
                    { token: '__PRIMARY_LIGHT__', label: 'Claro', color: adjustBrightness(previewPrimaryColor, 18) },
                    { token: '__PRIMARY_BASE__', label: 'Base', color: previewPrimaryColor },
                    { token: '__PRIMARY_DARK__', label: 'Sombra', color: adjustBrightness(previewPrimaryColor, -22) },
                    { token: '__PRIMARY_DEEP__', label: 'Fundo', color: adjustBrightness(previewPrimaryColor, -45) }
                  ].map((s) => (
                    <button
                      key={s.token}
                      onClick={() => setPaintMode(s.token)}
                      className={`h-10 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        paintMode === s.token
                          ? 'ring-2 ring-white border-transparent scale-105 shadow-md'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                      style={{ backgroundColor: s.color }}
                      title={`${s.label} (${s.token})`}
                    >
                      <span className="text-[9px] font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-white">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Secondary Color Shading Stack */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wide">
                  Pintura Secundária / Aero (3 Tons)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { token: '__SECONDARY_HI__', label: 'Aero Luz', color: adjustBrightness(previewSecondaryColor, 30) },
                    { token: '__SECONDARY_BASE__', label: 'Aero Base', color: previewSecondaryColor },
                    { token: '__SECONDARY_DARK__', label: 'Aero Sombra', color: adjustBrightness(previewSecondaryColor, -25) }
                  ].map((s) => (
                    <button
                      key={s.token}
                      onClick={() => setPaintMode(s.token)}
                      className={`h-9 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        paintMode === s.token
                          ? 'ring-2 ring-white border-transparent scale-105 shadow-md'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                      style={{ backgroundColor: s.color }}
                      title={`${s.label} (${s.token})`}
                    >
                      <span className="text-[9px] font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-white">
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cores Fixas / Detalhes */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Cores Fixas (Vidros, Faróis, etc):</span>
                  <input
                    type="color"
                    value={customPaintColor}
                    onChange={(e) => {
                      setPaintMode('custom');
                      setCustomPaintColor(e.target.value);
                    }}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>

                <div className="grid grid-cols-8 gap-1.5">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => {
                        setPaintMode('custom');
                        setCustomPaintColor(hex);
                      }}
                      className={`w-6 h-6 rounded-md border cursor-pointer transition-transform hover:scale-110 ${
                        paintMode === 'custom' && customPaintColor === hex
                          ? 'ring-2 ring-white scale-105 border-transparent'
                          : 'border-slate-800'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Grid Canvas with Cardinal View Tabs (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
              {/* CARDINAL VIEW SELECTOR (RIGHT, LEFT, FRONT, REAR, TOP) */}
              <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveAngle('right')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                      activeAngle === 'right'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Direita</span>
                  </button>

                  <button
                    onClick={() => setActiveAngle('left')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                      activeAngle === 'left'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>Esquerda</span>
                  </button>

                  <button
                    onClick={() => setActiveAngle('front')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                      activeAngle === 'front'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-sky-400" />
                    <span>Frente</span>
                  </button>

                  <button
                    onClick={() => setActiveAngle('rear')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                      activeAngle === 'rear'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>Trás</span>
                  </button>

                  <button
                    onClick={() => setActiveAngle('top')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                      activeAngle === 'top'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cima</span>
                  </button>
                </div>

                {/* Master Action: Generate Generic Views (Front, Rear, Top) from Right Profile */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleGenerateAllGenericViews}
                    className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-amber-600/25 hover:from-amber-500/35 hover:to-amber-600/35 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 shadow-sm cursor-pointer transition-all hover:scale-105"
                    title="Gera automaticamente silhuetas genéricas de Frente, Trás e Cima combinando as cores da vista Direita para retoque"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gerar Frente, Trás e Cima</span>
                  </button>

                  {/* Contextual Action per Active View */}
                  {activeAngle === 'left' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAutoMirrorLeft(!autoMirrorLeft)}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                          autoMirrorLeft
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title="Quando ativo, qualquer alteração na Direita é espelhada instantaneamente na Esquerda"
                      >
                        <RefreshCw className={`w-3 h-3 ${autoMirrorLeft ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span>{autoMirrorLeft ? 'Auto-Espelho Ativo' : 'Auto-Espelho Pausado'}</span>
                      </button>
                      <button
                        onClick={() => handleGenerateSingleGenericView('left')}
                        className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1"
                        title="Copia e espelha horizontalmente a vista Direita na vista Esquerda"
                      >
                        <span>Forçar Espelho</span>
                      </button>
                    </div>
                  )}

                  {(activeAngle === 'front' || activeAngle === 'rear' || activeAngle === 'top') && (
                    <button
                      onClick={() => handleGenerateSingleGenericView(activeAngle)}
                      className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-1"
                      title={`Regerar arte genérica para ${activeAngle} usando as cores da Direita`}
                    >
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>Regerar {activeAngle === 'front' ? 'Frente' : activeAngle === 'rear' ? 'Trás' : 'Cima'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Toast Feedback for Generic Generation */}
              {genericGeneratedToast && (
                <div className="w-full mb-3 p-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>{genericGeneratedToast}</span>
                  </div>
                  <button
                    onClick={() => setGenericGeneratedToast(null)}
                    className="text-amber-400 hover:text-white px-1 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Angle Description Banner */}
              <div className="w-full mb-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                {activeAngle === 'right' && (
                  <span className="text-amber-400/90 font-bold flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    Vista Mestra Direita (Frente para a direita) — Base para espelho e vistas genéricas
                  </span>
                )}
                {activeAngle === 'left' && (
                  <span className="text-emerald-400/90 font-bold flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Vista Esquerda — {autoMirrorLeft ? 'Espelho horizontal automático da Direita' : 'Modo manual para retoques'}
                  </span>
                )}
                {activeAngle === 'front' && (
                  <span className="text-sky-400/90 font-bold flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    Vista Frontal (24x24 px) — Gerada com as cores da lataria para retoques finais
                  </span>
                )}
                {activeAngle === 'rear' && (
                  <span className="text-rose-400/90 font-bold flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" />
                    Vista Traseira (24x24 px) — Difusor, lanternas e escapamento para retoques
                  </span>
                )}
                {activeAngle === 'top' && (
                  <span className="text-emerald-400/90 font-bold flex items-center gap-1">
                    <Compass className="w-3 h-3" />
                    Vista Superior (48x24 px) — Capô, teto, para-brisa e 4 pneus para retoques
                  </span>
                )}
              </div>

              {/* Canvas Controls: Zoom, Grid, Guides */}
              <div className="w-full flex items-center justify-between pb-2 mb-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Tamanho:</span>
                  <span className="text-white font-bold">{currentGridWidth}x{currentGridHeight} px</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGridLines(!showGridLines)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border ${
                      showGridLines ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Grade
                  </button>

                  {(activeAngle === 'right' || activeAngle === 'left') && (
                    <button
                      onClick={() => setShowWheelGuides(!showWheelGuides)}
                      className={`px-2 py-1 rounded text-[11px] font-mono border ${
                        showWheelGuides ? 'bg-amber-600/30 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      Guias Rodas
                    </button>
                  )}

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
                    <button
                      onClick={() => setEditorZoom((z) => Math.max(8, z - 2))}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono px-1 text-white font-bold">{editorZoom}x</span>
                    <button
                      onClick={() => setEditorZoom((z) => Math.min(26, z + 2))}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawing Stage */}
              <div className="relative overflow-auto max-w-full p-3 bg-slate-950 rounded-xl border border-slate-800 shadow-inner flex items-center justify-center min-h-[300px]">
                <canvas
                  ref={editorCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-crosshair select-none block"
                />
              </div>

              <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                <span>Frente do chassi apontada para a DIREITA</span>
                <span className="text-amber-400/80">Guias amarelas: alinhamento das rodas</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Live 360 Animated Preview & Toggles (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Chassi Animado em Tempo Real</span>
                </h3>

                {/* Preview Zoom */}
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                  <button onClick={() => setPreviewZoom(1.0)} className={previewZoom === 1.0 ? 'text-indigo-400 font-bold' : ''}>1x</button>
                  <span>•</span>
                  <button onClick={() => setPreviewZoom(1.3)} className={previewZoom === 1.3 ? 'text-indigo-400 font-bold' : ''}>1.3x</button>
                  <span>•</span>
                  <button onClick={() => setPreviewZoom(1.7)} className={previewZoom === 1.7 ? 'text-indigo-400 font-bold' : ''}>1.7x</button>
                </div>
              </div>

              {/* View Angle Switcher for Preview */}
              <div className="grid grid-cols-6 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setPreviewAngle('right')}
                  className={`py-1 rounded ${previewAngle === 'right' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Direita
                </button>
                <button
                  onClick={() => setPreviewAngle('left')}
                  className={`py-1 rounded ${previewAngle === 'left' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Esquerda
                </button>
                <button
                  onClick={() => setPreviewAngle('front')}
                  className={`py-1 rounded ${previewAngle === 'front' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Frente
                </button>
                <button
                  onClick={() => setPreviewAngle('rear')}
                  className={`py-1 rounded ${previewAngle === 'rear' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Trás
                </button>
                <button
                  onClick={() => setPreviewAngle('top')}
                  className={`py-1 rounded ${previewAngle === 'top' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  Cima
                </button>
                <button
                  onClick={() => setPreviewAngle('rotation')}
                  className={`py-1 rounded flex items-center justify-center gap-0.5 ${previewAngle === 'rotation' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-amber-400'}`}
                >
                  <RefreshCw className="w-2.5 h-2.5" /> 360°
                </button>
              </div>

              {/* Animated Canvas Stage */}
              <div className="rounded-xl p-3 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/60 border border-slate-800 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden shadow-inner">
                <canvas
                  ref={previewCanvasRef}
                  width={340}
                  height={180}
                  className="block select-none"
                />
              </div>

              {/* Interactive Preview Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Testar Acessórios & Luzes:
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTestNitro(!testNitro)}
                    className={`py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      testNitro
                        ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nitro</span>
                  </button>

                  <button
                    onClick={() => setTestHeadlights(!testHeadlights)}
                    className={`py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      testHeadlights
                        ? 'bg-yellow-500 text-slate-950 border-yellow-300 shadow-md shadow-yellow-500/30'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Faróis</span>
                  </button>

                  <button
                    onClick={() => {
                      setAccessories((prev) => ({
                        ...prev,
                        neon: { ...prev.neon, visible: !prev.neon.visible }
                      }));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      accessories.neon.visible
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Neon</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Color Live Testing */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Simular Troca de Cor na Garagem:</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={previewPrimaryColor}
                      onChange={(e) => setPreviewPrimaryColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[10px] font-mono text-slate-300">Primária</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={previewSecondaryColor}
                      onChange={(e) => setPreviewSecondaryColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[10px] font-mono text-slate-300">Secundária</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ACCESSORY POSITIONING & LAYERING TOOL                          */}
      {/* ===================================================================== */}
      {activeTab === 'accessories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6">
            <div>
              <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <span>Posicionamento de Acessórios & Camadas (Z-Index)</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Ajuste milimetricamente a posição das rodas, aerofólio, nitro e faróis, e defina se eles ficam <strong>na frente</strong> ou <strong>atrás</strong> do desenho do chassi.
              </p>
            </div>

            {/* 1. RODAS (WHEELS) */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono font-bold text-white text-sm">
                  <CarIcon className="w-4 h-4 text-amber-400" />
                  <span>Rodas (Dianteira & Traseira)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Camada:</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setAccessories((prev) => ({
                        ...prev,
                        wheels: { ...prev.wheels, layer: 'behind' }
                      }))}
                      className={`px-2 py-0.5 rounded ${accessories.wheels.layer === 'behind' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      Atrás
                    </button>
                    <button
                      onClick={() => setAccessories((prev) => ({
                        ...prev,
                        wheels: { ...prev.wheels, layer: 'in_front' }
                      }))}
                      className={`px-2 py-0.5 rounded ${accessories.wheels.layer === 'in_front' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      Na Frente
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Roda Traseira X: {accessories.wheels.rearX}</label>
                  <input
                    type="range"
                    min="4"
                    max="22"
                    value={accessories.wheels.rearX}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      wheels: { ...prev.wheels, rearX: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Roda Dianteira X: {accessories.wheels.frontX}</label>
                  <input
                    type="range"
                    min="24"
                    max="44"
                    value={accessories.wheels.frontX}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      wheels: { ...prev.wheels, frontX: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Altura Y (Eixo): {accessories.wheels.rearY}</label>
                  <input
                    type="range"
                    min="12"
                    max="22"
                    value={accessories.wheels.rearY}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      wheels: { ...prev.wheels, rearY: Number(e.target.value), frontY: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tamanho / Raio: {accessories.wheels.radius}</label>
                  <input
                    type="range"
                    min="3"
                    max="8"
                    value={accessories.wheels.radius}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      wheels: { ...prev.wheels, radius: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-300">
                <span>Estilo da Roda:</span>
                <select
                  value={accessories.wheels.style}
                  onChange={(e) => setAccessories((prev) => ({
                    ...prev,
                    wheels: { ...prev.wheels, style: e.target.value as any }
                  }))}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono"
                >
                  <option value="spokes">Raiadas (Esportivas)</option>
                  <option value="steelies">Steelies (Aço & Banda Branca)</option>
                  <option value="mesh">Mesh BBS (Douradas)</option>
                  <option value="spiked">Espetadas / Drift Laranja</option>
                </select>
              </div>
            </div>

            {/* 2. AEROFÓLIO (SPOILER) */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono font-bold text-white text-sm">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Aerofólio (Spoiler Traseiro)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Camada:</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setAccessories((prev) => ({
                        ...prev,
                        spoiler: { ...prev.spoiler, layer: 'behind' }
                      }))}
                      className={`px-2 py-0.5 rounded ${accessories.spoiler.layer === 'behind' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      Atrás
                    </button>
                    <button
                      onClick={() => setAccessories((prev) => ({
                        ...prev,
                        spoiler: { ...prev.spoiler, layer: 'in_front' }
                      }))}
                      className={`px-2 py-0.5 rounded ${accessories.spoiler.layer === 'in_front' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      Na Frente
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Posição X: {accessories.spoiler.x}</label>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={accessories.spoiler.x}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      spoiler: { ...prev.spoiler, x: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Posição Y: {accessories.spoiler.y}</label>
                  <input
                    type="range"
                    min="2"
                    max="18"
                    value={accessories.spoiler.y}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      spoiler: { ...prev.spoiler, y: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Escala: {accessories.spoiler.scale}x</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.1"
                    value={accessories.spoiler.scale}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      spoiler: { ...prev.spoiler, scale: Number(e.target.value) }
                    }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Modelo:</label>
                  <select
                    value={accessories.spoiler.style}
                    onChange={(e) => setAccessories((prev) => ({
                      ...prev,
                      spoiler: { ...prev.spoiler, style: e.target.value as any }
                    }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs font-mono"
                  >
                    <option value="gt_wing">Asa GT Carbono</option>
                    <option value="ducktail">Ducktail Integrado</option>
                    <option value="small">Lip Discreto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. NITRO & FARÓIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nitro Flame */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-xs flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" /> Nitro (Escape)
                  </span>
                  <button
                    onClick={() => setAccessories((prev) => ({
                      ...prev,
                      nitro: {
                        ...prev.nitro,
                        layer: prev.nitro.layer === 'in_front' ? 'behind' : 'in_front'
                      }
                    }))}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                  >
                    Camada: {accessories.nitro.layer === 'in_front' ? 'Frente' : 'Atrás'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Escape X: {accessories.nitro.x}</label>
                    <input
                      type="range"
                      min="0"
                      max="14"
                      value={accessories.nitro.x}
                      onChange={(e) => setAccessories((prev) => ({
                        ...prev,
                        nitro: { ...prev.nitro, x: Number(e.target.value) }
                      }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Escape Y: {accessories.nitro.y}</label>
                    <input
                      type="range"
                      min="12"
                      max="22"
                      value={accessories.nitro.y}
                      onChange={(e) => setAccessories((prev) => ({
                        ...prev,
                        nitro: { ...prev.nitro, y: Number(e.target.value) }
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Headlights */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-xs flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-yellow-400" /> Faróis Dianteiros
                  </span>
                  <button
                    onClick={() => setTestHeadlights(!testHeadlights)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      testHeadlights ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {testHeadlights ? 'Acesos' : 'Apagados'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">Farol X: {accessories.headlights.x}</label>
                    <input
                      type="range"
                      min="36"
                      max="47"
                      value={accessories.headlights.x}
                      onChange={(e) => setAccessories((prev) => ({
                        ...prev,
                        headlights: { ...prev.headlights, x: Number(e.target.value) }
                      }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Farol Y: {accessories.headlights.y}</label>
                    <input
                      type="range"
                      min="8"
                      max="20"
                      value={accessories.headlights.y}
                      onChange={(e) => setAccessories((prev) => ({
                        ...prev,
                        headlights: { ...prev.headlights, y: Number(e.target.value) }
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Preview in Accessories Tab (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col items-center">
            <h4 className="w-full text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Resultado Visual Imediato</span>
              <span className="text-emerald-400 text-[10px] font-bold">Animado</span>
            </h4>

            <div className="w-full rounded-xl p-3 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/60 border border-slate-800 flex items-center justify-center min-h-[220px]">
              <canvas
                ref={previewCanvasRef}
                width={340}
                height={180}
                className="block select-none"
              />
            </div>

            <div className="w-full space-y-2 text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span>Camada das Rodas:</span>
                <span className="text-white font-bold">{accessories.wheels.layer === 'in_front' ? 'Na Frente (In Front)' : 'Atrás (Behind)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Camada do Aerofólio:</span>
                <span className="text-white font-bold">{accessories.spoiler.layer === 'in_front' ? 'Na Frente' : 'Atrás'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Feixe de Luz dos Faróis:</span>
                <span className={testHeadlights ? 'text-yellow-400 font-bold' : 'text-slate-500'}>{testHeadlights ? 'Ligado' : 'Desligado'}</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2.5 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Gravar Configuração de Acessórios</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SAVED CHASSIS LIBRARY                                         */}
      {/* ===================================================================== */}
      {activeTab === 'library' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
                <span>Biblioteca de Chasis Customizados ({customAssets.length})</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Seus projetos salvos com hashes criptografados e configurações multi-ângulo.
              </p>
            </div>

            {/* Botão Importar Imagem */}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImportImage}
                  title="Importar imagem (JPEG/PNG) → CustomCarAsset"
                />
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 cursor-pointer transition-all group-hover:border-emerald-500"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importar Imagem</span>
                </button>
              </label>
            </div>
          </div>

          {customAssets.length === 0 ? (
            <div className="bg-slate-950 rounded-xl p-8 text-center text-slate-500 font-mono text-xs border border-slate-800">
              Nenhum chassi salvo na sua biblioteca ainda. Desenhe e clique em "Salvar Chassi"!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-indigo-500/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-mono font-bold text-white truncate">{asset.name}</div>
                      <div className="text-[10px] font-mono text-emerald-400 truncate">
                        {asset.encryptedHashId || 'CIPHER-SHA256-AUTHENTIC'}
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {asset.auctionEstimate ? asset.auctionEstimate.toLocaleString() : '4,500'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <button
                      onClick={() => {
                        setAssetName(asset.name);
                        setAssetId(asset.id);
                        if (asset.pixels) setPixelsRight(asset.pixels);
                        if (asset.pixelsLeft) setPixelsLeft(asset.pixelsLeft);
                        if (asset.pixelsFront) setPixelsFront(asset.pixelsFront);
                        if (asset.pixelsRear) setPixelsRear(asset.pixelsRear);
                        if (asset.pixelsTop) setPixelsTop(asset.pixelsTop);
                        if (asset.accessoryConfig) setAccessories(asset.accessoryConfig);
                        setActiveTab('editor');
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 cursor-pointer text-center"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => onEquipAssetToCar(activeCar.id, asset)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer text-center"
                    >
                      Equipar
                    </button>

                    {onDeleteAsset && (
                      <button
                        onClick={() => onDeleteAsset(asset.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CRYPTO UNIQUE ID & AUCTION CERTIFICATE                         */}
      {/* ===================================================================== */}
      {activeTab === 'crypto' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-mono font-bold text-white">
                Certificado de Autenticidade e Token Criptografado
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Identificador único gerado por algoritmo de hashing irreversível para validação em leilões e trocas P2P.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                ID Criptografado (Hash SHA-256):
              </label>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 select-all break-all">
                {cryptoCredentials.encryptedHashId}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Assinatura do Criador (ECDSA Signature):
              </label>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-indigo-400 select-all break-all">
                {cryptoCredentials.creatorSignature}
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="text-xs font-mono text-slate-300">
              <span>Score de Raridade Criptográfica: </span>
              <span className="text-indigo-400 font-bold">{cryptoCredentials.rarityScore} / 100</span>
            </div>

            <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
              <span>Valor Base Estimado em Leilão:</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {cryptoCredentials.auctionEstimateCoins.toLocaleString()} Moedas
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
