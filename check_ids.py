import re

with open('static/js/app.js', encoding='utf-8') as f:
    js = f.read()

with open('templates/dashboard.html', encoding='utf-8') as f:
    html = f.read()

# IDs referenced by getElementById in JS
pattern_id = r"getElementById\(['\"]([^'\"]+)['\"]\)"
ids_js = re.findall(pattern_id, js)

# IDs defined in HTML
ids_html = set(re.findall(r'id="([^"]+)"', html))

print("=== IDs in JS missing from HTML ===")
for i in sorted(set(ids_js)):
    if i not in ids_html:
        print(f"  MISSING: #{i}")

# Class selectors used in JS
pattern_cls = r"querySelector(?:All)?\(['\"]\.([A-Za-z0-9_-]+)['\"]"
cls_js = re.findall(pattern_cls, js)

# Classes in HTML
all_html_classes = set()
for c in re.findall(r'class="([^"]+)"', html):
    all_html_classes.update(c.split())

print("\n=== Class queries in JS missing from HTML ===")
for c in sorted(set(cls_js)):
    if c not in all_html_classes:
        print(f"  MISSING: .{c}")

# Also check which classes in JS setters don't map
print("\n=== All HTML IDs for reference ===")
for i in sorted(ids_html):
    print(f"  #{i}")
