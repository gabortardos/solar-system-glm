# Texture Credits

## Moon (photoreal pilot)

Both maps come from NASA SVS **"CGI Moon Kit"** (ID 4720), public domain:
https://svs.gsfc.nasa.gov/4720/

- **Surface color** (`moon/lroc_color_4k.jpg`): LROC WAC Hapke-normalized global
  mosaic with LOLA polar fill — `lroc_color_poles_4k.tif` (4096x2048).
- **Elevation bump** (`moon/ldem_4k.jpg`): LOLA laser-altimeter DEM —
  `ldem_16_uint.tif` (5760x2880).
- Visualization: Ernie Wright (USRA); data: NASA LRO LROC & LOLA teams.
- Conversion: TIFF -> JPEG via macOS `sips` (no resampling).
- Relief shading applies ~2.5x vertical exaggeration to the real ~1.1% lunar
  relief so craters read at explorer distances.
