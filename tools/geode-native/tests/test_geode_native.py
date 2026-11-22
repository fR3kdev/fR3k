import sys
import unittest
import tempfile
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from q4_codec import encode_q4, decode_q4_rows, tile8_q4, untile8_q4, TO_AFFINE, FROM_AFFINE
from geode_native import ShardReader, build_plan, patch_layer, update_bytes


class FakeShard:
    filename = 'synthetic.safetensors'
    def metadata(self, _name):
        return {'shape': [2, 64, 64], 'dtype': 'F32', 'data_offsets': [0, 32768]}


class FakeSource:
    def __init__(self):
        self.rng = np.random.default_rng(42)
        self.weights = self.rng.normal(0, 0.04, (2, 64, 64)).astype(np.float32)
        self.dense = self.rng.normal(0, 0.02, (64, 64)).astype(np.float32)
    def reader(self, name):
        return FakeShard()
    def tensor(self, name, shape):
        if 'experts.down_proj' in name:
            self_ = self.weights
        else:
            self_ = self.dense
        assert self_.shape == shape, (name, shape, self_.shape)
        return self_


class TestQuant(unittest.TestCase):
    def test_q4_reconstruction_and_tile8_roundtrip(self):
        rng = np.random.default_rng(3)
        w = rng.normal(0, 0.035, (96, 128)).astype(np.float32)
        z, scale, err = encode_q4(w)
        self.assertEqual(len(z), 96*128*9//16)
        got = decode_q4_rows(z, 96, 128, scale)
        self.assertLess(np.sqrt(np.mean((w-got)**2))/np.sqrt(np.mean(w*w)), .12)
        self.assertLess(err, .005)
        self.assertEqual(untile8_q4(tile8_q4(z, 96, 128), 96, 128), z)

    def test_never_nan_and_reject_wrong_shape(self):
        with self.assertRaises(ValueError):
            encode_q4(np.ones((31, 63), np.float32))
        with self.assertRaises(ValueError):
            encode_q4(np.full((32, 64), np.nan, np.float32))

    def test_all_zero_block(self):
        w = np.zeros((32, 64), dtype=np.float32)
        z, g, _ = encode_q4(w)
        np.testing.assert_allclose(decode_q4_rows(z, 32, 64, g), w)

    def test_affine_map_inverse(self):
        np.testing.assert_array_equal(FROM_AFFINE[TO_AFFINE], np.arange(16))

    def test_down_proj_in_place_patch_preserves_gateup(self):
        cfg = {'hidden_size': 64, 'moe_intermediate_size': 64, 'num_experts': 2}
        gu = 2*64*(64*9//16)
        dn = 64*(64*9//16)
        stride = gu+dn
        manifest = {
            'config': cfg,
            'tensors': {'layers.0.mlp.experts.scales': {'file': 'dense.bin','offset':0,'shape':[2,2], 'type':'f32'},
                        'layers.0.mlp.shared_expert.down_proj.weight':{'file':'dense.bin','offset':16,'shape':[64,64],'type':'q4'},
                        'layers.0.self_attn.o_proj.weight':{'file':'dense.bin','offset':16+dn,'shape':[64,64],'type':'q4'}},
            'experts': {'layers': [{'file':'experts-00.bin','offset':0,'stride':stride,'format':'q4'}]}}
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            (out/'experts-00.bin').write_bytes(b'G'*gu+b'D'*dn+b'Z'*gu+b'Q'*dn)
            (out/'dense.bin').write_bytes(bytes(16+2*dn))
            source=FakeSource()
            patch_layer(0, out, manifest, source, dry_run=False)
            expert_data=(out/'experts-00.bin').read_bytes()
            self.assertEqual(expert_data[:gu], b'G'*gu)
            self.assertEqual(expert_data[stride:stride+gu], b'Z'*gu)
            for i in range(2):
                start=i*stride+gu
                raw=untile8_q4(expert_data[start:start+dn],64,64)
                import struct
                g=struct.unpack_from('<f',(out/'dense.bin').read_bytes(),i*8+4)[0]
                got=decode_q4_rows(raw,64,64,g)
                self.assertLess(np.sqrt(((got-source.weights[i])**2).mean()),0.006)
            self.assertGreater(manifest['tensors']['layers.0.self_attn.o_proj.weight']['global'],0)
            self.assertEqual(len(expert_data),stride*2)

    def test_bounds_and_short_file(self):
        with tempfile.TemporaryDirectory() as td:
            f=Path(td)/'file';f.write_bytes(bytes(20))
            with self.assertRaises(RuntimeError):
                update_bytes(f, 18, b'123')

if __name__ == '__main__':
    unittest.main()