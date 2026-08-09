import * as React from "react"

import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

function StatCard({
  label,
  value,
  sublabel,
  accent = "ink",
}: {
  label: string
  value: React.ReactNode
  sublabel?: string
  accent?: "ink" | "accent" | "sea" | "forest" | "coral"
}) {
  const accentMap = {
    ink: "text-ink-900 dark:text-ink-100",
    accent: "text-accent-600 dark:text-accent-400",
    sea: "text-sea-600 dark:text-sea-400",
    forest: "text-forest-600 dark:text-forest-400",
    coral: "text-coral-600 dark:text-coral-400",
  }

  return (
    <Card className="p-5">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {label}
      </div>
      <div className={cn("text-3xl font-bold tabular-nums", accentMap[accent])}>{value}</div>
      {sublabel && <div className="mt-1 text-xs text-ink-400 dark:text-ink-500">{sublabel}</div>}
    </Card>
  )
}

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, StatCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }