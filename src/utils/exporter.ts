export async function exportSvgToPng(svgId: string, filename = 'whiteboard.png') {
  const svg = document.getElementById(svgId) as SVGSVGElement | null
  if (!svg) {
    throw new Error(`未找到 id 为 ${svgId} 的 SVG 元素`)
  }

  const serializer = new XMLSerializer()
  const source = serializer.serializeToString(svg)
  //将DOM节点转换为字符串，比如<svg>...</svg>转化为"<svg>...</svg>"
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  //把数据变成“文件对象”（二进制数据），这里是把 SVG 字符串 → 变成一个 SVG 文件
  const url = URL.createObjectURL(svgBlob)
  //给 Blob 生成一个临时访问地址（URL），放到 <img src="...">或 <a href="..." download>

  const img = new Image()
  const { width, height } = svg.getBoundingClientRect()
  /*返回值类似于{
  width: 300,
  height: 150,
  top: ...,
  left: ...
  }*/
  const finalWidth = Math.max(1, Math.round(width))
  const finalHeight = Math.max(1, Math.round(height))
  //准备一个图片容器 + 获取 SVG 的安全尺寸（用于后续绘制）

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = (e) => reject(e)
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = finalWidth
  canvas.height = finalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error('无法获取 2D 上下文')
  }

  // 背景色：与界面主色接近，防止透明背景
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, finalWidth, finalHeight)
  ctx.drawImage(img, 0, 0, finalWidth, finalHeight)

  const pngUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = pngUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}




















