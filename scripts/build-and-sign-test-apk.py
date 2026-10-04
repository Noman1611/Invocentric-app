import os
import shutil
import zipfile
import subprocess
import sys

def main():
    base_apk = "InvoCentric.apk"
    unsigned_apk = "InvoCentric-Test-unsigned.apk"
    output_apk = "InvoCentric-Test.apk"
    signer_jar = "uber-apk-signer.jar"
    dist_dir = "dist"

    if not os.path.exists(base_apk):
        print(f"Error: Base APK '{base_apk}' not found!")
        sys.exit(1)

    if not os.path.exists(dist_dir):
        print(f"Error: Dist directory '{dist_dir}' not found!")
        sys.exit(1)

    print(f"[*] Reading base APK from '{base_apk}'...")
    if os.path.exists(unsigned_apk):
        os.remove(unsigned_apk)

    with zipfile.ZipFile(base_apk, 'r') as src_zip:
        with zipfile.ZipFile(unsigned_apk, 'w', compression=zipfile.ZIP_DEFLATED) as dst_zip:
            # 1. Copy original APK structure (compiled dex, native libs, AndroidManifest, res, etc.)
            for item in src_zip.infolist():
                name = item.filename
                # Skip old signatures and web assets
                if name.startswith('META-INF/') and (name.endswith('.SF') or name.endswith('.RSA') or name.endswith('.MF') or name.endswith('.DSA') or name.endswith('.EC')):
                    continue
                if name.startswith('assets/public/'):
                    continue
                
                content = src_zip.read(name)
                # Store uncompressed for .so or unaligned resources if needed, otherwise deflate
                if name.endswith('.so') or name == 'resources.arsc':
                    dst_zip.writestr(item, content, compress_type=zipfile.ZIP_STORED)
                else:
                    dst_zip.writestr(item, content, compress_type=zipfile.ZIP_DEFLATED)

            # 2. Inject fresh test web assets into assets/public/
            print(f"[*] Injecting web assets from '{dist_dir}' into assets/public/...")
            file_count = 0
            for root, dirs, files in os.walk(dist_dir):
                for f in files:
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, dist_dir).replace('\\', '/')
                    archive_path = f"assets/public/{rel_path}"
                    with open(full_path, 'rb') as fp:
                        dst_zip.writestr(archive_path, fp.read(), compress_type=zipfile.ZIP_DEFLATED)
                        file_count += 1
            print(f"[*] Added {file_count} web asset files to APK.")

    print(f"[*] Unsigned APK packaged: {os.path.getsize(unsigned_apk)} bytes.")

    # 3. Zipalign and sign using uber-apk-signer
    print(f"[*] Signing and zipaligning with {signer_jar}...")
    cmd = [
        "java", "-jar", signer_jar,
        "--apks", unsigned_apk,
        "--out", ".",
        "--overwrite"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(res.stdout)
    if res.returncode != 0:
        print("Signer stderr:", res.stderr)
        sys.exit(res.returncode)

    # uber-apk-signer outputs InvoCentric-Test-unsigned-aligned-debugSigned.apk
    candidates = [
        "InvoCentric-Test-unsigned-aligned-debugSigned.apk",
        "InvoCentric-Test-unsigned.apk"
    ]
    signed_found = None
    for c in candidates:
        if os.path.exists(c) and c != unsigned_apk:
            signed_found = c
            break

    if not signed_found and os.path.exists("InvoCentric-Test-unsigned-aligned-debugSigned.apk"):
        signed_found = "InvoCentric-Test-unsigned-aligned-debugSigned.apk"

    if signed_found and os.path.exists(signed_found):
        if os.path.exists(output_apk):
            os.remove(output_apk)
        os.rename(signed_found, output_apk)
        print(f"[SUCCESS] Final signed APK created: '{output_apk}' ({os.path.getsize(output_apk)} bytes)")
    else:
        print(f"[!] Target candidate not found, checking existing files...")
        sys.exit(1)

    # Clean up intermediate files
    if os.path.exists(unsigned_apk):
        os.remove(unsigned_apk)

    # Copy to public/ and dist/
    os.makedirs("public", exist_ok=True)
    shutil.copyfile(output_apk, os.path.join("public", output_apk))
    os.makedirs("dist", exist_ok=True)
    shutil.copyfile(output_apk, os.path.join("dist", output_apk))
    print(f"[*] Copied '{output_apk}' to public/ and dist/ folders.")

if __name__ == "__main__":
    main()
