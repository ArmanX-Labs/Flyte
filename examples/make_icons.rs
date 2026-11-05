use std::fs;
use std::process::Command;
use image::{imageops::FilterType, ImageFormat};

fn main() {
    let img_path = "/Users/arman/.gemini/antigravity/brain/95862f38-9b4a-4abb-bbfe-a6afcd369bc4/mycloud_macos_icon_1793905842089.jpg";
    let img = image::open(img_path).expect("Failed to open generated image");
    let rgba = img.to_rgba8();

    let sizes = [
        ("icons/icon.png", 512),
        ("icons/128x128@2x.png", 256),
        ("icons/128x128.png", 128),
        ("icons/32x32.png", 32),
    ];

    for (path, size) in sizes {
        let resized = image::imageops::resize(&rgba, size, size, FilterType::Lanczos3);
        resized.save_with_format(path, ImageFormat::Png).unwrap();
    }

    // Build iconset for iconutil
    let iconset_dir = "icons/icon.iconset";
    fs::create_dir_all(iconset_dir).unwrap();

    let iconset_specs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ];

    for (name, sz) in iconset_specs {
        let resized = image::imageops::resize(&rgba, sz, sz, FilterType::Lanczos3);
        resized.save_with_format(format!("{}/{}", iconset_dir, name), ImageFormat::Png).unwrap();
    }

    let _ = Command::new("iconutil")
        .args(["-c", "icns", iconset_dir, "-o", "icons/icon.icns"])
        .status();

    let _ = fs::remove_dir_all(iconset_dir);

    // Create ICO for Windows
    let ico_sizes = [16, 32, 48, 64, 128, 256];
    let mut png_blobs = Vec::new();
    for s in ico_sizes {
        let resized = image::imageops::resize(&rgba, s, s, FilterType::Lanczos3);
        let mut buf = Vec::new();
        resized.write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png).unwrap();
        png_blobs.push((s, buf));
    }

    let mut ico_data = Vec::new();
    // Header: 0, 1 (icon), count
    ico_data.extend_from_slice(&0u16.to_le_bytes());
    ico_data.extend_from_slice(&1u16.to_le_bytes());
    ico_data.extend_from_slice(&(ico_sizes.len() as u16).to_le_bytes());

    let mut offset = 6 + (ico_sizes.len() as u32) * 16;
    for (s, blob) in &png_blobs {
        let w = if *s == 256 { 0u8 } else { *s as u8 };
        let h = if *s == 256 { 0u8 } else { *s as u8 };
        ico_data.push(w);
        ico_data.push(h);
        ico_data.push(0); // colors
        ico_data.push(0); // reserved
        ico_data.extend_from_slice(&1u16.to_le_bytes()); // planes
        ico_data.extend_from_slice(&32u16.to_le_bytes()); // bpp
        ico_data.extend_from_slice(&(blob.len() as u32).to_le_bytes());
        ico_data.extend_from_slice(&offset.to_le_bytes());
        offset += blob.len() as u32;
    }

    for (_, blob) in &png_blobs {
        ico_data.extend_from_slice(blob);
    }

    fs::write("icons/icon.ico", ico_data).unwrap();
    println!("All icons generated successfully!");
}

