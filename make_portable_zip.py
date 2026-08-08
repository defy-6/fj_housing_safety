"""便携版 zip 打包：UTF-8 文件名标志，避免中文路径乱码。
用法：python make_portable_zip.py <staging_dir> <zip_path>
"""
import os
import sys
import zipfile

src = sys.argv[1]
zip_path = sys.argv[2]

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, src)
            z.write(full, rel)

print(f"zip 完成: {os.path.getsize(zip_path) // 1024 // 1024} MB")
