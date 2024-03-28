
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Task } from "../genUI/tasks"
import { useActions, useUIState } from 'ai/rsc'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    task: Task;
    onCheckboxChange: (task: Task) => void;
  }
>(({ className, task, onCheckboxChange, ...props }, ref) => {
  const [checked, setChecked] = React.useState(task.checked === 1);

  const handleCheckboxChange = async (checked: boolean) => {
    setChecked(checked);
    task.checked = checked ? 1 : 0; // Update the task's checked property
    console.log("beaming")
    onCheckboxChange(task);
  };

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer mt-4 h-4 w-4 shrink-0 rounded-sm border border-gray-200 border-gray-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gray-900 data-[state=checked]:text-gray-50 dark:border-gray-800 dark:border-gray-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-300 dark:data-[state=checked]:bg-gray-50 dark:data-[state=checked]:text-gray-900",
        className
      )}
      checked={checked}
      onCheckedChange={handleCheckboxChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
