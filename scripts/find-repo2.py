import subprocess
import os

# Search more broadly with deeper depth
result = subprocess.run(
    "find / -name '.git' -type d -maxdepth 10 2>/dev/null",
    shell=True, capture_output=True, text=True, timeout=15
)
print("Git repos found:")
print(result.stdout if result.stdout else "(none)")

# Also list root-level dirs
dirs = subprocess.run("ls /", shell=True, capture_output=True, text=True)
print("Root dirs:", dirs.stdout)

# List /vercel
vercel = subprocess.run("ls /vercel/", shell=True, capture_output=True, text=True)
print("/vercel:", vercel.stdout)

# List /vercel/share
share = subprocess.run("ls /vercel/share/", shell=True, capture_output=True, text=True)
print("/vercel/share:", share.stdout)
