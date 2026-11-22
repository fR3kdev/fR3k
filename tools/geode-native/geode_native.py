#!/usr/bin/env python3
"""FR3K experimental Qwen3.6 Geode-native selective-patch builder.

No GGUF import. Streams BF16 source tensors via HTTP ranges, preserves untouched
Q4 Geode files, re-encodes changed tensors, and writes a new isolated pack.
Geode loader-format validation is not a hardware inference test.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np

from q4_codec import encode_q4, tile8_q4

SOURCE = 'wangzhang/Qwen3.6-35B-A3B-abliterated-v2'
BASE = 'Maximilian228/Geode-Qwen3.6-35B-A3B'
RESERVE = 2 * 1024 ** 3
MAX_HEADER = 8 * 1024 ** 2


def request(url: str, start: int | None = None, end: int | None = None, timeout: int = 90):
    headers = {'User-Agent': 'FR3K-GeodeNative/0.1 (experimental)'}
    if start is not None:
        headers['Range'] = f'bytes={start}-{end if end is not None else ""}'
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout)


def get_json(url: str) -> dict:
    with request(url, timeout=40) as r:
        return json.load(r)


def repo_sha(repo: str) -> str:
    result = get_json(f'https://huggingface.co/api/models/{repo}')
    sha = result.get('sha')
    if not isinstance(sha, str) or len(sha) != 40:
        raise ValueError(f'Missing revision SHA for {repo}')
    return sha


def hf_url(repo: str, revision: str, file: str) -> str:
    path = '/'.join(urllib.parse.quote(part, safe='') for part in file.split('/'))
    return f'https://huggingface.co/{repo}/resolve/{revision}/{path}'


def ranged_bytes(url: str, first: int, last: int, retries: int = 4) -> bytes:
    if first < 0 or last < first:
        raise ValueError('Invalid range')
    size = last - first + 1
    for attempt in range(retries):
        try:
            with request(url, first, last, timeout=180) as response:
                if response.status != 206:
                    raise RuntimeError(f'Range request returned HTTP {response.status}, refuse full download')
                got_range = response.headers.get('Content-Range', '')
                if not got_range.startswith(f'bytes {first}-{last}/'):
                    raise RuntimeError(f'Content-Range mismatch: {got_range}')
                data = response.read(size + 1)
            if len(data) != size:
                raise RuntimeError(f'Short or oversized HTTP range: expected {size}, got {len(data)}')
            return data
        except (OSError, RuntimeError, urllib.error.HTTPError) as ex:
            if attempt + 1 == retries:
                raise
            print(f'RETRY range {first}-{last}: {type(ex).__name__}: {ex}', file=sys.stderr)
            time.sleep(min(10 * (attempt + 1), 30))
    raise AssertionError('unreachable')


def ensure_space(path: Path, needed: int):
    free = shutil.disk_usage(path).free
    if free < needed + RESERVE:
        raise RuntimeError(f'BLOCKED: need {needed:,} bytes plus {RESERVE:,} reserve, free {free:,} on {path}')


def check_sha(file: Path, expected: str, expected_size: int):
    if file.stat().st_size != expected_size:
        raise RuntimeError(f'Wrong size for {file}: expected {expected_size}')
    h = hashlib.sha256()
    with file.open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    actual = h.hexdigest()
    if expected and actual.lower() != expected.lower():
        raise RuntimeError(f'Integrity failure: {file}: got {actual}, expected {expected}')
    return actual


def download_file(url: str, dest: Path, size: int, sha256: str):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file():
        print('VERIFY existing', dest, flush=True)
        check_sha(dest, sha256, size)
        return
    part = dest.with_name(dest.name + '.part')
    had = part.stat().st_size if part.exists() else 0
    if had > size:
        raise RuntimeError('Oversized partial file: manual inspection required')
    ensure_space(dest.parent, size - had)
    url += ('&' if '?' in url else '?') + 'download=true'
    for attempt in range(15):
        had = part.stat().st_size if part.exists() else 0
        if had == size:
            break
        headers = {'User-Agent': 'FR3K-GeodeNative/0.1'}
        if had:
            headers['Range'] = f'bytes={had}-'
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=150) as response:
                if had and response.status != 206:
                    raise RuntimeError(f'Resume refused with HTTP {response.status}: no overwrite')
                with part.open('ab' if had else 'wb') as out:
                    while True:
                        chunk = response.read(4 * 1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
        except Exception as e:
            print(f'RETRY {dest.name} attempt={attempt+1}, have={part.stat().st_size if part.exists() else 0}: {e}', flush=True)
            time.sleep(min(attempt * 3 + 3, 30))
    if not part.exists() or part.stat().st_size != size:
        raise RuntimeError(f'Partial file {part}: got {part.stat().st_size if part.exists() else 0}, expected {size}')
    print('VERIFY downloaded', dest.name, flush=True)
    check_sha(part, sha256, size)
    os.replace(part, dest)


class ShardReader:
    """One safetensors shard. Reads only selected byte ranges."""
    def __init__(self, repo: str, revision: str, filename: str):
        self.filename = filename
        self.url = hf_url(repo, revision, filename)
        head = ranged_bytes(self.url, 0, 7)
        self.header_length = struct.unpack('<Q', head)[0]
        if not (0 < self.header_length < MAX_HEADER):
            raise RuntimeError(f'Unexpected safetensors header length {self.header_length}')
        header = ranged_bytes(self.url, 8, 7 + self.header_length)
        self.table = json.loads(header.decode('utf-8'))
        self.data_offset = 8 + self.header_length

    def metadata(self, tensor: str) -> dict:
        d = self.table.get(tensor)
        if not d or not isinstance(d, dict):
            raise KeyError(f'Missing {tensor} from {self.filename}')
        return d

    def tensor(self, tensor: str, shape: tuple[int, ...]) -> np.ndarray:
        d = self.metadata(tensor)
        if tuple(d['shape']) != tuple(shape):
            raise RuntimeError(f'{tensor} unexpected source shape {d["shape"]} instead of {shape}')
        dtype = d['dtype']
        if dtype not in ('BF16', 'F16', 'F32'):
            raise RuntimeError(f'Unsupported dtype {dtype} for {tensor}')
        a, b = d['data_offsets']
        nbytes = math.prod(shape) * {'BF16': 2, 'F16': 2, 'F32': 4}[dtype]
        if b - a != nbytes:
            raise RuntimeError(f'{tensor} tensor bytes incorrect')
        raw = ranged_bytes(self.url, self.data_offset + a, self.data_offset + b - 1)
        if dtype == 'BF16':
            bits = np.frombuffer(raw, dtype='<u2').astype('<u4') << 16
            return bits.view('<f4').reshape(shape)
        if dtype == 'F16':
            return np.frombuffer(raw, dtype='<f2').astype('<f4').reshape(shape)
        return np.frombuffer(raw, dtype='<f4').copy().reshape(shape)


class HFSource:
    def __init__(self, index: dict, revision: str, repo: str = SOURCE):
        self.map = index['weight_map']
        self.revision = revision
        self.repo = repo
        self.shards: dict[str, ShardReader] = {}

    def reader(self, name: str) -> ShardReader:
        shard = self.map.get(name)
        if not shard:
            raise KeyError(f'Source index does not contain {name}')
        if shard not in self.shards:
            self.shards[shard] = ShardReader(self.repo, self.revision, shard)
        return self.shards[shard]

    def tensor(self, name: str, shape: tuple[int, ...]) -> np.ndarray:
        return self.reader(name).tensor(name, shape)


def build_plan(manifest: dict, index: dict, source_revision: str, base_revision: str) -> dict:
    cfg = manifest['config']
    if manifest.get('format') != 'geode-pack' or manifest.get('version') != 1 or manifest.get('arch') != 'qwen35moe':
        raise RuntimeError('Wrong or unsupported Geode model pack')
    if manifest.get('formats', {}).get('q4', {}).get('layout') != 'tile8':
        raise RuntimeError('This implementation requires q4 tile8 experts')
    layers = cfg['num_hidden_layers']
    hidden = cfg['hidden_size']
    ff = cfg['moe_intermediate_size']
    experts = cfg['num_experts']
    if (layers, hidden, ff, experts) != (40, 2048, 512, 256):
        raise RuntimeError(f'Unsupported architecture geometry {(layers, hidden, ff, experts)}')
    weight_map = index.get('weight_map', {})
    required = []
    mappings = []
    for i in range(layers):
        prefix = f'model.language_model.layers.{i}.'
        for src, target in [
            ('mlp.experts.down_proj', None),
            ('mlp.shared_expert.down_proj.weight', f'layers.{i}.mlp.shared_expert.down_proj.weight'),
            ('self_attn.o_proj.weight', f'layers.{i}.self_attn.o_proj.weight'),
        ]:
            name = prefix + src
            if target is not None and target not in manifest['tensors']:
                if src.startswith('self_attn.'):
                    continue  # Only every fourth layer is full attention
                raise RuntimeError(f'Geode manifest lacks {target}')
            if name not in weight_map:
                if src.startswith('self_attn.') and target not in manifest['tensors']:
                    continue
                raise RuntimeError(f'Source lacks {name}')
            required.append(name)
            mappings.append({'source': name, 'target': target or f'layer.{i}:expert.down_proj', 'shard': weight_map[name]})
        if i >= len(manifest['experts']['layers']):
            raise RuntimeError('Incomplete Geode expert table')
    return {'schema': 1, 'source_repo': SOURCE, 'source_revision': source_revision,
            'base_repo': BASE, 'base_revision': base_revision,
            'layers': layers, 'experts_per_layer': experts,
            'required_tensors': required, 'mappings': mappings,
            'file_bytes': sum(f['size'] for f in manifest['files']),
            'quantization': 'experimental E4M3FN q4 PTQ (not Geode GPTQ)',
            'fidelity': 'hybrid; source base revision is not provably identical to Geode source'}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def dump_json(path: Path, obj: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp')
    with temp.open('w') as f:
        json.dump(obj, f, indent=2, sort_keys=True)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)


def stage(manifest: dict, directory: Path, revision: str):
    directory.mkdir(parents=True, exist_ok=True)
    ensure_space(directory, sum(f['size'] for f in manifest['files'] if not (directory/f['name']).is_file()))
    for idx, f in enumerate(manifest['files']):
        name = f['name']
        print(f'BASE [{idx+1}/{len(manifest["files"])}] {name}', flush=True)
        download_file(hf_url(BASE, revision, 'Q4/' + name), directory/name, int(f['size']), f.get('sha256', ''))
    dump_json(directory/'geode.json', manifest)
    print('STAGED base pack: every file verified', flush=True)


def verify_pack(directory: Path, manifest: dict, hashes: bool = True):
    for f in manifest['files']:
        path = directory / f['name']
        if not path.is_file():
            if f.get('optional'):
                continue
            raise RuntimeError(f'Missing {path}')
        if hashes:
            check_sha(path, f.get('sha256', ''), f['size'])
        elif path.stat().st_size != f['size']:
            raise RuntimeError(f'Wrong size: {path}')
    print('PACK VERIFIED', directory, 'sha256=' + str(hashes), flush=True)


def copy_base(base_dir: Path, output: Path, manifest: dict):
    output.mkdir(parents=True, exist_ok=True)
    missing = [f for f in manifest['files'] if not (output/f['name']).exists()]
    ensure_space(output, sum(f['size'] for f in missing))
    for f in manifest['files']:
        dst, src = output/f['name'], base_dir/f['name']
        if dst.exists():
            if dst.stat().st_size != f['size']:
                raise RuntimeError('Interrupted/inconsistent copy: ' + str(dst))
            continue
        part = output/(f['name']+'.copying')
        if part.exists():
            part.unlink()  # Temporary output file, not an original
        print('COPY', src, '->', dst, flush=True)
        shutil.copyfile(src, part)
        check_sha(part, f.get('sha256', ''), f['size'])
        os.replace(part, dst)
    dump_json(output/'geode.json', manifest)


def update_bytes(file: Path, offset: int, payload: bytes):
    if offset < 0 or offset + len(payload) > file.stat().st_size:
        raise RuntimeError(f'Out-of-bounds patch {file} [{offset}, {offset+len(payload)})')
    with file.open('r+b', buffering=0) as f:
        f.seek(offset)
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())


def patch_layer(i: int, output: Path, manifest: dict, source: HFSource, dry_run: bool):
    cfg = manifest['config']
    hidden, ff, experts = cfg['hidden_size'], cfg['moe_intermediate_size'], cfg['num_experts']
    e = manifest['experts']['layers'][i]
    if 'stride' not in e or e.get('format') != 'q4':
        raise RuntimeError(f'Unsupported expert layout in layer {i}')
    rowbytes_gu = hidden * 9 // 16
    gu_bytes = 2 * ff * rowbytes_gu
    dn_bytes = hidden * (ff * 9 // 16)
    if e['stride'] != gu_bytes + dn_bytes:
        raise RuntimeError(f'Unexpected expert stride in layer {i}')
    scale_name = f'layers.{i}.mlp.experts.scales'
    scale_desc = manifest['tensors'][scale_name]
    if scale_desc['shape'] != [experts, 2] or scale_desc['type'] != 'f32':
        raise RuntimeError(f'Unsupported expert scales tensor {scale_name}')
    src_prefix = f'model.language_model.layers.{i}.'
    source_down = src_prefix + 'mlp.experts.down_proj'
    down_reader = source.reader(source_down)
    down_desc = down_reader.metadata(source_down)
    if tuple(down_desc['shape']) != (experts, hidden, ff):
        raise RuntimeError(f'Source expert down shape mismatch {source_down}: {down_desc["shape"]}')
    if dry_run:
        print('DRY-RUN layer', i, e['file'], 'source', down_reader.filename)
        return
    full_down = source.tensor(source_down, (experts, hidden, ff))
    expert_path = output/e['file']
    scale_file = output/scale_desc['file']
    if e['offset'] + (experts-1)*e['stride'] + gu_bytes + dn_bytes > expert_path.stat().st_size:
        raise RuntimeError(f'Expert layer {i} offset exceeds file size')
    # Flush once per layer rather than fsync ~512 times; the layer is idempotent
    # and journaled only after all expert + dense projection edits complete.
    with expert_path.open('r+b', buffering=0) as expert_out, scale_file.open('r+b', buffering=0) as scale_out:
        for x in range(experts):
            pack, global_dn, err = encode_q4(full_down[x])
            tile = tile8_q4(pack, hidden, ff)
            if len(tile) != dn_bytes:
                raise AssertionError('Expert encoded length mismatch')
            expert_out.seek(e['offset'] + x*e['stride'] + gu_bytes)
            expert_out.write(tile)
            scale_off = scale_desc['offset'] + (2*x+1)*4
            scale_out.seek(scale_off)
            scale_out.write(struct.pack('<f', global_dn))
            if x % 64 == 0:
                print(f'LAYER {i}: patched expert {x}/{experts}, rmse={err:.6g}', flush=True)
        expert_out.flush()
        scale_out.flush()
        os.fsync(expert_out.fileno())
        os.fsync(scale_out.fileno())
    del full_down
    for name in ('mlp.shared_expert.down_proj.weight', 'self_attn.o_proj.weight'):
        target = f'layers.{i}.' + name
        if target not in manifest['tensors']:
            continue
        entry = manifest['tensors'][target]
        if entry['type'] != 'q4' or len(entry['shape']) != 2:
            raise RuntimeError(f'Unsupported native tensor {target}')
        srcname = src_prefix + name
        shape = tuple(entry['shape'])
        arr = source.tensor(srcname, shape)
        packed, scale, rmse = encode_q4(arr)
        if len(packed) != math.prod(shape) * 9 // 16:
            raise RuntimeError(f'Wrong Q4 packed size for {target}')
        update_bytes(output/entry['file'], entry['offset'], packed)
        entry['global'] = scale
        print(f'LAYER {i}: patched {target}, rmse={rmse:.6g}', flush=True)
    print('FINISHED layer', i, flush=True)


def finalize(output: Path, manifest: dict, plan: dict):
    for f in manifest['files']:
        path = output/f['name']
        f['sha256'] = check_sha(path, '', f['size'])
    manifest['name'] = 'FR3K Qwen3.6-35B-A3B V2 abliterated (experimental Q4)'
    manifest['description'] = 'FR3K hybrid Q4 selectively patched from abliterated V2 BF16; uncalibrated PTQ, experimental, independently verify quality.'
    manifest['source'] = plan['source_repo'] + '@' + plan['source_revision']
    manifest.pop('quality', None)  # Previous Geode calibration benchmark does not apply.
    manifest['fr3k_provenance'] = {'base_repo': plan['base_repo'], 'base_revision': plan['base_revision'],
        'source_repo': plan['source_repo'], 'source_revision': plan['source_revision'],
        'quantization': plan['quantization'], 'tested_on_hardware': False,
        'status': 'CONVERSION_OUTPUT_UNVERIFIED_ON_DEVICE'}
    dump_json(output/'geode.json', manifest)
    verify_pack(output, manifest)
    (output/'INCOMPLETE').unlink(missing_ok=True)
    print('PACK READY FOR HARDWARE TEST, NOT VERIFIED INFERENCE', flush=True)


def execute(args):
    ref = Path(args.reference)
    manifest = load_json(ref/'geode.json')
    index = load_json(ref/'model.safetensors.index.json')
    planpath = ref/'plan.json'
    if planpath.exists():
        plan = load_json(planpath)
    else:
        src_revision = repo_sha(SOURCE)
        base_revision = repo_sha(BASE)
        plan = build_plan(manifest, index, src_revision, base_revision)
        dump_json(planpath, plan)
    if args.action == 'inspect':
        print(json.dumps({k:v for k,v in plan.items() if k != 'mappings' and k != 'required_tensors'}, indent=2))
        print('mapped tensors', len(plan['mappings']))
        return
    base_dir = Path(args.base_dir)
    if args.action == 'stage':
        stage(manifest, base_dir, plan['base_revision'])
        return
    if args.action == 'verify-base':
        verify_pack(base_dir, manifest)
        return
    if args.action == 'build':
        verify_pack(base_dir, manifest)
        output = Path(args.output)
        if output.resolve() == base_dir.resolve():
            raise RuntimeError('Refusing to patch the original base staging pack')
        journal = output/'fr3k-progress.json'
        if not journal.exists():
            if output.exists() and any(output.iterdir()):
                raise RuntimeError('Output directory already contains files without a journal; refusing overwrite')
            copy_base(base_dir, output, manifest)
            (output/'INCOMPLETE').write_text('Never use this pack until complete and validated.\n')
            done = {'source_revision': plan['source_revision'], 'base_revision': plan['base_revision'], 'completed_layers': []}
            dump_json(journal, done)
        done = load_json(journal)
        if done.get('source_revision') != plan['source_revision'] or done.get('base_revision') != plan['base_revision']:
            raise RuntimeError('Journal revision mismatch. Do not mix source models.')
        current = load_json(output/'geode.json')
        source = HFSource(index, plan['source_revision'])
        for i in range(40):
            if i in done['completed_layers']:
                continue
            patch_layer(i, output, current, source, dry_run=args.dry_run)
            if args.dry_run:
                continue
            done['completed_layers'].append(i)
            dump_json(output/'geode.json', current)
            dump_json(journal, done)
        if not args.dry_run and len(done['completed_layers']) == 40:
            finalize(output, current, plan)
    elif args.action == 'verify-output':
        output = Path(args.output)
        if (output/'INCOMPLETE').exists():
            raise RuntimeError('Output is incomplete. Never deploy it.')
        verify_pack(output, load_json(output/'geode.json'))
    else:
        raise ValueError('Unknown action')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['inspect','stage','verify-base','build','verify-output'])
    parser.add_argument('--reference', default='reference')
    parser.add_argument('--base-dir', default='base/Q4')
    parser.add_argument('--output', default='output/Q4')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        execute(args)
    except Exception as ex:
        print('BLOCKED:', type(ex).__name__, str(ex), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()