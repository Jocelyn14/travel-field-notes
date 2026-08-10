from pathlib import Path
import sys

from PIL import Image


def main(source_path: str, output_dir: str) -> None:
    source = Image.open(source_path).convert("RGB")
    midpoint = source.width // 2
    crops = {
        "italy-hero.webp": source.crop((0, 0, midpoint, source.height)),
        "tokyo-hero.webp": source.crop((midpoint, 0, source.width, source.height)),
    }
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    for filename, image in crops.items():
        image.save(destination / filename, "WEBP", quality=88, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: process_hero.py SOURCE OUTPUT_DIR")
    main(sys.argv[1], sys.argv[2])
