"""Builds house_0..4.webp from house.webp: painted walls, blue glass windows, wooden door, natural grey roof."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, colorsys, os
SRC = os.path.join(os.path.dirname(__file__), '..', 'webapp', 'img')
base = Image.open(f'{SRC}/house.webp').convert('RGBA'); W, H = base.size
rgb = np.asarray(base.convert('RGB')).astype(float) / 255; alpha = np.asarray(base.getchannel('A'))

def poly_mask(pts, blur=0.9):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return m.filter(ImageFilter.GaussianBlur(blur))
roof = poly_mask([(0,80),(160,0),(336,78),(336,106),(182,175),(4,113)])
windows = [[(35,145),(75,159),(80,228),(40,215)], [(110,180),(150,196),(155,263),(115,246)], [(272,152),(307,141),(307,201),(272,213)]]
door = [(207,180),(242,175),(243,276),(208,286)]
win_m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(win_m)
for w in windows: d.polygon(w, fill=255)
win_m = win_m.filter(ImageFilter.GaussianBlur(0.8)); door_m = poly_mask(door)
roof_a, win_a, door_a = (np.asarray(m).astype(float) / 255 for m in (roof, win_m, door_m))
wall_a = np.clip(1 - np.maximum.reduce([roof_a, win_a, door_a]), 0, 1)

lum = (rgb * [0.299, 0.587, 0.114]).sum(axis=2)
shade = np.clip(lum / 0.72, 0.15, 1.35)[..., None]

def window_layer(color_frame=(0.12, 0.2, 0.32)):
    img = Image.new('RGB', (W, H), (0, 0, 0)); g = ImageDraw.Draw(img)
    for pts in windows:
        ys = [p[1] for p in pts]; y0, y1 = min(ys), max(ys)
        for y in range(y0, y1 + 1):                      # vertical sky-blue gradient glass
            t = (y - y0) / max(1, y1 - y0); c = (int(150 - 90 * t), int(215 - 85 * t), int(255 - 40 * t))
            g.line([(0, y), (W, y)], fill=c)
    arr = np.asarray(img).astype(float) / 255
    # diagonal reflection streaks + mullion + frame, restricted to the windows
    out = arr.copy(); yy, xx = np.mgrid[0:H, 0:W]
    streak = np.clip(1 - np.abs(((xx * 0.8 + yy) % 46) - 12) / 6, 0, 1) * 0.35
    out = out + streak[..., None] * (1 - out)
    return out
glass = window_layer()
edge = np.asarray(win_m.filter(ImageFilter.MinFilter(5))).astype(float) / 255
frame = (win_a - edge).clip(0, 1)[..., None]                     # darker frame ring
glass = glass * (1 - frame * 0.65) + np.array([0.08, 0.14, 0.24]) * frame * 0.65
# mullion cross (light) through each window
mull = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mull)
for pts in windows:
    cx = sum(p[0] for p in pts) / 4; cy = sum(p[1] for p in pts) / 4
    top = ((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2); bot = ((pts[2][0] + pts[3][0]) / 2, (pts[2][1] + pts[3][1]) / 2)
    lef = ((pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2); rig = ((pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2)
    md.line([top, bot], fill=200, width=2); md.line([lef, rig], fill=200, width=2)
mull_a = (np.asarray(mull.filter(ImageFilter.GaussianBlur(0.5))).astype(float) / 255 * win_a)[..., None]
glass = glass * (1 - mull_a * 0.8) + np.array([0.92, 0.97, 1.0]) * mull_a * 0.8

def wood_layer():                                               # planks: brown gradient + dark seams + handle
    arr = np.zeros((H, W, 3)); yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - 175) / 110, 0, 1)
    arr[..., 0] = 0.55 - 0.18 * t; arr[..., 1] = 0.36 - 0.12 * t; arr[..., 2] = 0.18 - 0.07 * t
    seam = (np.abs(((xx - 207) % 12.5) - 6.2) < 0.7)[..., None] * 0.22
    arr = arr * (1 - seam) + 0.05 * seam
    grain = (np.sin(xx * 1.9 + yy * 0.12) * 0.03)[..., None]
    arr = np.clip(arr + grain, 0, 1)
    img = Image.fromarray((arr * 255).astype(np.uint8)); ImageDraw.Draw(img).ellipse([(229, 230), (234, 235)], fill=(235, 200, 110))
    return np.asarray(img).astype(float) / 255
wood = wood_layer()
door_edge = np.asarray(door_m.filter(ImageFilter.MinFilter(5))).astype(float) / 255
dframe = (door_a - door_edge).clip(0, 1)[..., None]; wood = wood * (1 - dframe * 0.5) + np.array([0.18, 0.1, 0.05]) * dframe * 0.5

palette = ['#ffbe0b', '#9d4dff', '#12d67a', '#ff3d4f', '#1fb6ff']
for i, hexc in enumerate(palette):
    col = np.array([int(hexc[j:j + 2], 16) for j in (1, 3, 5)]) / 255
    painted = np.clip(col * shade ** 1.05 + np.clip(shade - 1, 0, 1) * 0.35, 0, 1)
    out = rgb * (1 - wall_a[..., None]) + painted * wall_a[..., None]           # walls painted, roof untouched
    out = out * (1 - win_a[..., None]) + glass * win_a[..., None]               # blue glass
    out = out * (1 - door_a[..., None]) + wood * door_a[..., None]              # wooden door
    im = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).convert('RGBA'); im.putalpha(Image.fromarray(alpha))
    im.save(f'{SRC}/house_{i}.webp', quality=92, method=6); print('house', i, im.size, os.path.getsize(f'{SRC}/house_{i}.webp') // 1024, 'KB')
prev = Image.new('RGB', (W * 5 // 2 + 10, H // 2 + 10), (24, 28, 52))
for i in range(5):
    h = Image.open(f'{SRC}/house_{i}.webp'); h = h.resize((W // 2, H // 2)); prev.paste(h, (i * (W // 2) + 4, 4), h)
prev.save('/tmp/claude-0/houses_preview.png')
