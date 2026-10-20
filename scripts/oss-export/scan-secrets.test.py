import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCANNER = Path(__file__).with_name('scan-secrets.sh').resolve()


class SecretScannerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def scan(self, **env):
        return subprocess.run(['bash', str(SCANNER), str(self.root)], capture_output=True,
                              text=True, env={**os.environ, **env})

    def test_clean_tree(self):
        (self.root / 'sample.txt').write_text('ordinary text\n')
        result = self.scan()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('secret scan: clean', result.stdout)

    def test_reports_location_without_secret(self):
        secret = 'pdl_' + 'sdbx_apikey_' + 'a' * 30
        (self.root / 'file:with-colon.txt').write_text('ordinary text\n' + secret + '\n')
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn('file:with-colon.txt:2', result.stderr)
        self.assertNotIn(secret, result.stdout + result.stderr)

    def test_missing_tracked_file_fails_closed(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        sample = self.root / 'sample.txt'
        sample.write_text('ordinary text\n')
        subprocess.run(['git', '-C', str(self.root), 'add', 'sample.txt'], check=True)
        sample.unlink()
        result = self.scan()
        self.assertEqual(result.returncode, 2)
        self.assertNotIn('secret scan: clean', result.stdout)

    def test_broken_git_metadata_fails_closed(self):
        (self.root / '.git').write_text('gitdir: /missing/git-metadata\n')
        result = self.scan()
        self.assertEqual(result.returncode, 2)
        self.assertNotIn('secret scan: clean', result.stdout)

    def test_git_file_listing_failure_fails_closed(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        binary_dir = self.root / 'bin'
        binary_dir.mkdir()
        real_git = shutil.which('git')
        stub = binary_dir / 'git'
        stub.write_text('#!/bin/bash\nif [ "$3" = ls-files ]; then exit 2; fi\nexec ' + real_git + ' "$@"\n')
        stub.chmod(0o755)
        result = self.scan(PATH=str(binary_dir) + os.pathsep + os.environ['PATH'])
        self.assertEqual(result.returncode, 2)
        self.assertNotIn('secret scan: clean', result.stdout)


if __name__ == '__main__':
    unittest.main()
