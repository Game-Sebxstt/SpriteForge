/**
 * Minimal APNG (Animated PNG) encoder (Phase 3 §3.1).
 *
 * Encodes a sequence of equally-sized RGBA frames into an animated PNG. Each
 * frame is stored as a full-frame IDAT/fdAT using zlib's stored (uncompressed)
 * deflate blocks, so there is no dependency on a compression library. The output
 * is a valid APNG that browsers animate; file size is larger than a compressed
 * PNG but correctness and zero-dependency are the priorities here.
 *
 * References: PNG (RFC 2083) and the APNG specification (acTL/fcTL/fdAT chunks).
 */

/** CRC-32 table (polynomial 0xEDB88320), computed once. */
const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/** Adler-32 checksum used by the zlib wrapper. */
function adler32(bytes: Uint8Array): number {
    let a = 1;
    let b = 0;
    const MOD = 65521;
    for (let i = 0; i < bytes.length; i++) {
        a = (a + bytes[i]!) % MOD;
        b = (b + a) % MOD;
    }
    return ((b << 16) | a) >>> 0;
}

/** Wraps raw bytes in a zlib stream using stored (uncompressed) deflate blocks. */
function zlibStore(data: Uint8Array): Uint8Array {
    const blocks: number[] = [];
    // zlib header: CMF=0x78, FLG=0x01 (no dict, fastest).
    blocks.push(0x78, 0x01);

    const MAX = 0xffff;
    let offset = 0;
    while (offset < data.length) {
        const chunk = Math.min(MAX, data.length - offset);
        const isLast = offset + chunk >= data.length;
        blocks.push(isLast ? 1 : 0); // BFINAL flag, BTYPE=00 (stored)
        blocks.push(chunk & 0xff, (chunk >>> 8) & 0xff);
        const nlen = ~chunk & 0xffff;
        blocks.push(nlen & 0xff, (nlen >>> 8) & 0xff);
        for (let i = 0; i < chunk; i++) blocks.push(data[offset + i]!);
        offset += chunk;
    }

    const adler = adler32(data);
    blocks.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
    return new Uint8Array(blocks);
}

/** Prepends the PNG per-scanline filter byte (0 = none) to each row. */
function addFilterBytes(rgba: Uint8Array, width: number, height: number): Uint8Array {
    const stride = width * 4;
    const out = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        out[y * (stride + 1)] = 0;
        out.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
    }
    return out;
}

/** Writes a 32-bit big-endian integer. */
function u32(value: number): number[] {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** Assembles a PNG chunk (length + type + data + CRC). */
function chunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
    const body = new Uint8Array(typeBytes.length + data.length);
    body.set(typeBytes, 0);
    body.set(data, typeBytes.length);

    const out = new Uint8Array(4 + body.length + 4);
    out.set(u32(data.length), 0);
    out.set(body, 4);
    out.set(u32(crc32(body)), 4 + body.length);
    return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

/**
 * Encodes equally-sized RGBA frames into an APNG blob.
 * @param frames - RGBA pixel buffers (length `width*height*4`), same size.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param delayMs - Per-frame delay in milliseconds.
 * @param loops - Loop count (0 = infinite).
 * @returns A `Blob` of type `image/apng`.
 */
export function encodeAPNG(
    frames: Uint8Array[],
    width: number,
    height: number,
    delayMs: number,
    loops: number = 0
): Blob {
    const parts: Uint8Array[] = [];
    // PNG signature.
    parts.push(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // IHDR: 8-bit, color type 6 (RGBA).
    const ihdr = new Uint8Array([
        ...u32(width), ...u32(height), 8, 6, 0, 0, 0,
    ]);
    parts.push(chunk("IHDR", ihdr));

    // acTL: number of frames + loop count.
    parts.push(chunk("acTL", new Uint8Array([...u32(frames.length), ...u32(loops)])));

    let sequence = 0;
    const delayNum = Math.max(1, Math.round(delayMs));

    frames.forEach((frame, index) => {
        // fcTL for this frame.
        const fctl = new Uint8Array([
            ...u32(sequence++),
            ...u32(width),
            ...u32(height),
            ...u32(0), // x offset
            ...u32(0), // y offset
            (delayNum >>> 8) & 0xff, delayNum & 0xff, // delay numerator (ms)
            0x03, 0xe8,                                 // delay denominator = 1000
            0, // dispose: none
            0, // blend: source
        ]);
        parts.push(chunk("fcTL", fctl));

        const compressed = zlibStore(addFilterBytes(frame, width, height));
        if (index === 0) {
            parts.push(chunk("IDAT", compressed));
        } else {
            // fdAT: sequence number + frame data.
            const fdat = new Uint8Array(4 + compressed.length);
            fdat.set(u32(sequence++), 0);
            fdat.set(compressed, 4);
            parts.push(chunk("fdAT", fdat));
        }
    });

    parts.push(chunk("IEND", new Uint8Array(0)));
    const bytes = concat(parts);
    return new Blob([bytes.buffer.slice(0) as ArrayBuffer], { type: "image/apng" });
}
