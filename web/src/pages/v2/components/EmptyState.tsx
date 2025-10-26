import React from 'react'
import { CircleSlash } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="border rounded-lg p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <CircleSlash className="h-16 w-16" />
      <div className="text-center">
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm">Try adjusting your filters to find what you're looking for</p>
      </div>
    </div>
  )
}
