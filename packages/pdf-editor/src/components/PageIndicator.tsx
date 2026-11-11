import { memo } from 'react';
import { MESSAGES_EN, formatMessage } from '../i18n';

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
  /** Plantilla con {current} y {total} */
  template?: string;
}

export const PageIndicator = memo<PageIndicatorProps>(({ currentPage, totalPages, template = MESSAGES_EN.pageOf }) => {
  const text = formatMessage(template, { current: currentPage, total: totalPages });
  return (
    <div className="page-indicator" role="status" aria-live="polite" aria-label={text}>
      📄 {text}
    </div>
  );
});

PageIndicator.displayName = 'PageIndicator';
