#!/usr/bin/env python3
"""
Run this once from your muntaqaa folder:
  python download-fonts.py

It will:
  1. Create a fonts/ subfolder
  2. Download all Amiri + Tajawal woff2 files from Google Fonts
  3. Write fonts/fonts.css with @font-face declarations
  4. Print instructions for updating index.html
"""

import urllib.request
import os

os.makedirs('fonts', exist_ok=True)

# Google Fonts CSS endpoint — fetch with a modern UA to get woff2
URL = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;800&display=swap"
UA  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

print("Fetching font CSS from Google Fonts...")
req = urllib.request.Request(URL, headers={"User-Agent": UA})
css = urllib.request.urlopen(req).read().decode()

# Parse all woff2 URLs and their context
import re

# Extract: font-family, font-style, font-weight, src url, unicode-range
blocks = re.findall(
    r'@font-face\s*\{([^}]+)\}',
    css, re.DOTALL
)

local_css_blocks = []
downloaded = {}

for block in blocks:
    family  = re.search(r"font-family:\s*'?([^;']+)'?", block)
    style   = re.search(r'font-style:\s*(\w+)', block)
    weight  = re.search(r'font-weight:\s*([\w\s]+?);', block)
    src_url = re.search(r'url\(([^)]+\.woff2)\)', block)
    urange  = re.search(r'unicode-range:\s*([^;]+)', block)

    if not (family and src_url): continue

    family  = family.group(1).strip()
    style   = style.group(1).strip() if style else 'normal'
    weight  = weight.group(1).strip() if weight else '400'
    url     = src_url.group(1).strip()
    urange  = urange.group(1).strip() if urange else None

    # Build a safe filename
    safe_family = family.replace(' ', '')
    safe_weight = weight.replace(' ', '')
    fname = f"{safe_family}-{safe_weight}-{style}-{abs(hash(url)) % 10000}.woff2"
    fpath = os.path.join('fonts', fname)

    if url not in downloaded:
        print(f"  Downloading {fname}...")
        try:
            req2 = urllib.request.Request(url, headers={"User-Agent": UA})
            data = urllib.request.urlopen(req2).read()
            with open(fpath, 'wb') as f:
                f.write(data)
            downloaded[url] = fname
            print(f"    OK ({len(data)//1024}KB)")
        except Exception as ex:
            print(f"    FAILED: {ex}")
            continue
    else:
        fname = downloaded[url]
        fpath = os.path.join('fonts', fname)

    face = f"""@font-face {{
  font-family: '{family}';
  font-style: {style};
  font-weight: {weight};
  font-display: swap;
  src: url('fonts/{fname}') format('woff2');"""
    if urange:
        face += f"\n  unicode-range: {urange};"
    face += "\n}"
    local_css_blocks.append(face)

fonts_css = "\n\n".join(local_css_blocks)
with open('fonts/fonts.css', 'w', encoding='utf-8') as f:
    f.write(fonts_css)

print(f"\nDone! Downloaded {len(downloaded)} font files.")
print("\nNow update index.html — replace these two lines:")
print("""
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
""")
print("With this single line:")
print("""
  <link rel="stylesheet" href="fonts/fonts.css" />
""")
print("Then add 'fonts/' to your sw.js STATIC_ASSETS list (or let the SW cache-on-fetch handle it).")