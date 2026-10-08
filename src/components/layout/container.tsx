import { cn } from "cn"

type ContainerProps = React.ComponentProps<"div"> & {
  as?: React.ElementType
}

export function Container({ as, className, children, ...props }: ContainerProps) {
  const Component = as ?? "div"

  return (
    <Component
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
      {...props}
    >
      {children}
    </Component>
  )
}
