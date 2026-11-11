import { memo } from 'react';
import { PAGE_DIMENSIONS, getContentHeightPerPage } from '../types';

interface PageBreakIndicatorProps {
  pageIndex: number;
  hasHeader: boolean;
  hasFooter: boolean;
}

export const PageBreakIndicator = memo<PageBreakIndicatorProps>(({
  pageIndex,
  hasHeader,
  hasFooter,
}) => {
  const contentHeight = getContentHeightPerPage(hasHeader, hasFooter);
  const pageHeight = contentHeight + PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX * 2;
  const breakPosition = pageHeight * (pageIndex + 1);

  const currentPage = pageIndex + 1;
  const nextPage = pageIndex + 2;

  return (
    <div
      className="page-break-indicator"
      style={{ top: `${breakPosition}px` }}
      role="separator"
      aria-label={`Page break between page ${currentPage} and ${nextPage}`}
    >
      <div className="page-break-line" />
      <span className="page-break-badge">
        \u00b7\u00b7\u00b7  Page {currentPage} | {nextPage}  \u00b7\u00b7\u00b7
      </span>
      <div className="page-break-line" />
    </div>
  );
});

PageBreakIndicator.displayName = 'PageBreakIndicator';

interface PageBreaksProps {
  pageCount: number;
  headerText: string;
  footerText: string;
}

export const PageBreaks = memo<PageBreaksProps>(({
  pageCount,
  headerText,
  footerText,
}) => {
  const hasHeader = Boolean(headerText);
  const hasFooter = Boolean(footerText);

  if (pageCount <= 1) return null;

  return (
    <>
      {Array.from({ length: pageCount - 1 }).map((_, index) => (
        <PageBreakIndicator
          key={index}
          pageIndex={index}
          hasHeader={hasHeader}
          hasFooter={hasFooter}
        />
      ))}
    </>
  );
});

PageBreaks.displayName = 'PageBreaks';
