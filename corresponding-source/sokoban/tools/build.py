#!/usr/bin/env python3
"""Compile portable Jack sources, or verify checked-in VM parity.

Finds companion checkouts in ancestor folders; environment variables can supply
locations when the game has been copied into another repository.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def locate(folder, environment):
    candidates = [Path(os.environ[environment])] if environment in os.environ else []
    candidates += [parent / folder for parent in ROOT.parents]
    path = next((p for p in candidates if p.is_dir()), None)
    if path is None:
        raise SystemExit(f'Cannot find {folder}; set {environment} to its checkout directory')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare without writing VM files')
    parser.add_argument('--run', action='store_true', help='launch the companion graphical VM')
    args = parser.parse_args()
    sys.path.insert(0, str(locate('jack-compiler', 'JACK_COMPILER_ROOT')))
    from jack_compiler import JackCompiler
    compiler = JackCompiler()
    failed = False
    for source in sorted(ROOT.glob('*.jack')):
        result = compiler.compile_source(source)
        if result is None:
            print(f'Compile failed: {source}\n{compiler.last_diagnostics}', file=sys.stderr)
            failed = True
            continue
        target = source.with_suffix('.vm')
        if args.check:
            if not target.exists() or target.read_text() != result:
                print(f'Stale or missing: {target.name}', file=sys.stderr)
                failed = True
        else:
            target.write_text(result)
        print(f'{source.name}: OK')
    if failed:
        raise SystemExit(1)
    if args.run:
        sys.path.insert(0, str(locate('jackvm-py', 'JACKVM_ROOT')))
        from jackvm.main import main as run_vm
        sys.argv = ['jackvm', str(ROOT)]
        raise SystemExit(run_vm())


if __name__ == '__main__':
    main()
