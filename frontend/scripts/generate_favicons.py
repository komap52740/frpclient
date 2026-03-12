from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"


def lerp_channel(a, b, t):
    return int(round(a + (b - a) * t))


def lerp_color(color_a, color_b, t):
    return tuple(lerp_channel(color_a[idx], color_b[idx], t) for idx in range(4))


def create_background(size):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = image.load()

    top = (5, 16, 38, 255)
    bottom = (13, 61, 150, 255)
    glow = (37, 153, 255, 255)
    rim = (2, 10, 28, 255)

    glow_center_x = size * 0.28
    glow_center_y = size * 0.22
    glow_radius = size * 0.9
    max_distance = glow_radius * glow_radius

    for y in range(size):
        for x in range(size):
            diagonal_t = min(1.0, max(0.0, ((x * 0.42) + (y * 0.78)) / (size * 1.12)))
            base = lerp_color(top, bottom, diagonal_t)

            dx = x - glow_center_x
            dy = y - glow_center_y
            glow_t = max(0.0, 1.0 - ((dx * dx) + (dy * dy)) / max_distance)
            glow_mix = glow_t * 0.35
            mixed = tuple(
                lerp_channel(base[idx], glow[idx], glow_mix) if idx < 3 else 255
                for idx in range(4)
            )

            edge_dx = (x - size / 2) / (size / 2)
            edge_dy = (y - size / 2) / (size / 2)
            edge_t = min(1.0, (edge_dx * edge_dx + edge_dy * edge_dy) * 0.55)
            pixels[x, y] = tuple(
                lerp_channel(mixed[idx], rim[idx], edge_t) if idx < 3 else 255
                for idx in range(4)
            )

    radius = int(size * 0.24)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    image.putalpha(mask)

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        (2, 2, size - 3, size - 3),
        radius=radius,
        outline=(148, 197, 255, 42),
        width=max(2, int(size * 0.02)),
    )
    return Image.alpha_composite(image, border)


def apply_shadow(layer, blur_radius):
    alpha = layer.getchannel("A")
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    tinted = Image.new("RGBA", layer.size, (1, 8, 20, 170))
    return Image.composite(tinted, Image.new("RGBA", layer.size, (0, 0, 0, 0)), shadow.getchannel("A"))


def carve_bolt(body_layer, points):
    mask = Image.new("L", body_layer.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    alpha = body_layer.getchannel("A")
    alpha = ImageChops.subtract(alpha, mask)
    body_layer.putalpha(alpha)


def add_lock_emblem(image):
    size = image.size[0]
    panel = Image.new("RGBA", image.size, (0, 0, 0, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(
        (size * 0.11, size * 0.11, size * 0.89, size * 0.89),
        radius=int(size * 0.2),
        fill=(7, 18, 46, 72),
    )
    panel_draw.rounded_rectangle(
        (size * 0.11, size * 0.11, size * 0.89, size * 0.89),
        radius=int(size * 0.2),
        outline=(130, 188, 255, 24),
        width=max(1, int(size * 0.01)),
    )
    image.alpha_composite(panel)

    shackle_box = (size * 0.21, size * 0.12, size * 0.73, size * 0.60)
    shackle_width = max(6, int(size * 0.085))
    shackle_shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shackle_shadow_draw = ImageDraw.Draw(shackle_shadow)
    shackle_shadow_draw.arc(shackle_box, start=210, end=18, fill=(0, 0, 0, 210), width=shackle_width)
    shackle_shadow = shackle_shadow.filter(ImageFilter.GaussianBlur(max(4, int(size * 0.018))))
    image.alpha_composite(shackle_shadow, dest=(0, int(size * 0.02)))

    shackle = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shackle_draw = ImageDraw.Draw(shackle)
    shackle_draw.arc(shackle_box, start=210, end=18, fill=(138, 239, 255, 255), width=shackle_width)
    shackle_draw.arc(
        (size * 0.23, size * 0.145, size * 0.71, size * 0.575),
        start=210,
        end=18,
        fill=(37, 122, 255, 235),
        width=max(3, int(size * 0.03)),
    )
    image.alpha_composite(shackle)

    body = Image.new("RGBA", image.size, (0, 0, 0, 0))
    body_draw = ImageDraw.Draw(body)
    body_box = (size * 0.22, size * 0.34, size * 0.78, size * 0.79)
    body_draw.rounded_rectangle(body_box, radius=int(size * 0.13), fill=(239, 247, 255, 255))
    body_draw.rounded_rectangle(
        (size * 0.24, size * 0.36, size * 0.76, size * 0.52),
        radius=int(size * 0.1),
        fill=(191, 222, 255, 60),
    )
    carve_bolt(
        body,
        [
            (size * 0.54, size * 0.42),
            (size * 0.45, size * 0.57),
            (size * 0.53, size * 0.57),
            (size * 0.45, size * 0.72),
            (size * 0.61, size * 0.53),
            (size * 0.53, size * 0.53),
        ],
    )
    image.alpha_composite(apply_shadow(body, max(5, int(size * 0.024))), dest=(0, int(size * 0.02)))
    image.alpha_composite(body)

    spark = Image.new("RGBA", image.size, (0, 0, 0, 0))
    spark_draw = ImageDraw.Draw(spark)
    spark_draw.ellipse(
        (size * 0.72, size * 0.17, size * 0.84, size * 0.29),
        fill=(112, 246, 255, 235),
    )
    spark_draw.ellipse(
        (size * 0.745, size * 0.195, size * 0.815, size * 0.265),
        fill=(240, 255, 255, 255),
    )
    image.alpha_composite(spark)


def render_icon(size):
    icon = create_background(size)
    add_lock_emblem(icon)
    return icon


def save_png(image, size, target_name):
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(PUBLIC_DIR / target_name, format="PNG")


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    base = render_icon(512)

    save_png(base, 512, "favicon-512.png")
    save_png(base, 192, "favicon-192.png")
    save_png(base, 180, "apple-touch-icon.png")
    save_png(base, 32, "favicon-32.png")
    save_png(base, 16, "favicon-16.png")

    base.save(
        PUBLIC_DIR / "favicon.ico",
        format="ICO",
        sizes=[(64, 64), (48, 48), (32, 32), (16, 16)],
    )


if __name__ == "__main__":
    main()
