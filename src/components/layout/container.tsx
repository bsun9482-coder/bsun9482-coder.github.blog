import { cn } from "@/lib/utils"

type ContainerProps = React.ComponentProps<"div"> & {
  as?: React.ElementType
}

/* 全站唯一的版心。宽度与左右留白走 index.css 里的布局令牌
   （--layout-max / --layout-gutter / --layout-gutter-sm），改一处全站跟着变。
   为什么不再用 max-w-6xl：那是 1152px，行宽偏长；1120 是「一行 70~80 个字」的舒适区。
   手机上从 20px 起，到 sm 断点才给到 28px —— 小屏幕上 28px 会挤掉正文宽度。 */
export function Container({
  as,
  className,
  children,
  ...props
}: ContainerProps) {
  const Component = as ?? "div"

  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-(--layout-max) px-(--layout-gutter-sm) sm:px-(--layout-gutter)",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
