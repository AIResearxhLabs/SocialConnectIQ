import subprocess

try:
    with open("status_clean.txt", "w") as f:
        subprocess.run(["git", "status", "--porcelain"], stdout=f, check=True)

    with open("status_clean.txt", "r") as f:
        print("GIT STATUS OUTPUT START")
        print(f.read())
        print("GIT STATUS OUTPUT END")
except Exception as e:
    print(f"Error: {e}")
