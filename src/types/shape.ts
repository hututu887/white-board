export type Tool = 'select' | 'pencil' | 'rectangle' | 'ellipse' | 'line' | 'text'
export type Role = 'owner' | 'member' | 'viewer'

export type Point = {
  x: number
  y: number
}

export type ShapeType = 'free' | 'rect' | 'ellipse' | 'line' | 'text'

export type Shape = {
  id: string
  type: ShapeType//自由笔/直线/矩形/椭圆/文本
  points?: Point[]|undefined//给自由笔/直线存路径；用于重算包围盒和绘制 polyline/line。
  x: number//包围盒左上角x坐标。
  y: number//包围盒左上角y坐标。
  w: number//包围盒宽度。
  h: number//包围盒高度。
  rotation: number//预留旋转角度，将来支持旋转/变换时直接使用。
  stroke: string//描边颜色。
  fill?: string//填充颜色。
  strokeWidth: number//描边宽度。
  opacity: number//不透明度。
  text?: string//文本内容。
  groupId?: string//组合标识，用于分组操作。
  locked?: boolean//锁定标记，锁定后禁止修改。
  seed?: number//预留种子，将来支持随机化时使用。
  createdBy?: string//创建者。
  createdAt: number//创建时间。
  updatedAt: number//更新时间。
}

export type Presence = {
  userId: string
  name: string
  color: string
  cursor?: Point
  lastActive: number
}

export type BoardSnapshot = {
  shapes: Shape[]
  updatedAt: number
}


