import { Card } from "./ui/card"

const SKELETON_LINE_WIDTHS = [100, 90, 75, 85]

export default function TemplateSkeletonCard({ index }: { index: number }) {
  return (
    <Card
      aria-hidden="true"
      className="min-h-80 rounded-2xl p-7 shadow-sm motion-safe:animate-pulse"
      style={{ animationDelay: `${index * 180}ms` }}
    >
      <div className="mb-10 h-10 w-9 rounded-md bg-muted" />
      <div className="mb-5 h-5 w-3/4 rounded bg-muted" />
      {SKELETON_LINE_WIDTHS.map((width) => (
        <div
          key={width}
          className="mb-3 h-3 rounded bg-muted"
          style={{ width: `${width}%` }}
        />
      ))}
      <div className="mt-10 h-3 w-1/3 rounded bg-muted" />
    </Card>
  )
}
