// Placeholder Dialext lettermark until milestone 9 supplies real artwork.
// Run from the repository root: swift dialext/design/icon/make-placeholder-icons.swift
import AppKit

let deepAtlantic = NSColor(srgbRed: 0x16 / 255, green: 0x3D / 255, blue: 0x54 / 255, alpha: 1)
let paper = NSColor(srgbRed: 0xF4 / 255, green: 0xF2 / 255, blue: 0xEC / 255, alpha: 1)

// A "D": a rectangle whose right side is a half-round, with the same shape inset as its counter.
func dPath(_ r: NSRect, stroke t: CGFloat) -> NSBezierPath {
  func shape(_ r: NSRect) -> NSBezierPath {
    let radius = min(r.height / 2, r.width)
    let p = NSBezierPath()
    p.move(to: NSPoint(x: r.minX, y: r.minY))
    p.line(to: NSPoint(x: r.maxX - radius, y: r.minY))
    p.appendArc(withCenter: NSPoint(x: r.maxX - radius, y: r.minY + radius), radius: radius, startAngle: 270, endAngle: 360)
    p.line(to: NSPoint(x: r.maxX, y: r.maxY - radius))
    p.appendArc(withCenter: NSPoint(x: r.maxX - radius, y: r.maxY - radius), radius: radius, startAngle: 0, endAngle: 90)
    p.line(to: NSPoint(x: r.minX, y: r.maxY))
    p.close()
    return p
  }
  let path = shape(r)
  path.append(shape(r.insetBy(dx: t, dy: t)))
  path.windingRule = .evenOdd
  return path
}

func bitmap(_ w: Int, _ h: Int, _ draw: () -> Void) -> NSBitmapImageRep {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  draw()
  NSGraphicsContext.restoreGraphicsState()
  return rep
}

func save(_ rep: NSBitmapImageRep, _ path: String) {
  try! FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

// macOS app icon grid: 824pt rounded plate on a 1024pt canvas.
func appIcon(_ size: Int) -> NSBitmapImageRep {
  bitmap(size, size) {
    let s = CGFloat(size) / 1024
    let plate = NSRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
    deepAtlantic.setFill()
    NSBezierPath(roundedRect: plate, xRadius: 185 * s, yRadius: 185 * s).fill()
    paper.setFill()
    dPath(NSRect(x: 345 * s, y: 292 * s, width: 350 * s, height: 440 * s), stroke: 92 * s).fill()
  }
}

let icons = "apps/desktop/src-tauri/icons/dialext"
save(appIcon(1024), "dialext/design/icon/dialext-app-icon.png")
save(appIcon(32), "\(icons)/32x32.png")
save(appIcon(128), "\(icons)/128x128.png")
save(appIcon(256), "\(icons)/128x128@2x.png")
save(appIcon(256), "apps/desktop/public/assets/dialext-icon.png")

let iconset = NSTemporaryDirectory() + "dialext.iconset"
try? FileManager.default.removeItem(atPath: iconset)
for base in [16, 32, 128, 256, 512] {
  save(appIcon(base), "\(iconset)/icon_\(base)x\(base).png")
  save(appIcon(base * 2), "\(iconset)/icon_\(base)x\(base)@2x.png")
}
let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset, "-o", "\(icons)/icon.icns"]
try! iconutil.run()
iconutil.waitUntilExit()

// Tray icons keep their state block (right of x = 118) and replace the glyph with the D,
// in the colour the original glyph used.
let tray = "plugins/tray/icons"
let glyphEdge = 118
for name in ["tray_default", "tray_degraded", "tray_recording_0", "tray_recording_1", "tray_recording_2", "tray_update"] {
  let original = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: "\(tray)/\(name).png")))!
  let (w, h) = (original.pixelsWide, original.pixelsHigh)
  var glyphColour = NSColor.white
  var minY = h, maxY = 0
  for y in 0..<h { for x in 0..<glyphEdge {
    if let c = original.colorAt(x: x, y: y), c.alphaComponent > 0.5 {
      glyphColour = c.withAlphaComponent(1); minY = min(minY, y); maxY = max(maxY, y)
    }
  } }
  let out = bitmap(w, h) {
    let flipped = h - 1 - maxY
    let height = CGFloat(maxY - minY + 1)
    glyphColour.setFill()
    dPath(NSRect(x: 8, y: CGFloat(flipped), width: height * 0.82, height: height), stroke: height * 0.24).fill()
  }
  for y in 0..<h { for x in glyphEdge..<w { out.setColor(original.colorAt(x: x, y: y)!, atX: x, y: y) } }
  save(out, "\(tray)/\(name).png")
}
