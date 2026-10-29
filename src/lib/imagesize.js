import { openSync, readSync, closeSync, statSync } from "node:fs";

// Dimensions from the file header only. No dependencies, because this runs in
// CI where an image library is a liability, and because we need nothing else.

function png(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: "png" };
}

function jpeg(fd, size) {
  // Walk the marker chain to the first SOF segment. Lengths are big-endian and
  // exclude the marker itself, so a malformed file would loop; `pos < size`
  // ends it.
  const head = Buffer.alloc(2);
  readSync(fd, head, 0, 2, 0);
  if (head.readUInt16BE(0) !== 0xffd8) return null;

  let pos = 2;
  const seg = Buffer.alloc(9);
  while (pos < size) {
    readSync(fd, seg, 0, 9, pos);
    if (seg[0] !== 0xff) return null;
    const marker = seg[1];
    const len = seg.readUInt16BE(2);
    const isSOF = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { height: seg.readUInt16BE(5), width: seg.readUInt16BE(7), type: "jpeg" };
    }
    pos += 2 + len;
  }
  return null;
}

export function imageSize(path) {
  const { size } = statSync(path);
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(24);
    readSync(fd, buf, 0, 24, 0);
    const p = png(buf);
    if (p) return { ...p, bytes: size };
    const j = jpeg(fd, size);
    if (j) return { ...j, bytes: size };
    return null;
  } finally {
    closeSync(fd);
  }
}
