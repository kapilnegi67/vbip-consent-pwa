from PIL import Image, ImageDraw
import os

img192 = Image.open('public/icons/icon-192x192.png')
img192.save('public/icons/icon-192x192-maskable.png')

img512 = Image.open('public/icons/icon-512x512.png') 
img512.save('public/icons/icon-512x512-maskable.png')

for name, color in [('new-session', '#10b981'), ('pending', '#f59e0b'), ('reports', '#8b5cf6')]:
    img = Image.new('RGB', (96, 96), color)
    draw = ImageDraw.Draw(img)
    
    if name == 'new-session':
        draw.rectangle([40, 20, 56, 76], fill='white')
        draw.rectangle([20, 40, 76, 56], fill='white')
    elif name == 'pending':
        draw.ellipse([20, 20, 76, 76], fill='white')
        draw.line([48, 48, 48, 30], fill=color, width=3)
        draw.line([48, 48, 60, 48], fill=color, width=3)
    else:  # reports
        draw.rectangle([25, 15, 71, 81], fill='white')
        for y in [30, 40, 50, 60]:
            draw.rectangle([35, y, 61, y+3], fill=color)
    
    img.save(f'public/icons/shortcut-{name}.png')

print('All missing icons created successfully')
