import subprocess
import os

# Find all .git directories on the filesystem
result = subprocess.run(
    "find / -name '.git' -type d -maxdepth 6 2>/dev/null",
    shell=True, capture_output=True, text=True
)
print("Git repos found:")
print(result.stdout)

# Also print current working directory info
print("CWD:", os.getcwd())
print("Script location:", os.path.abspath(__file__))

# Check common locations
for path in ["/vercel/share/v0-project", "/app", "/workspace", "/home", "/repo", "/project"]:
    exists = os.path.exists(path)
    is_git = os.path.exists(os.path.join(path, ".git"))
    print(f"{path} — exists: {exists}, is_git: {is_git}")
