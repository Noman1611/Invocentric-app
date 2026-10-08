import os
import sys
import zipfile
import subprocess
import shutil
import struct

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_ORIG_APK = os.path.join(BASE_DIR, "temp_orig.apk")
DIST_DIR = os.path.join(BASE_DIR, "dist")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
UBER_JAR = os.path.join(BASE_DIR, "uber-apk-signer.jar")

def patch_android_manifest(raw_bytes, version_code=42, version_name="1.0.42"):
    manifest = bytearray(raw_bytes)
    # 1. Patch versionName string in UTF-16LE string pool
    target_utf16 = "1.0.39".encode("utf-16le")
    new_utf16 = version_name.encode("utf-16le")
    if len(target_utf16) == len(new_utf16):
        idx = manifest.find(target_utf16)
        if idx != -1:
            manifest[idx : idx + len(new_utf16)] = new_utf16
            print(f"[AXML] Successfully patched versionName to '{version_name}' at offset {idx}")

    # 2. Patch versionCode typed int value
    for i in range(len(manifest) - 8):
        if manifest[i : i + 4] == b"\x08\x00\x00\x10" and manifest[i + 4 : i + 8] == b"\x27\x00\x00\x00":
            manifest[i + 4 : i + 8] = struct.pack("<I", version_code)
            print(f"[AXML] Successfully patched versionCode to {version_code} at offset {i + 4}")
            break

    return bytes(manifest)

def patch_resources_arsc_for_test(raw_bytes):
    arsc = bytearray(raw_bytes)
    target = b"\x0b\x0bInvoCentric\x00"
    replacement = b"\x0b\x0bInvoC(TEST)\x00"
    idx = arsc.find(target)
    if idx != -1:
        arsc[idx : idx + len(replacement)] = replacement
        print(f"[ARSC] Successfully patched app title to 'InvoC(TEST)' at offset {idx}")
    return bytes(arsc)

def build_web_dist(channel="production"):
    print(f"\n[Build] Building web application for channel: '{channel}'...")
    env = os.environ.copy()
    env["VITE_APP_CHANNEL"] = channel
    cmd = ["cmd", "/c", "npm", "run", "build"]
    res = subprocess.run(cmd, cwd=BASE_DIR, env=env, capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stderr)
        raise RuntimeError(f"npm run build failed with exit code {res.returncode}")
    print("[Build] Web build completed successfully.")

def build_clean_apk(target_apk_name, channel="production", do_web_build=True):
    print(f"\n========================================================")
    print(f"  Building Clean APK: {target_apk_name} (Channel: {channel})")
    print(f"========================================================")

    if do_web_build:
        build_web_dist(channel)

    final_apk = os.path.join(BASE_DIR, target_apk_name)
    unsigned_apk = os.path.join(BASE_DIR, f"temp_{target_apk_name}_unsigned.apk")

    if os.path.exists(unsigned_apk):
        os.remove(unsigned_apk)

    # 1. Read base APK structure and compression types
    print("[Pack] Packing base APK components and clean assets...")
    with zipfile.ZipFile(TEMP_ORIG_APK, "r") as src_zip:
        with zipfile.ZipFile(unsigned_apk, "w") as dst_zip:
            # Copy all entries from base APK EXCEPT META-INF and assets/public
            for item in src_zip.infolist():
                if item.filename.startswith("META-INF/"):
                    continue
                if item.filename.startswith("assets/public/"):
                    continue

                content = src_zip.read(item.filename)

                # Patch AndroidManifest.xml
                if item.filename == "AndroidManifest.xml":
                    v_code = 42
                    v_name = "1.0.42"
                    content = patch_android_manifest(content, version_code=v_code, version_name=v_name)

                # Patch resources.arsc for test build to display TEST in icon label
                if item.filename == "resources.arsc" and channel == "test":
                    content = patch_resources_arsc_for_test(content)

                zinfo = zipfile.ZipInfo(item.filename)
                # Ensure resources.arsc is always STORED (uncompressed)
                if item.filename == "resources.arsc":
                    zinfo.compress_type = zipfile.ZIP_STORED
                else:
                    zinfo.compress_type = item.compress_type

                zinfo.external_attr = item.external_attr
                dst_zip.writestr(zinfo, content)

            # 2. Add files from dist/ into assets/public/
            skip_extensions = {".apk", ".idsig", ".map"}
            skip_files = {"server.cjs", "server.cjs.map"}
            stored_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"}

            added_count = 0
            for root, _, files in os.walk(DIST_DIR):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in skip_extensions or f in skip_files:
                        continue

                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, DIST_DIR).replace("\\", "/")
                    target_entry_name = f"assets/public/{rel_path}"

                    with open(full_path, "rb") as fp:
                        content = fp.read()

                    zinfo = zipfile.ZipInfo(target_entry_name)
                    if ext in stored_extensions:
                        zinfo.compress_type = zipfile.ZIP_STORED
                    else:
                        zinfo.compress_type = zipfile.ZIP_DEFLATED

                    dst_zip.writestr(zinfo, content)
                    added_count += 1

            # 3. Add cordova dummy files if not present
            for cordova_file in ["assets/public/cordova.js", "assets/public/cordova_plugins.js"]:
                if cordova_file not in [e.filename for e in dst_zip.infolist()]:
                    zinfo = zipfile.ZipInfo(cordova_file)
                    zinfo.compress_type = zipfile.ZIP_DEFLATED
                    dst_zip.writestr(zinfo, b"")

    print(f"[Pack] Unsigned APK created: {unsigned_apk} ({os.path.getsize(unsigned_apk)} bytes, {added_count} web assets)")

    # 4. Sign and zipalign with uber-apk-signer
    if os.path.exists(final_apk):
        os.remove(final_apk)
    shutil.copyfile(unsigned_apk, final_apk)
    os.remove(unsigned_apk)

    project_keystore = os.path.join(BASE_DIR, "android", "app", "invocentric.keystore")
    cmd = [
        "java", "-jar", UBER_JAR,
        "-a", final_apk,
        "--ks", project_keystore,
        "--ksAlias", "androiddebugkey",
        "--ksPass", "android",
        "--keyPass", "android",
        "--allowResign",
        "--overwrite"
    ]
    print(f"[Sign] Signing and aligning with uber-apk-signer using project keystore: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stderr)
        raise RuntimeError(f"Signing failed with exit code {res.returncode}")
    print(res.stdout)

    # 5. Verify the final APK
    verify_cmd = ["java", "-jar", UBER_JAR, "-a", final_apk, "-y"]
    v_res = subprocess.run(verify_cmd, capture_output=True, text=True)
    print("[Verify] Verification output:")
    print(v_res.stdout)

    # 6. Copy to public/ and dist/
    pub_target = os.path.join(PUBLIC_DIR, target_apk_name)
    dist_target = os.path.join(DIST_DIR, target_apk_name)
    shutil.copyfile(final_apk, pub_target)
    shutil.copyfile(final_apk, dist_target)
    print(f"[Copy] Synced {target_apk_name} to:\n  - {pub_target}\n  - {dist_target}")

    with zipfile.ZipFile(final_apk, "r") as z:
        entries = z.infolist()
        stored = [e.filename for e in entries if e.compress_type == zipfile.ZIP_STORED]
        deflated = [e.filename for e in entries if e.compress_type == zipfile.ZIP_DEFLATED]
        r_info = next((e for e in entries if e.filename == "resources.arsc"), None)
        print(f"[Stats] {target_apk_name} summary: Total={len(entries)}, Stored={len(stored)}, Deflated={len(deflated)}")
        if r_info:
            print(f"        resources.arsc compress_type={r_info.compress_type} ({'STORED' if r_info.compress_type == 0 else 'DEFLATED'})")

    print(f"[OK] DONE: {final_apk} ready ({os.path.getsize(final_apk)} bytes)\n")

if __name__ == "__main__":
    build_clean_apk("InvoCentric.apk", channel="production", do_web_build=False)
