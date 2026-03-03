import sys
import os
sys.path.append(os.path.abspath('backend/app'))
import importlib

components = [
    'core.config',
    'core.security',
    'api.sso',
    'api.workspaces',
    'api.admin',
    'api.audit',
    'main'
]

print("CHECKING IMPORTS:")
errors = 0
for comp in components:
    try:
        importlib.import_module(comp)
        print(f"[OK] {comp}")
    except Exception as e:
        print(f"[ERR] {comp}: {e}")
        errors += 1

sys.exit(errors)
