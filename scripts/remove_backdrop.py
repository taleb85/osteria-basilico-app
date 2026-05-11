import re, glob

tsx_files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.css', recursive=True)

total = 0
for fp in tsx_files:
    with open(fp, 'r') as f:
        content = f.read()

    original = content

    content = re.sub(r',?\s*backdropFilter:\s*\'[^\']*\'', '', content)
    content = re.sub(r',?\s*backdropFilter:\s*"[^"]*"', '', content)
    content = re.sub(r',?\s*backdrop-filter:\s*[^;)]*', '', content)
    content = re.sub(r',?\s*-webkit-backdrop-filter:\s*[^;)]*', '', content)
    content = re.sub(r',?\s*WebkitBackdropFilter:\s*\'[^\']*\'', '', content)
    content = re.sub(r'\s+supports-\[backdrop-filter\]:backdrop-blur-[a-z0-9]+', '', content)
    content = re.sub(r'\s+supports-\[backdrop-filter\]:backdrop-saturate-[0-9]+', '', content)

    if content != original:
        total += 1
        with open(fp, 'w') as f:
            f.write(content)
        print(f"  {fp}")

print(f"File modificati: {total}")
