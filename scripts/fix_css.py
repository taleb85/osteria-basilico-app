import re, glob

for fp in glob.glob('src/**/*.css', recursive=True):
    with open(fp, 'r') as f:
        content = f.read()
    original = content

    content = re.sub(r'^\s+saturate\([^)]+\);\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s+blur\([^)]+\);\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s+-webkit-\s*;\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s+drop-shadow\([^)]+\);\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'\)\)', ')', content)
    content = re.sub(r'\)\)', ')', content)

    if content != original:
        with open(fp, 'w') as f:
            f.write(content)
        print(f'  {fp}')

print('Done')
