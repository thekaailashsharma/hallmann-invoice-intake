#!/usr/bin/env python3
"""Grants access to Google accounts. Usage: python3 scripts/seed-users.py email name role [email name role ...]"""
import subprocess, sys
args = sys.argv[1:]
if len(args) % 3 or not args: sys.exit(__doc__)
for email, name, role in zip(args[0::3], args[1::3], args[2::3]):
    assert role in ("clerk", "lead", "admin"), role
    sql = f"insert into app_users (email, display_name, role, created_by) values (lower('{email}'), '{name}', '{role}', 'seed') on conflict (email) do update set display_name = excluded.display_name, role = excluded.role, active = true"
    subprocess.run(["docker", "exec", "intake-postgres", "psql", "-U", "intake", "-d", "intake", "-q", "-c", sql], check=True)
    print(f"✔ {role:6} {email} ({name})")
