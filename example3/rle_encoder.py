from PIL import Image
import numpy as np
import zlib
import sys

mask_flat = np.asarray(Image.open("./mask.png").convert("L")).flatten() // 255
mask_flat_diff = np.abs(np.diff(mask_flat))
mask_flat_diff_idx = np.where(mask_flat_diff)[0]
initial_value = mask_flat[0]
mask_rle = np.concatenate([
	[initial_value, mask_flat_diff_idx[0]],
	np.diff(mask_flat_diff_idx)
]).astype(np.uint16)
mask_rle_zipped = zlib.compress(mask_rle.tobytes(), level=9)
print(sys.getsizeof(mask_rle.tobytes()))

arr = np.asarray(Image.open("./mask2.png").convert("L")) >= 128
arr_tranparent = np.zeros([arr.shape[0], arr.shape[1], 4], dtype=np.uint8)
arr_tranparent[arr, 3] = 255
Image.fromarray(arr_tranparent).save("./maskA2.webp", compress)
