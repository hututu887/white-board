# 权限与身份测试用例（房间密码/邀请、角色、审计）

> 目的：验证 owner/member/viewer 权限、只读拦截、撤销/重做隔离、防旧快照回滚，以及（如已接入）导出与审计日志限制。

## 前置条件
- 前端 dev 服务已运行（`npm run dev`），访问 `http://localhost:5173/`。
- 如需多人协作，启动实时服务（如 `node server.js`），并开两窗口/两浏览器会话 A/B。
- 浏览器控制台可动态导入模块（Vite 默认支持）。

## 控制台辅助命令
```js
// 载入 store，并便于后续调用
const mod = await import('/src/state/useWhiteboardStore')
window.__wbStore = mod.useWhiteboardStore

// 切换角色：'owner' | 'member' | 'viewer'
window.__wbStore.getState().setRole('viewer')

// 查看当前角色
console.log('当前角色:', window.__wbStore.getState().role)

// 查看当前图形数量
console.log('shape 数量:', window.__wbStore.getState().shapes.length)
```

## 测试用例

### 1. 只读拦截（单窗口）
步骤：
1) 设为 viewer：`setRole('viewer')`，确认 `role` 为 viewer。
2) 尝试绘制、移动、删除、组合/解组、锁定/解锁、撤销、重做、保存/恢复快照（若有按钮）。
3) 记录操作前后 `shapes.length`，观察画布。
预期：
- 图形数量不变，画布无改动；选择高亮可用但不能改动。
- 切回 `setRole('member')` 后，以上操作恢复正常。

### 2. 撤销/重做隔离（双窗口 A/B）
步骤：
1) A、B 均设为 `member`。
2) A 绘制图形 A1；B 绘制图形 B1。
3) 在 A 执行撤销、重做；在 B 执行撤销、重做。
预期：
- A 的撤销/重做只影响 A1，不影响 B1；B 同理。
- 撤销次数与操作数一致（1 个图形最多撤销 1 次）。

### 3. 旧快照防回滚（双窗口）
步骤：
1) A 绘制新图形 A2。
2) B 刷新或断网重连，等待同步。
预期：
- A2 仍存在，未被旧状态覆盖。

### 4. 受限操作点验
步骤：
1) 设为 viewer，选中已有图形。
2) 尝试删除、锁定/解锁、组合/解组、撤销/重做、保存/恢复快照。
预期：
- 图形数量、locked 状态、分组状态均不变；历史栈长度不变。
- 切回 member/owner 后，这些操作可正常执行并产生变化。

### 5. 导出权限（如果已限制）
步骤：
1) viewer 身份点击导出按钮。
2) member/owner 身份点击导出按钮。
预期：
- viewer 被阻止或提示无权限；member/owner 正常导出。

### 6. 审计日志（如果已接入）
步骤：
1) 找到日志输出位置（控制台/文件/后端）。
2) 执行一次被拒绝操作（如 viewer 删除），再执行一次成功操作（member 删除）。
预期：
- 日志包含时间、用户/角色、操作类型、结果（拒绝/成功），并记录目标对象 ID（如有）。

### 7. 角色切换回归
步骤：
1) member 身份绘制 1 个图形。
2) 切 viewer，尝试撤销（应无效）。
3) 切回 member，再撤销（应生效且只撤销一次），可重做恢复。
预期：
- 只读时撤销无效；回到可编辑时撤销/重做按历史正确生效。

## 记录方式
- 建议在控制台打印前后 `shapes.length` 与 `role`，必要时查看单个图形的 `locked`、`groupId`。
- 如出现异常，请记录：角色、操作步骤、是否多窗口、控制台错误信息。







