#!/usr/bin/env python3
"""Deploy a local build directory to an FTP(S) server.

Credentials are read from environment variables, never from the command
line or a tracked file:

    FTP_SERVER    host (e.g. ftp.eclipsemuhendislik.com)
    FTP_USERNAME  username
    FTP_PASSWORD  password
    FTP_PORT      optional, default 21

Usage:
    python scripts/deploy_ftp.py --local-dir dist --remote-dir /
    python scripts/deploy_ftp.py --local-dir dist/demo --remote-dir /demo
    python scripts/deploy_ftp.py --local-dir dist --remote-dir / --clean --dry-run
"""

import argparse
import fnmatch
import os
import sys
from ftplib import FTP, FTP_TLS, error_perm

DEFAULT_EXCLUDES = [
    "*.map",
    ".git",
    ".git/*",
    ".github",
    ".github/*",
    ".gitignore",
    ".gitattributes",
]


def is_excluded(rel_path, patterns):
    normalized = rel_path.replace(os.sep, "/")
    for pattern in patterns:
        if fnmatch.fnmatch(normalized, pattern):
            return True
    return False


def connect(host, port, username, password, use_tls):
    ftp_cls = FTP_TLS if use_tls else FTP
    ftp = ftp_cls()
    ftp.connect(host=host, port=port, timeout=30)
    ftp.login(user=username, passwd=password)
    if use_tls:
        ftp.prot_p()
    ftp.set_pasv(True)
    return ftp


def ensure_remote_dir(ftp, remote_dir, dry_run):
    parts = [p for p in remote_dir.split("/") if p]
    path = ""
    for part in parts:
        path += "/" + part
        try:
            ftp.cwd(path)
        except error_perm:
            if dry_run:
                print(f"[dry-run] mkdir {path}")
            else:
                try:
                    ftp.mkd(path)
                except error_perm as exc:
                    print(f"warning: could not create {path}: {exc}")
            try:
                ftp.cwd(path)
            except error_perm:
                pass
    ftp.cwd("/")


def list_remote_recursive(ftp, remote_dir):
    """Return (files, dirs) sets of paths relative to remote_dir."""
    files, dirs = set(), set()

    def walk(path):
        try:
            ftp.cwd(path)
        except error_perm:
            return
        entries = []
        ftp.retrlines("LIST", entries.append)
        for line in entries:
            fields = line.split(maxsplit=8)
            if len(fields) < 9:
                continue
            name = fields[8]
            if name in (".", ".."):
                continue
            is_dir = line.startswith("d")
            full = f"{path}/{name}".replace("//", "/")
            rel = full[len(remote_dir):].lstrip("/")
            if is_dir:
                dirs.add(rel)
                walk(full)
            else:
                files.add(rel)
        ftp.cwd(path)

    walk(remote_dir if remote_dir.startswith("/") else "/" + remote_dir)
    return files, dirs


def upload_file(ftp, local_path, remote_path, dry_run):
    if dry_run:
        print(f"[dry-run] upload {local_path} -> {remote_path}")
        return
    with open(local_path, "rb") as fh:
        ftp.storbinary(f"STOR {remote_path}", fh)
    print(f"uploaded {remote_path}")


def deploy(local_dir, remote_dir, excludes, clean, dry_run, host, port, username, password, use_tls):
    if not os.path.isdir(local_dir):
        print(f"error: local dir '{local_dir}' does not exist", file=sys.stderr)
        return 1

    local_files = {}
    for root, _, files in os.walk(local_dir):
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, local_dir)
            if is_excluded(rel, excludes):
                continue
            local_files[rel.replace(os.sep, "/")] = full

    if not local_files:
        print("error: no files to upload", file=sys.stderr)
        return 1

    ftp = connect(host, port, username, password, use_tls)
    try:
        remote_dir = "/" + remote_dir.strip("/")
        ensure_remote_dir(ftp, remote_dir, dry_run)

        if clean:
            print(f"scanning remote {remote_dir} for stale files...")
            remote_files, _ = list_remote_recursive(ftp, remote_dir)
            stale = remote_files - set(local_files.keys())
            for rel in sorted(stale):
                remote_path = f"{remote_dir}/{rel}"
                if dry_run:
                    print(f"[dry-run] delete {remote_path}")
                else:
                    try:
                        ftp.delete(remote_path)
                        print(f"deleted {remote_path}")
                    except error_perm as exc:
                        print(f"warning: could not delete {remote_path}: {exc}")

        for rel, local_path in sorted(local_files.items()):
            remote_path = f"{remote_dir}/{rel}"
            remote_subdir = os.path.dirname(remote_path)
            ensure_remote_dir(ftp, remote_subdir, dry_run)
            if not dry_run:
                ftp.cwd(remote_subdir)
            upload_file(ftp, local_path, os.path.basename(remote_path) if not dry_run else remote_path, dry_run)

        print(f"done: {len(local_files)} file(s) {'would be ' if dry_run else ''}uploaded to {remote_dir}")
        return 0
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--local-dir", default="dist", help="Local build directory to upload (default: dist)")
    parser.add_argument("--remote-dir", default="/", help="Remote directory to upload into (default: /)")
    parser.add_argument("--exclude", action="append", default=[], help="Additional glob pattern to exclude (repeatable)")
    parser.add_argument("--clean", action="store_true", help="Delete remote files that are not present locally (mirror mode)")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without changing the remote server")
    parser.add_argument("--tls", action="store_true", help="Use FTPS (explicit TLS) instead of plain FTP")
    args = parser.parse_args()

    host = os.environ.get("FTP_SERVER")
    username = os.environ.get("FTP_USERNAME")
    password = os.environ.get("FTP_PASSWORD")
    port = int(os.environ.get("FTP_PORT", "21"))

    missing = [name for name, value in [("FTP_SERVER", host), ("FTP_USERNAME", username), ("FTP_PASSWORD", password)] if not value]
    if missing:
        print(f"error: missing required environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 1

    excludes = DEFAULT_EXCLUDES + args.exclude

    return deploy(
        local_dir=args.local_dir,
        remote_dir=args.remote_dir,
        excludes=excludes,
        clean=args.clean,
        dry_run=args.dry_run,
        host=host,
        port=port,
        username=username,
        password=password,
        use_tls=args.tls,
    )


if __name__ == "__main__":
    sys.exit(main())
