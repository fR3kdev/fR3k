"""Geode q4/e4m3fn quantization and tile8 packing (experimental PTQ).

Implements Geode engine/src/kernels.cpp's Q4 row and to_tile8 representation.
NOT Geode's original calibrated GPTQ quantizer. Compare accuracy before deployment.
"""
from __future__ import annotations

import numpy as np

LEVELS = np.array([1, 3, 5, 7, 9, 11, 13, 15, -1, -3, -5, -7, -9, -11, -13, -15], dtype=np.float32)
TO_AFFINE = np.array([*(range(8, 16)), *(range(7, -1, -1))], dtype=np.uint8)
FROM_AFFINE = np.empty(16, dtype=np.uint8)
FROM_AFFINE[TO_AFFINE] = np.arange(16, dtype=np.uint8)


def e4m3_positive() -> np.ndarray:
    """Finite, nonnegative E4M3FN values indexed by the 7-bit code."""
    codes = np.arange(127, dtype=np.uint16)
    exp, mant = (codes >> 3), codes & 7
    return np.where(exp == 0, mant / 8.0 * 2.0**-6,
                    (1.0 + mant / 8.0) * np.exp2(exp.astype(np.int16) - 7)).astype(np.float32)


E4 = e4m3_positive()


def choose_global(weights: np.ndarray) -> float:
    """Pick dynamic range for the per-block E4M3 scales, not a calibrated GPTQ scale."""
    x = np.asarray(weights, dtype=np.float32)
    if not np.isfinite(x).all():
        raise ValueError('Non-finite source tensor')
    if x.ndim != 2 or x.shape[1] % 64:
        raise ValueError('Expected [rows, columns_multiple_of_64]')
    maxima = np.max(np.abs(x.reshape(-1, 16)), axis=1) / 15.0
    if not np.any(maxima):
        return 1.0
    # High quantile keeps typical blocks near E4 code 0x50 while retaining outliers.
    target = np.quantile(maxima, 0.99) / 16.0
    return float(max(target, float(maxima.max()) / 400.0, 1e-12))


def encode_q4(weights: np.ndarray, global_scale: float | None = None,
              chunk_rows: int = 64) -> tuple[bytes, float, float]:
    """Quantize an f32 matrix to Geode row-packed q4; return bytes, global and RMSE.

    Per 16-value block search six nearby E4M3 scale codes using squared error.
    The no-zero Q4 levels are Geode's [±1,±3,...,±15].
    """
    w = np.asarray(weights, dtype=np.float32)
    if w.ndim != 2 or w.shape[1] % 64 != 0 or w.shape[0] <= 0:
        raise ValueError('Q4 expects nonempty [rows, cols] and cols % 64 == 0')
    if not np.isfinite(w).all():
        raise ValueError('Invalid NaN/Infinity source weights')
    global_scale = float(global_scale) if global_scale is not None else choose_global(w)
    if not (np.isfinite(global_scale) and global_scale > 0):
        raise ValueError('Invalid matrix global scale')
    rows, cols = w.shape
    codes_per_row, scales_per_row = cols // 2, cols // 16
    result = bytearray(rows * (codes_per_row + scales_per_row))
    total_sq_error = 0.0
    for first in range(0, rows, chunk_rows):
        last = min(rows, first + chunk_rows)
        chunk = w[first:last]
        blocks = chunk.reshape(-1, 16)
        maxima = np.max(np.abs(blocks), axis=1)
        desired = maxima / (15.0 * global_scale)
        middle = np.searchsorted(E4, desired, side='left')
        near = np.clip(middle[:, None] + np.arange(-3, 3, dtype=np.int32), 1, 126)
        scales = E4[near] * global_scale
        scaled = blocks[:, None, :] / scales[:, :, None]
        mag = np.clip(np.rint((np.abs(scaled) - 1.0) / 2.0), 0, 7).astype(np.uint8)
        qcodes = mag + np.where(scaled < 0, 8, 0).astype(np.uint8)
        reconstructed = LEVELS[qcodes] * scales[:, :, None]
        errors = np.sum((reconstructed - blocks[:, None, :])**2, axis=2)
        chosen = np.argmin(errors, axis=1)
        select_codes = qcodes[np.arange(len(blocks)), chosen]
        select_scale = near[np.arange(len(blocks)), chosen].astype(np.uint8)
        # All-zero blocks use zero scale and zero-coded Q4 values.
        zeros = maxima == 0
        select_scale[zeros] = 0
        select_codes[zeros] = 0
        total_sq_error += float(errors[np.arange(len(blocks)), chosen][~zeros].sum())
        paired = select_codes.reshape(last-first, cols//2, 2)
        packed = (paired[:, :, 0] | (paired[:, :, 1] << 4)).astype(np.uint8)
        scale_bytes = select_scale.reshape(last-first, scales_per_row)
        for i in range(last-first):
            offset = (first+i) * (codes_per_row + scales_per_row)
            result[offset:offset+codes_per_row] = packed[i].tobytes()
            result[offset+codes_per_row:offset+codes_per_row+scales_per_row] = scale_bytes[i].tobytes()
    return bytes(result), global_scale, float(np.sqrt(total_sq_error / w.size))


def decode_q4_rows(blob: bytes, rows: int, cols: int, global_scale: float) -> np.ndarray:
    """Decode the untiled Geode q4 row representation, for numerical verification."""
    if cols % 16:
        raise ValueError('columns must be divisible by 16')
    codes_len = cols // 2
    scales_len = cols // 16
    raw = np.frombuffer(blob, dtype=np.uint8)
    if raw.size != rows * (codes_len + scales_len):
        raise ValueError('Q4 matrix data length mismatch')
    mat = raw.reshape(rows, codes_len + scales_len)
    codes = mat[:, :codes_len]
    halves = np.stack([codes & 15, codes >> 4], axis=-1).reshape(rows, cols)
    scales = E4[mat[:, codes_len:]]
    return (LEVELS[halves.reshape(rows, cols//16, 16)] * scales[:, :, None] * global_scale).reshape(rows, cols)


def tile8_q4(rows_blob: bytes, rows: int, cols: int) -> bytes:
    """Replicate Geode's to_tile8(Q4) used for streamed expert matrices.

    src: row-by-row [all codes then scales]; dst: tiles of 32 rows, 64-column
    chunks, eight interleaved quads, affine nibble codes and E4M3 scales.
    """
    if rows % 32 or cols % 64:
        raise ValueError('Tile8 requires rows % 32 == 0 and cols % 64 == 0')
    rb, nch = cols * 9 // 16, cols // 64
    raw = np.frombuffer(rows_blob, dtype=np.uint8)
    if raw.size != rows * rb:
        raise ValueError('Tile8 source bytes mismatch')
    out = bytearray(raw.size)
    for row0 in range(0, rows, 32):
        tile = raw[row0*rb:(row0+32)*rb].reshape(32, rb)
        # Source codes: (quad, row, chunk, word, byte).
        code = tile[:, :cols//2].reshape(8, 4, nch, 8, 4)
        # Destination word position: (chunk, word, quad, row, byte).
        affine = TO_AFFINE[code & 15] | (TO_AFFINE[code >> 4] << 4)
        packed_codes = affine.transpose(2, 3, 0, 1, 4).tobytes()
        scales = tile[:, cols//2:].reshape(8, 4, nch, 4)
        packed_scales = scales.transpose(2, 0, 3, 1).tobytes()
        start = row0*rb
        out[start:start+32*rb] = packed_codes + packed_scales
    return bytes(out)


def untile8_q4(tiled: bytes, rows: int, cols: int) -> bytes:
    """Inverse of tile8, used to test byte-exact layout parity."""
    if rows % 32 or cols % 64:
        raise ValueError('Tile8 requires rows % 32 == 0 and cols % 64 == 0')
    rb, nch = cols * 9 // 16, cols // 64
    raw = np.frombuffer(tiled, dtype=np.uint8)
    if raw.size != rows * rb:
        raise ValueError('Tile8 bytes mismatch')
    out = bytearray(raw.size)
    for row0 in range(0, rows, 32):
        tile = raw[row0*rb:(row0+32)*rb]
        code = tile[:32*cols//2].reshape(nch, 8, 8, 4, 4).transpose(2, 3, 0, 1, 4)
        native = FROM_AFFINE[code & 15] | (FROM_AFFINE[code >> 4] << 4)
        scales = tile[32*cols//2:].reshape(nch, 8, 4, 4).transpose(1, 3, 0, 2)
        cb = native.reshape(32, cols//2)
        sb = scales.reshape(32, cols//16)
        for r in range(32):
            p = (row0+r)*rb
            out[p:p+cols//2] = cb[r].tobytes()
            out[p+cols//2:p+rb] = sb[r].tobytes()
    return bytes(out)