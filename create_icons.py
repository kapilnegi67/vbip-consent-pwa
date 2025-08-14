from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('public/icons', exist_ok=True)

img = Image.new('RGB', (192, 192), '#2563eb')
draw = ImageDraw.Draw(img)

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 48)
except:
    try:
        font = ImageFont.load_default()
    except:
        font = None

text = 'VBIP'
if font:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (192 - text_width) // 2
    y = (192 - text_height) // 2
    draw.text((x, y), text, fill='white', font=font)
else:
    draw.text((96, 96), text, fill='white', anchor='mm')

img.save('public/icons/icon-192x192.png')

img = Image.new('RGB', (512, 512), '#2563eb')
draw = ImageDraw.Draw(img)

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 128)
except:
    try:
        font = ImageFont.load_default()
    except:
        font = None

if font:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (512 - text_width) // 2
    y = (512 - text_height) // 2
    draw.text((x, y), text, fill='white', font=font)
else:
    draw.text((256, 256), text, fill='white', anchor='mm')

img.save('public/icons/icon-512x512.png')

print('Icons created successfully')
