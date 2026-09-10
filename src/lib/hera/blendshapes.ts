import type { HeraViseme } from "./types";

/** ARKit-style morphs required on the Hera face mesh. */
export const HERA_BLENDSHAPE_NAMES = [
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookUp",
  "eyeLookDown",
  "eyeLookLeft",
  "eyeLookRight",
  "browInnerUp",
  "browDownLeft",
  "browDownRight",
] as const;

export type HeraBlendshapeName = (typeof HERA_BLENDSHAPE_NAMES)[number];

export type HeraBlendshapeWeights = Record<HeraBlendshapeName, number>;

export function emptyBlendshapes(): HeraBlendshapeWeights {
  const out = {} as HeraBlendshapeWeights;
  for (const name of HERA_BLENDSHAPE_NAMES) out[name] = 0;
  return out;
}

/** Viseme → mouth morphs. Lips never come from audio volume. */
export const VISEME_TO_BLENDSHAPES: Record<string, Partial<HeraBlendshapeWeights>> = {
  sil: { mouthClose: 0.18, jawOpen: 0 },
  PP: { mouthClose: 1, jawOpen: 0.02, mouthPucker: 0.12 },
  FF: {
    jawOpen: 0.14,
    mouthLowerDownLeft: 0.42,
    mouthLowerDownRight: 0.42,
    mouthUpperUpLeft: 0.28,
    mouthUpperUpRight: 0.28,
  },
  TH: { jawOpen: 0.22, mouthUpperUpLeft: 0.32, mouthUpperUpRight: 0.32, mouthFunnel: 0.12 },
  DD: { jawOpen: 0.28, mouthClose: 0.08 },
  kk: { jawOpen: 0.2, mouthClose: 0.12 },
  CH: { jawOpen: 0.26, mouthFunnel: 0.48, mouthPucker: 0.1 },
  SS: { jawOpen: 0.1, mouthSmileLeft: 0.22, mouthSmileRight: 0.22, mouthClose: 0.08 },
  nn: { jawOpen: 0.16, mouthClose: 0.2 },
  RR: { jawOpen: 0.22, mouthFunnel: 0.38 },
  aa: { jawOpen: 0.78, mouthClose: 0, mouthLowerDownLeft: 0.22, mouthLowerDownRight: 0.22 },
  E: { jawOpen: 0.36, mouthSmileLeft: 0.42, mouthSmileRight: 0.42 },
  I: { jawOpen: 0.2, mouthSmileLeft: 0.55, mouthSmileRight: 0.55 },
  O: { jawOpen: 0.48, mouthFunnel: 0.72, mouthPucker: 0.28 },
  U: { jawOpen: 0.18, mouthPucker: 0.88, mouthFunnel: 0.4 },
};

export function visemeBlendshapes(viseme: HeraViseme | null | undefined): Partial<HeraBlendshapeWeights> {
  if (!viseme || viseme === "sil") return VISEME_TO_BLENDSHAPES.sil;
  return VISEME_TO_BLENDSHAPES[viseme] ?? VISEME_TO_BLENDSHAPES.aa;
}

export function charToViseme(ch: string): HeraViseme {
  const c = ch.toLowerCase();
  if (!c || /\s/.test(c)) return "sil";
  if ("mbp".includes(c)) return "PP";
  if ("fv".includes(c)) return "FF";
  if (c === "w") return "U";
  if (c === "r") return "RR";
  if ("szx".includes(c)) return "SS";
  if ("tdnl".includes(c)) return "DD";
  if ("kgcq".includes(c)) return "kk";
  if (c === "a") return "aa";
  if (c === "e") return "E";
  if (c === "i" || c === "y") return "I";
  if (c === "o") return "O";
  if (c === "u") return "U";
  return "sil";
}
