'use client'

import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
// import { editMarkdownLine } from "@/lib/chat/actions"

export type Task = {
    file: string
    due: string
    checked: number
    url: string
    created: string
    scheduled: string
    start: string
    metadata: string
    description: string
}


/**

 * v0 by Vercel.
 * @see https://v0.dev/t/DiV2VQkEJ5G
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */

export function GenTasks({ tasks }: { tasks: Task[] }) {
    const handleCheckboxChange = async (task: Task) => {
        // Update the tasks state based on the checkbox change
        // // You can perform any necessary client-side updates here
        console.log("long before that")
        var newLine = ""
        var searchString = ""

        if (!task.checked) {
             newLine = `- [ ] ${task.description} `    
             searchString =  `- [x] ${task.description} `     
        } else {
          newLine = `- [x] ${task.description} `   
          searchString =  `- [ ] ${task.description} `             
        }
        
        // try {
        // editMarkdownLine(task.url, task.description, newLine)
        // } catch (error) {
        //     console.error("Error updating task:", error);
        // }

        try {
            const response = await fetch('/api/updateTask', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filePath: task.url,
                searchString: searchString,
                newContent: newLine,
              }),
            });
        
            if (response.ok) {
              console.log('Task updated successfully');
            } else {
              console.error('Error updating task:', response.statusText);
            }
          } catch (error) {
            console.error('Error updating task:', error);
          }
      };
    
  return (
    <div className="mx-auto my-0">
      <ul className="space-y-4">
      {tasks.map((task: Task) => {
            const metadata = JSON.parse(task.metadata);
            const rating = metadata.rating;
            const url = task.url
            const title = task.description
            // if (!author && !rating) return null;
      return ( 
           <li key={task.description} className="flex items-start space-x-3">
              <Checkbox
                id={`task-${task.description}`}
                task={task}
                onCheckboxChange={(task) =>
                  handleCheckboxChange(task)
                }
              />
          <div className="flex-1">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-gray-500">{url}</p>
          </div>
        </li>        
            )
        })}
      </ul>
    </div>
  )
}

