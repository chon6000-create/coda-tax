from PIL import Image, ImageDraw, ImageFont
import os

def create_pwa_icon(size, filename):
    # Navy background
    img = Image.new('RGBA', (size, size), (11, 18, 32, 255))
    draw = ImageDraw.Draw(img)
    
    # Text setup
    # Note: Using default font if custom font not found, but we'll try to make it look professional
    try:
        # Try to find a sans-serif font on Windows
        font_path_main = "C:\\Windows\\Fonts\\malgunbd.ttf" # Malgun Gothic Bold for Korean
        font_main = ImageFont.truetype(font_path_main, int(size * 0.22))
        font_top = ImageFont.truetype(font_path_main, int(size * 0.11))
    except:
        font_main = ImageFont.load_default()
        font_top = ImageFont.load_default()

    # Draw "유튜버" (Top text)
    top_text = "유튜버"
    w_top, h_top = draw.textbbox((0, 0), top_text, font=font_top)[2:4]
    draw.text(((size - w_top) / 2, size * 0.3), top_text, fill=(156, 163, 175, 255), font=font_top)
    
    # Draw "세무정석" (Main text)
    main_text = "세무정석"
    w_main, h_main = draw.textbbox((0, 0), main_text, font=font_main)[2:4]
    draw.text(((size - w_main) / 2, size * 0.45), main_text, fill=(255, 255, 255, 255), font=font_main)
    
    # Draw emerald accent line
    line_w = size * 0.4
    line_h = size * 0.025
    draw.rounded_rectangle(
        [(size - line_w) / 2, size * 0.85, (size + line_w) / 2, size * 0.85 + line_h],
        radius=line_h/2,
        fill=(16, 185, 129, 255)
    )
    
    # Save to public folder
    public_dir = os.path.join("c:\\Users\\JIIN\\세금게임", "public")
    if not os.path.exists(public_dir):
        os.makedirs(public_dir)
    
    output_path = os.path.join(public_dir, filename)
    img.save(output_path)
    print(f"Created icon: {output_path}")

if __name__ == "__main__":
    create_pwa_icon(192, "icon-192.png")
    create_pwa_icon(512, "icon-512.png")
