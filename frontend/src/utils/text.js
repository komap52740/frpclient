const CP1251_BYTE_TO_CODEPOINT = {
  0x80: 0x0402,
  0x81: 0x0403,
  0x82: 0x201a,
  0x83: 0x0453,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x20ac,
  0x89: 0x2030,
  0x8a: 0x0409,
  0x8b: 0x2039,
  0x8c: 0x040a,
  0x8d: 0x040c,
  0x8e: 0x040b,
  0x8f: 0x040f,
  0x90: 0x0452,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x99: 0x2122,
  0x9a: 0x0459,
  0x9b: 0x203a,
  0x9c: 0x045a,
  0x9d: 0x045c,
  0x9e: 0x045b,
  0x9f: 0x045f,
  0xa0: 0x00a0,
  0xa1: 0x040e,
  0xa2: 0x045e,
  0xa3: 0x0408,
  0xa4: 0x00a4,
  0xa5: 0x0490,
  0xa6: 0x00a6,
  0xa7: 0x00a7,
  0xa8: 0x0401,
  0xa9: 0x00a9,
  0xaa: 0x0404,
  0xab: 0x00ab,
  0xac: 0x00ac,
  0xad: 0x00ad,
  0xae: 0x00ae,
  0xaf: 0x0407,
  0xb0: 0x00b0,
  0xb1: 0x00b1,
  0xb2: 0x0406,
  0xb3: 0x0456,
  0xb4: 0x0491,
  0xb5: 0x00b5,
  0xb6: 0x00b6,
  0xb7: 0x00b7,
  0xb8: 0x0451,
  0xb9: 0x2116,
  0xba: 0x0454,
  0xbb: 0x00bb,
  0xbc: 0x0458,
  0xbd: 0x0405,
  0xbe: 0x0455,
  0xbf: 0x0457,
};

const CP1251_CODEPOINT_TO_BYTE = (() => {
  const map = new Map();
  for (let byte = 0; byte <= 0xff; byte += 1) {
    let codePoint;
    if (byte <= 0x7f) {
      codePoint = byte;
    } else if (byte >= 0xc0) {
      codePoint = 0x0410 + (byte - 0xc0);
    } else {
      codePoint = CP1251_BYTE_TO_CODEPOINT[byte];
    }

    if (typeof codePoint === "number") {
      map.set(codePoint, byte);
    }
  }
  return map;
})();

function cp1251CharToByte(ch) {
  if (!ch) return null;
  return CP1251_CODEPOINT_TO_BYTE.get(ch.codePointAt(0)) ?? null;
}

function decodeCp1251Mojibake(value) {
  const bytes = [];
  for (const ch of value) {
    const byte = cp1251CharToByte(ch);
    if (byte == null) {
      return value;
    }
    bytes.push(byte);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

function decodeLatin1Mojibake(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code > 0xff) {
      return value;
    }
    bytes.push(code);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

function mojibakeScore(text) {
  if (!text) return 0;
  const chunks = text.match(/(?:Р.|С.|Ð.|Ñ.)/g) || [];
  const replacement = (text.match(/�/g) || []).length;
  const cyrillic = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const latinArtifacts = (text.match(/[ÃÂ][-ÿ]/g) || []).length;
  return chunks.length * 2 + replacement * 8 + latinArtifacts * 3 - cyrillic * 0.08;
}

function looksLikeMojibake(text) {
  if (!text) return false;
  if (text.includes("�")) return true;
  const chunks = text.match(/(?:Р.|С.|Ð.|Ñ.)/g) || [];
  return chunks.length >= 2;
}

export function normalizeRuText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  if (!looksLikeMojibake(value)) {
    return value;
  }

  const decodedCp1251 = decodeCp1251Mojibake(value);
  const decodedLatin1 = decodeLatin1Mojibake(value);
  const variants = [value, decodedCp1251, decodedLatin1];
  const best = variants.reduce(
    (selected, current) => (mojibakeScore(current) < mojibakeScore(selected) ? current : selected),
    value
  );

  if (best === value) {
    return value;
  }

  if (!/[А-Яа-яЁё]/.test(best)) {
    return value;
  }

  return best;
}
