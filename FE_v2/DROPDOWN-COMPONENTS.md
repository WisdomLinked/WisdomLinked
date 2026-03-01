# Custom Dropdown Components

This project uses custom popover-based dropdowns instead of native HTML `<select>` elements for better UX and styling consistency.

## Select Component

The `Select` component automatically positions itself above or below the trigger based on available space using Radix UI's collision detection.

### Basic Usage

```tsx
import { Select, SelectItem } from "@/components/ui/select";

function MyComponent() {
  const [value, setValue] = useState("");

  return (
    <Select value={value} onValueChange={setValue} placeholder="Choose an option">
      <SelectItem value="option1">Option 1</SelectItem>
      <SelectItem value="option2">Option 2</SelectItem>
      <SelectItem value="option3">Option 3</SelectItem>
    </Select>
  );
}
```

### Features

- **Smart Positioning**: Automatically flips to the side with more available space
- **Collision Detection**: Adjusts position to stay within viewport (8px padding)
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Visual Feedback**: Shows checkmark for selected item
- **Custom Styling**: Matches your design system
- **Max Height**: Scrollable when items exceed 300px height
- **Match Width**: Dropdown matches trigger button width

### Props

#### Select
- `value?: string` - Currently selected value
- `onValueChange?: (value: string) => void` - Callback when selection changes
- `placeholder?: string` - Text shown when no value selected
- `disabled?: boolean` - Disable the select
- `className?: string` - Additional CSS classes

#### SelectItem
- `value: string` - Unique value for this option
- `children: React.ReactNode` - Display label
- `disabled?: boolean` - Disable this specific option

### Example with Disabled Options

```tsx
<Select value={status} onValueChange={setStatus} placeholder="Select status">
  <SelectItem value="active">Active</SelectItem>
  <SelectItem value="pending">Pending</SelectItem>
  <SelectItem value="disabled" disabled>Disabled (unavailable)</SelectItem>
  <SelectItem value="archived">Archived</SelectItem>
</Select>
```

## Popover Component

For custom dropdown-like menus, use the `Popover` component directly.

### Basic Usage

```tsx
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function MyMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <button className="w-full text-left px-2 py-1 hover:bg-accent rounded">
            Action 1
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-accent rounded">
            Action 2
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Positioning

The popover automatically detects available space and positions itself accordingly:

```tsx
<PopoverContent
  side="bottom"        // Preferred side: top, right, bottom, left
  align="start"        // Alignment: start, center, end
  sideOffset={4}       // Distance from trigger
  collisionPadding={8} // Minimum distance from viewport edges
>
  {/* content */}
</PopoverContent>
```

## Why Not Native Dropdowns?

Native `<select>` elements have several limitations:

1. **Limited Styling**: Cannot fully customize appearance across browsers
2. **No Smart Positioning**: Always drop down, even when space is limited
3. **Poor Mobile UX**: Native mobile dropdowns often don't match app design
4. **Limited Content**: Can only contain text, no icons or rich content
5. **Inconsistent Behavior**: Different rendering across browsers and platforms

Our custom implementation provides:

- ✅ Consistent styling across all platforms
- ✅ Smart collision detection and positioning
- ✅ Rich content support (icons, badges, etc.)
- ✅ Better accessibility features
- ✅ Smooth animations
- ✅ Full keyboard navigation

