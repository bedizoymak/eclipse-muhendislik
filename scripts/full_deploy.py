#!/usr/bin/env python3
"""Build and deploy every site/subdomain in this repo over FTP.

Builds the main site and the demo subdomain, then uploads each to its
confirmed cPanel Document Root on the shared FTP account:

    main site (eclipsemuhendislik.com)  -> dist        -> /public_html
    demo     (demo.eclipsemuhendislik.com) -> dist/demo -> /public_html/demo

Credentials are read from environment variables (see deploy_ftp.py),
never from the command line or a tracked file.

Usage:
    python scripts/full_deploy.py --dry-run
    python scripts/full_deploy.py
    python scripts/full_deploy.py --skip-build
"""

import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deploy_ftp  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = [
    {
        "name": "main site (eclipsemuhendislik.com)",
        "build_script": "build:web",
        "local_dir": "dist",
        "remote_dir": "/public_html",
        "extra_excludes": ["demo", "demo/*"],  # dist/demo is nested inside dist; deployed separately below
    },
    {
        "name": "demo (demo.eclipsemuhendislik.com)",
        "build_script": "build:demo",
        "local_dir": "dist/demo",
        "remote_dir": "/public_html/demo",
        "extra_excludes": [],
    },
]


def run_build(script_name):
    print(f"\n=== npm run {script_name} ===")
    result = subprocess.run(["npm", "run", script_name], cwd=REPO_ROOT, shell=(os.name == "nt"))
    if result.returncode != 0:
        print(f"error: build script '{script_name}' failed", file=sys.stderr)
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print actions without changing the remote server")
    parser.add_argument("--clean", action="store_true", help="Delete remote files not present locally, per target (mirror mode)")
    parser.add_argument("--tls", action="store_true", help="Use FTPS (explicit TLS) instead of plain FTP")
    parser.add_argument("--skip-build", action="store_true", help="Deploy existing dist/ and dist/demo without rebuilding")
    args = parser.parse_args()

    host = os.environ.get("FTP_SERVER")
    username = os.environ.get("FTP_USERNAME")
    password = os.environ.get("FTP_PASSWORD")
    port = int(os.environ.get("FTP_PORT", "21"))

    missing = [name for name, value in [("FTP_SERVER", host), ("FTP_USERNAME", username), ("FTP_PASSWORD", password)] if not value]
    if missing:
        print(f"error: missing required environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 1

    if not args.skip_build:
        for target in TARGETS:
            run_build(target["build_script"])

    exit_code = 0
    for target in TARGETS:
        print(f"\n=== deploying {target['name']} -> {target['remote_dir']} ===")
        rc = deploy_ftp.deploy(
            local_dir=os.path.join(REPO_ROOT, target["local_dir"]),
            remote_dir=target["remote_dir"],
            excludes=deploy_ftp.DEFAULT_EXCLUDES + target["extra_excludes"],
            clean=args.clean,
            dry_run=args.dry_run,
            host=host,
            port=port,
            username=username,
            password=password,
            use_tls=args.tls,
        )
        exit_code = exit_code or rc

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
