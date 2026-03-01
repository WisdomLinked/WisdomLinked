import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

const Select = React.forwardRef<
  HTMLButtonElement,
  {
    value?: string
    onValueChange?: (value: string) => void
    placeholder?: string
    children: React.ReactNode
    className?: string
    disabled?: boolean
  }
>(({ value, onValueChange, placeholder, children, className, disabled }, ref) => {
  const [open, setOpen] = React.useState(false)
  const [selectedValue, setSelectedValue] = React.useState(value)

  React.useEffect(() => {
    setSelectedValue(value)
  }, [value])

  const handleSelect = (itemValue: string) => {
    setSelectedValue(itemValue)
    onValueChange?.(itemValue)
    setOpen(false)
  }

  // Find the selected option's label
  const selectedLabel = React.useMemo(() => {
    let label = placeholder || "Select..."
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.props.value === selectedValue) {
        label = child.props.children
      }
    })
    return label
  }, [children, selectedValue, placeholder])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          collisionPadding={8}
        >
          <div className="max-h-[300px] overflow-y-auto">
            {React.Children.map(children, (child) => {
              if (React.isValidElement<{ value: string; selected?: boolean; onSelect?: () => void }>(child)) {
                return React.cloneElement(child, {
                  selected: child.props.value === selectedValue,
                  onSelect: () => handleSelect(child.props.value),
                })
              }
              return child
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
})
Select.displayName = "Select"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  {
    value: string
    children: React.ReactNode
    disabled?: boolean
    selected?: boolean
    onSelect?: () => void
  }
>(({ value: _value, children, disabled, selected, onSelect }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        selected && "bg-accent"
      )}
      onClick={onSelect}
    >
      <span className="flex-1">{children}</span>
      {selected && <Check className="h-4 w-4 ml-2" />}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectItem }

