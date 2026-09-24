/* DOM 层小工具。判断"用户是不是正在输入"这件事只在这里实现一次，
   主题热键（theme-provider）与 ESC 回首页（use-escape-to-home）共用同一份判断。 */

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return target.closest("input, textarea, select, [contenteditable='true']") !== null
}
