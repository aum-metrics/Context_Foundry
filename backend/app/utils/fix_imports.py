#!/usr/bin/env python
"""
Auto-fix script for remaining import issues
Run from backend directory: python fix_imports.py
"""

import os
import re

def fix_file(filepath, replacements):
    """Fix imports in a single file"""
    if not os.path.exists(filepath):
        return f"❌ NOT FOUND: {filepath}"
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        fixed = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                fixed = True
        
        if fixed:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"✅ FIXED: {filepath}"
        else:
            return f"⏭️  SKIP: {filepath}"
            
    except Exception as e:
        return f"❌ ERROR in {filepath}: {e}"


def main():
    print("=" * 60)
    print("🔧 FIXING REMAINING IMPORT ISSUES")
    print("=" * 60)
    
    # Files that import from api.auth instead of core.dependencies
    files_to_fix = [
        "app/api/collaboration.py",
        "app/api/connectors.py",
        "app/api/api_keys.py",
        "app/api/statistics.py",
        "app/api/realtime.py",
        "app/api/workspaces.py"
    ]
    
    replacements = [
        ("from api.auth import get_current_user", 
         "from core.dependencies import get_current_user"),
    ]
    
    print("\n📝 Fixing import statements...\n")
    
    results = []
    for filepath in files_to_fix:
        result = fix_file(filepath, replacements)
        results.append(result)
        print(result)
    
    # Fix webhooks
    print("\n📝 Fixing webhooks.py...\n")
    
    webhooks_fixes = [
        ("from google.cloud import firestore", 
         "# from google.cloud import firestore  # REMOVED - use Supabase instead"),
    ]
    
    result = fix_file("app/api/webhooks.py", webhooks_fixes)
    results.append(result)
    print(result)
    
    # Summary
    print("\n" + "=" * 60)
    fixed_count = sum(1 for r in results if "✅" in r)
    print(f"✅ FIXED: {fixed_count} files")
    print("=" * 60)
    
    print("\n🎉 Done! Now restart the server:")
    print("   python -m uvicorn app.main:app --reload")
    print("\n")


if __name__ == "__main__":
    main()