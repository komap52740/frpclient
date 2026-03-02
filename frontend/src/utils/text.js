const CP1251_SPECIAL_CHARS =
  "ЂЃ‚ѓ„…†‡€‰‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ";
const CP1251_A_BLOCK =
  "\u00A0ЎўЈ¤Ґ¦§Ё©Є«¬\u00AD®Ї";
const CP1251_B_BLOCK =
  "°±Ііґµ¶·ё№є»јЅѕї";

const SPECIAL_CHAR_TO_BYTE = (() => {
  const map = {};

  for (let i = 0; i < CP1251_SPECIAL_CHARS.length; i += 1) {
    const ch = CP1251_SPECIAL_CHARS[i];
    if (ch !== "\u0098") {
      map[ch] = 0x80 + i;
    }
  }

  for (let i = 0; i < CP1251_A_BLOCK.length; i += 1) {
    map[CP1251_A_BLOCK[i]] = 0xa0 + i;
  }

  for (let i = 0; i < CP1251_B_BLOCK.length; i += 1) {
    map[CP1251_B_BLOCK[i]] = 0xb0 + i;
  }

  return map;
})();

function cp1251CharToByte(ch) {
  if (!ch) return null;
  const code = ch.charCodeAt(0);

  if (code <= 0x7f) return code;

  if (code >= 0x0410 && code <= 0x044f) {
    return code - 0x350;
  }

  return SPECIAL_CHAR_TO_BYTE[ch] ?? null;
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
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return decoded;
  } catch {
    return value;
  }
}

function mojibakeScore(text) {
  if (!text) return 0;
  const chunks = text.match(/(?:Р.|С.|Ð.|Ñ.)/g) || [];
  const replacement = (text.match(/�/g) || []).length;
  return chunks.length + replacement * 2;
}

function looksLikeMojibake(text) {
  return /(?:Р.|С.|Ð.|Ñ.)/.test(text);
}

export function normalizeRuText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }
  if (!looksLikeMojibake(value)) {
    return value;
  }

  const decoded = decodeCp1251Mojibake(value);
  if (decoded === value) {
    return value;
  }
  if (!/[А-Яа-яЁё]/.test(decoded)) {
    return value;
  }

  return mojibakeScore(decoded) < mojibakeScore(value) ? decoded : value;
}

