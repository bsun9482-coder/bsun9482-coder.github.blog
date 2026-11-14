/* 在内存里造一张合法的 PNG，用来当上传测试的素材。
 *
 * 为什么不往仓库里塞一个 .png 文件：
 *   ① 二进制进 git 会被永久保存，改一次就多一份，而且 diff 看不出任何东西；
 *   ② 想测「缩略图一定会被缩」就得有张宽度 > 480 的图，用代码生成可以随时调尺寸；
 *   ③ 零依赖 —— Node 自带 zlib，PNG 的压缩流正好就是 zlib 格式。
 *
 * PNG 的结构很朴素：8 字节签名 + 三个「数据块」，每块都是
 *   长度(4) + 类型(4) + 数据 + CRC32(4)
 * 我们要的三块：
 *   IHDR  宽、高、位深 8、颜色类型 2（真彩色 RGB）
 *   IDAT  像素数据：每行开头一个「过滤方式」字节（0 = 不过滤），后面跟 RGB
 *   IEND  空块，表示结束
 * 压缩的是 IDAT 里的原始像素，不压缩的话 800×600 就是 1.4MB。
 */

import zlib from "node:zlib"

/* CRC32 是 PNG 每个块的校验和。查表法：先把 256 个字节的余数算好，
   之后每字节查一次表 —— 否则逐位算会慢到肉眼可见。 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

/**
 * 造一张 width×height 的 RGB PNG。
 *
 * 图里塞了伪随机噪点：纯色/渐变的 PNG 能被压到几 KB，
 * 那样「缩略图比原图小很多」这条断言就成了玩数字游戏 ——
 * 噪点让原图体积接近真实照片，比出来的差距才有意义。
 */
export function makeTestPng(width = 800, height = 600) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 每通道 8 位
  ihdr[9] = 2 // 颜色类型 2 = RGB 真彩色
  ihdr[10] = 0 // 压缩方式（0 是唯一标准值）
  ihdr[11] = 0 // 过滤方式
  ihdr[12] = 0 // 不交错

  const stride = width * 3 + 1 // +1 是每行开头的过滤字节
  const raw = Buffer.alloc(stride * height)
  /* 固定种子：每次跑出来的图完全一样，失败时不会「这次刚好过了」。 */
  let seed = 20261113
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed
  }

  let p = 0
  for (let y = 0; y < height; y++) {
    raw[p++] = 0 // 过滤方式 0：这一行原样存
    for (let x = 0; x < width; x++) {
      raw[p++] = rand() & 0xff
      raw[p++] = (x * 255) / width
      raw[p++] = (y * 255) / height
    }
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
