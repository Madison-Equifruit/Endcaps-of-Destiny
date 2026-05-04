#!/usr/bin/env python3
"""
Banana Badass: Endcaps of Destiny — Build Script
Run this from the root of the project to generate output/index.html
"""

import base64
import os
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS_IMAGES = os.path.join(ROOT, "assets", "images")
ASSETS_AUDIO  = os.path.join(ROOT, "assets", "audio")
ASSETS_VIDEO  = os.path.join(ROOT, "assets", "video")
ASSETS_FONTS  = os.path.join(ROOT, "assets", "fonts")
OUTPUT_DIR    = os.path.join(ROOT, "output")
GAME_CORE     = os.path.join(ROOT, "game_core.js")

os.makedirs(OUTPUT_DIR, exist_ok=True)

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def b64_audio(filename):
    path = os.path.join(ASSETS_AUDIO, filename)
    if not os.path.exists(path):
        print(f"  WARNING: Missing audio file: {filename}")
        return ""
    return b64(path)

def b64_video(filename):
    path = os.path.join(ASSETS_VIDEO, filename)
    if not os.path.exists(path):
        print(f"  WARNING: Missing video file: {filename}")
        return ""
    return b64(path)

def b64_image(filename):
    path = os.path.join(ASSETS_IMAGES, filename)
    if not os.path.exists(path):
        print(f"  WARNING: Missing image file: {filename}")
        return ""
    return b64(path)

print("Building Banana Badass: Endcaps of Destiny...")

# ── FONT ──────────────────────────────────────────────────────
print("  Loading font...")
font_b64 = b64(os.path.join(ASSETS_FONTS, "ClaudiaShouter-Black.otf"))

# ── AUDIO ─────────────────────────────────────────────────────
print("  Loading audio...")
collect_b64      = b64_audio("collect.wav")
powerup_b64      = b64_audio("powerup.wav")
hit_b64          = b64_audio("hit.wav")
jump_b64         = b64_audio("jump.wav")
dead_b64         = b64_audio("dead.wav")
leaderboard_b64  = b64_audio("leaderboard.mp3")
music_b64        = b64_audio("music.mp4")

# ── VIDEOS ────────────────────────────────────────────────────
print("  Loading videos...")
intro_b64       = b64_video("intro.mp4")
cs1_assassin    = b64_video("cutscene_assassin.mp4")
cs1_bulldozer   = b64_video("cutscene_bulldozer.mp4")
cs1_curious     = b64_video("cutscene_curious.mp4")
cs1_nerd        = b64_video("cutscene_nerd.mp4")
cs2_assassin    = b64_video("cutscene2_assassin.mp4")
cs2_bulldozer   = b64_video("cutscene2_bulldozer.mp4")
cs2_curious     = b64_video("cutscene2_curious.mp4")
cs2_nerd        = b64_video("cutscene2_nerd.mp4")
cs3_assassin    = b64_video("cutscene3_assassin.mp4")
cs3_bulldozer   = b64_video("cutscene3_bulldozer.mp4")
cs3_curious     = b64_video("cutscene3_curious.mp4")
cs3_nerd        = b64_video("cutscene3_nerd.mp4")
end_assassin    = b64_video("ending_assassin.mp4")
end_bulldozer   = b64_video("ending_bulldozer.mp4")
end_curious     = b64_video("ending_curious.mp4")
end_nerd        = b64_video("ending_nerd.mp4")

# ── IMAGES ────────────────────────────────────────────────────
print("  Loading images...")
image_files = [
    "Level_1_Background_scroll.png",
    "Level_2_Background_scroll.png",
    "Level_3_Head_Office.png",
    "Cover_Image.png",
    "Banana_Badass_Assassin_Still.png",
    "Banana_Badass_Bulldozer_Still.png",
    "Banana_Badass_Curious_Still.png",
    "Banana_Badass_Nerd_Still.png",
    "Banana_Badass_Assassin_Select.png",
    "Banana_Badass_Bulldozer_Select.png",
    "Banana_Badass_Curious_Select.png",
    "Banana_Badass_Nerd_Select.png",
    "Banana_Badass_Nerd_Running.png",
    "Nerd_Sprite_Sheet.png",
    "Assassin_Sprite_Sheet.png",
    "Bulldozer_Sprite_Sheet.png",
    "Curious_Sprite_Sheet.png",
    "Claudia_Power_Up.png",
    "Conventional_Case.png",
    "Organic_Case.png",
    "Bananasplain.png",
    "Detractor_Lady.png",
    "Greenwasher.png",
    "Money_Gun.png",
    "Legal_Jail.png",
    "Fake_Cert.png",
    "Game_snapshot.png",
    "Apple_stand.png",
    "cruiser_table.png",
    "messy_desk.png",
]

asset_lines = []
for fname in image_files:
    data = b64_image(fname)
    asset_lines.append(f'  "{fname}": "data:image/png;base64,{data}"')
assets_js = "const ASSETS = {\n" + ",\n".join(asset_lines) + "\n};"

# ── GAME CORE ─────────────────────────────────────────────────
print("  Loading game_core.js...")
with open(GAME_CORE, "r", encoding="utf-8", errors="ignore") as f:
    game_js = f.read()

# ── ASSEMBLE HTML ─────────────────────────────────────────────
print("  Assembling HTML...")
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Banana Badass: Endcaps of Destiny</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:100%; height:100%; background:#000; overflow:hidden; }}
body {{ display:flex; justify-content:center; align-items:center; }}
canvas {{ display:block; image-rendering:pixelated; image-rendering:crisp-edges; cursor:pointer; }}
:fullscreen body {{ cursor:none; }}
:-webkit-full-screen body {{ cursor:none; }}
@font-face {{
  font-family: "ClaudiaShouter";
  src: url("data:font/otf;base64,{font_b64}") format("opentype");
}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
document.fonts.load('20px "ClaudiaShouter"');
var SFX_COLLECT  = "data:audio/wav;base64,{collect_b64}";
var SFX_POWERUP  = "data:audio/wav;base64,{powerup_b64}";
var SFX_HIT      = "data:audio/wav;base64,{hit_b64}";
var SFX_JUMP     = "data:audio/wav;base64,{jump_b64}";
var SFX_DEAD         = "data:audio/wav;base64,{dead_b64}";
var LEADERBOARD_SRC  = "data:audio/mpeg;base64,{leaderboard_b64}";
var INTRO_VIDEO_SRC         = "data:video/mp4;base64,{intro_b64}";
var CUTSCENE_ASSASSIN_SRC   = "data:video/mp4;base64,{cs1_assassin}";
var CUTSCENE_BULLDOZER_SRC  = "data:video/mp4;base64,{cs1_bulldozer}";
var CUTSCENE_CURIOUS_SRC    = "data:video/mp4;base64,{cs1_curious}";
var CUTSCENE_NERD_SRC       = "data:video/mp4;base64,{cs1_nerd}";
var CUTSCENE2_ASSASSIN_SRC  = "data:video/mp4;base64,{cs2_assassin}";
var CUTSCENE2_BULLDOZER_SRC = "data:video/mp4;base64,{cs2_bulldozer}";
var CUTSCENE2_CURIOUS_SRC   = "data:video/mp4;base64,{cs2_curious}";
var CUTSCENE2_NERD_SRC      = "data:video/mp4;base64,{cs2_nerd}";
var CUTSCENE3_ASSASSIN_SRC  = "data:video/mp4;base64,{cs3_assassin}";
var CUTSCENE3_BULLDOZER_SRC = "data:video/mp4;base64,{cs3_bulldozer}";
var CUTSCENE3_CURIOUS_SRC   = "data:video/mp4;base64,{cs3_curious}";
var CUTSCENE3_NERD_SRC      = "data:video/mp4;base64,{cs3_nerd}";
var ENDING_ASSASSIN_SRC     = "data:video/mp4;base64,{end_assassin}";
var ENDING_BULLDOZER_SRC    = "data:video/mp4;base64,{end_bulldozer}";
var ENDING_CURIOUS_SRC      = "data:video/mp4;base64,{end_curious}";
var ENDING_NERD_SRC         = "data:video/mp4;base64,{end_nerd}";
var MUSIC_SRC = "data:audio/mp4;base64,{music_b64}";
{assets_js}
{game_js}
</script>
</body>
</html>"""

out_path = os.path.join(OUTPUT_DIR, "index.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

size_mb = os.path.getsize(out_path) / 1024 / 1024
print(f"\n✅ Done! output/index.html — {size_mb:.1f} MB")
print(f"   Open in Chrome: file://{out_path}")

# ── LEADERBOARD PAGE ──────────────────────────────────────────
print("\n  Building leaderboard.html...")
lb_src_path = os.path.join(ROOT, "leaderboard_src.html")
with open(lb_src_path, "r", encoding="utf-8") as f:
    lb_html = f.read()
lb_html = lb_html.replace("FONT_DATA_URL", f"data:font/otf;base64,{font_b64}")
lb_out_path = os.path.join(OUTPUT_DIR, "leaderboard.html")
with open(lb_out_path, "w", encoding="utf-8") as f:
    f.write(lb_html)
print(f"✅ Done! output/leaderboard.html")
