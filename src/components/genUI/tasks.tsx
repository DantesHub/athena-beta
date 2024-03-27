import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

export type Task = {
    due: string
    checked: string
    url: string
    created: string
    scheduled: string
    start: string
    metadata: string
}


/**
 * v0 by Vercel.
 * @see https://v0.dev/t/DiV2VQkEJ5G
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */

export function GenTasks({ tasks }: { tasks: Task[] }) {
  return (
    <div className="max-w-sm mx-auto my-10">
      <ul className="space-y-4">
      {tasks.map((task: Task) => {
            const metadata = JSON.parse(task.metadata);
            const rating = metadata.rating;

            // if (!author && !rating) return null;
      return ( 
        <li className="flex items-start space-x-3">
          <Checkbox id="task-2" />
          <div className="flex-1">
            <p className="font-semibold">Finish expense report</p>
            <p className="text-sm text-gray-500">Work</p>
          </div>
        </li>
            )
        })}
      </ul>
    </div>
  )
}

