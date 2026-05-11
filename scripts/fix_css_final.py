import re

with open('src/index.css', 'r') as f:
    content = f.read()

content = content.replace(
    'background: var(--bg-popover-solid, rgb(5, 14, 60);',
    'background: var(--bg-popover-solid, rgb(5, 14, 60));'
)
content = content.replace(
    'border: 1px solid var(--border-color);;',
    'border: 1px solid var(--border-color);'
)
content = content.replace('     saturate(1.4); saturate(1.4);', '')
content = re.sub(r'^;\s*$', '', content, flags=re.MULTILINE)

with open('src/index.css', 'w') as f:
    f.write(content)

print('CSS fixato')
