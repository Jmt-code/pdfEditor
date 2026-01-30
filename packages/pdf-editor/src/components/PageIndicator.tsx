import { memo } from 'react';

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
}

export const PageIndicator = memo<PageIndicatorProps>(({ currentPage, totalPages }) => (
  <div 
    className="page-indicator" 
    role="status" 
    aria-live="polite"
    aria-label={`Page ${currentPage} of ${totalPages}`}
  >
    Page {currentPage} of {totalPages}
  </div>
));

PageIndicator.displayName = 'PageIndicator';
