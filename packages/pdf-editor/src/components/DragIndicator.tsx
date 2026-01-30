import { memo } from 'react';

interface DragIndicatorProps {
  isDragging: boolean;
  selection: string;
}

export const DragIndicator = memo<DragIndicatorProps>(({ isDragging, selection }) => {
  if (!isDragging) return null;

  const displayText = selection.length > 30 
    ? `${selection.substring(0, 30)}...` 
    : selection;

  return (
    <div 
      className="drag-indicator" 
      role="status" 
      aria-live="polite"
      aria-label="Dragging selected text"
    >
      ✋ Moving: "{displayText}"
    </div>
  );
});

DragIndicator.displayName = 'DragIndicator';
