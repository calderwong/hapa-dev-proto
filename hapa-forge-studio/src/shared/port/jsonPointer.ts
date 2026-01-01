export type JsonPointerError = {
  message: string;
  pointer: string;
  segment?: string;
  atPointer?: string;
};

export type JsonPointerResult =
  | { ok: true; value: any }
  | { ok: false; error: JsonPointerError };

const decodeSegment = (seg: string) => seg.replace(/~1/g, '/').replace(/~0/g, '~');

const isArrayIndex = (seg: string) => /^[0-9]+$/.test(seg);

/**
 * Resolve a JSON pointer (RFC6901-ish) into an object.
 *
 * - Supports "/" separated segments
 * - Decodes "~1" -> "/" and "~0" -> "~"
 * - Handles arrays: if current value is an Array and the segment is a base-10 integer, treat as index.
 *
 * Never throws; returns structured errors instead.
 */
export const resolveJsonPointer = (obj: any, pointer: string): JsonPointerResult => {
  try {
    if (pointer === '' || pointer === '#') return { ok: true, value: obj };

    // Support URI fragment form like "#/steps/0/output"
    let p = pointer;
    if (p.startsWith('#')) {
      p = p.slice(1);
      try {
        p = decodeURIComponent(p);
      } catch {
        // ignore decode failures; keep raw
      }
    }

    if (p === '') return { ok: true, value: obj };
    if (!p.startsWith('/')) {
      return {
        ok: false,
        error: { message: 'JSON pointer must start with "/"', pointer },
      };
    }

    const segments = p.split('/').slice(1).map(decodeSegment);

    let cur: any = obj;
    let atPointer = '';

    for (const seg of segments) {
      const nextAt = atPointer + '/' + seg.replace(/~/g, '~0').replace(/\//g, '~1');

      if (Array.isArray(cur) && isArrayIndex(seg)) {
        const idx = Number(seg);
        if (!Number.isFinite(idx) || idx < 0 || idx >= cur.length) {
          return {
            ok: false,
            error: {
              message: `Array index out of bounds: ${seg}`,
              pointer,
              segment: seg,
              atPointer,
            },
          };
        }
        cur = cur[idx];
        atPointer = nextAt;
        continue;
      }

      if (cur && typeof cur === 'object' && seg in cur) {
        cur = (cur as any)[seg];
        atPointer = nextAt;
        continue;
      }

      return {
        ok: false,
        error: {
          message: `Missing segment: ${seg}`,
          pointer,
          segment: seg,
          atPointer,
        },
      };
    }

    return { ok: true, value: cur };
  } catch (e: any) {
    return {
      ok: false,
      error: {
        message: e?.message || String(e),
        pointer,
      },
    };
  }
};
