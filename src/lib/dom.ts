/* DOM 层小工具。判断"用户是不是正在输入"这件事只在这里实现一次，
   ESC 回首页（use-escape-to-home）用它避开输入框 —— 免得在搜索框里按 ESC 被当成"回首页"。 */

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return target.closest("input, textarea, select, [contenteditable='true']") !== null
}
