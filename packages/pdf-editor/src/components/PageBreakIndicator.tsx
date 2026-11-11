import { memo } from 'react';
import { PAGE_DIMENSIONS, getContentHeightPerPage } from '../types';
import { MESSAGES_EN, formatMessage } from '../i18n';

interface PageBreakIndicatorProps {
  pageIndex: number;
  hasHeader: boolean;
  hasFooter: boolean;
  /**
   * Inicio de la página siguiente en px desde el borde superior del contenido (sin padding),
   * tal como lo calcula la paginación. Sin él se usa el alto fijo de página.
   */
  position?: number;
  /** Plantilla con {current} y {next} */
  label?: string;
}

export const PageBreakIndicator = memo<PageBreakIndicatorProps>(({
  pageIndex,
  hasHeader,
  hasFooter,
  position,
  label = MESSAGES_EN.pageBreakBetween,
}) => {
  const contentHeight = getContentHeightPerPage(hasHeader, hasFooter);
  const pageHeight = contentHeight + PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX * 2;
  // Con la paginación real (saltos manuales, líneas que no caben) el separador va justo donde
  // empieza la página siguiente; si no, a intervalos fijos
  const breakPosition = position !== undefined
    ? PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX + position
    : pageHeight * (pageIndex + 1);

  const text = formatMessage(label, { current: pageIndex + 1, next: pageIndex + 2 });

  return (
    <div
      className="page-break-indicator"
      style={{ top: `${breakPosition}px` }}
      role="separator"
      aria-label={text}
    >
      <div className="page-break-line" />
      <span className="page-break-badge">{`···  ${text}  ···`}</span>
      <div className="page-break-line" />
    </div>
  );
});

PageBreakIndicator.displayName = 'PageBreakIndicator';

interface PageBreaksProps {
  pageCount: number;
  headerText: string;
  footerText: string;
  /** Inicio de cada página (px del contenido), de usePageCalculation */
  breaks?: number[];
  label?: string;
}

export const PageBreaks = memo<PageBreaksProps>(({
  pageCount,
  headerText,
  footerText,
  breaks,
  label,
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
          position={breaks?.[index + 1]}
          label={label}
        />
      ))}
    </>
  );
});

PageBreaks.displayName = 'PageBreaks';
