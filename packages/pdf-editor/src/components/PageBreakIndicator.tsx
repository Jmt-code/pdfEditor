import { memo } from 'react';
import { PAGE_DIMENSIONS, getContentHeightPerPage } from '../types';

interface PageBreakIndicatorProps {
  pageIndex: number;
  headerText: string;
  footerText: string;
  hasHeader: boolean;
  hasFooter: boolean;
}

export const PageBreakIndicator = memo<PageBreakIndicatorProps>(({
  pageIndex,
  headerText,
  footerText,
  hasHeader,
  hasFooter,
}) => {
  // Calcular la posición del salto de página
  // La posición es relativa al contenedor de contenido (después del primer header)
  const contentHeight = getContentHeightPerPage(hasHeader, hasFooter);
  // Añadir el padding del contenido a la posición
  const breakPosition = (contentHeight + PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX * 2) * (pageIndex + 1);
  
  const currentPage = pageIndex + 1;
  const nextPage = pageIndex + 2;

  return (
    <div
      className="page-break-indicator"
      style={{ top: `${breakPosition}px` }}
      role="separator"
      aria-label={`Page break between page ${currentPage} and ${nextPage}`}
    >
      {hasFooter && (
        <div className="page-break-footer">
          <span>{footerText.replace('{pageNumber}', String(currentPage))}</span>
        </div>
      )}
      <div className="page-break-line">
        <span className="page-break-label">
          Page {currentPage} / {nextPage}
        </span>
      </div>
      {hasHeader && (
        <div className="page-break-header">
          <span>{headerText}</span>
        </div>
      )}
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
          headerText={headerText}
          footerText={footerText}
          hasHeader={hasHeader}
          hasFooter={hasFooter}
        />
      ))}
    </>
  );
});

PageBreaks.displayName = 'PageBreaks';
