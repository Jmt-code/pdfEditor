import { memo } from 'react';

interface HeaderFooterPanelProps {
  headerText: string;
  footerText: string;
  onHeaderChange: (value: string) => void;
  onFooterChange: (value: string) => void;
}

export const HeaderFooterPanel = memo<HeaderFooterPanelProps>(({
  headerText,
  footerText,
  onHeaderChange,
  onFooterChange,
}) => {
  return (
    <div className="header-footer-panel" role="region" aria-label="Header and footer settings">
      <div className="hf-input-group">
        <label htmlFor="header-input">Header:</label>
        <input
          id="header-input"
          type="text"
          value={headerText}
          onChange={(e) => onHeaderChange(e.target.value)}
          placeholder="Enter header text..."
          aria-describedby="header-hint"
        />
        <span id="header-hint" className="sr-only">
          Text that appears at the top of each page
        </span>
      </div>
      <div className="hf-input-group">
        <label htmlFor="footer-input">Footer:</label>
        <input
          id="footer-input"
          type="text"
          value={footerText}
          onChange={(e) => onFooterChange(e.target.value)}
          placeholder="Use {pageNumber} for page numbers"
          aria-describedby="footer-hint"
        />
        <span id="footer-hint" className="sr-only">
          Text that appears at the bottom of each page. Use {'{pageNumber}'} to include page numbers
        </span>
      </div>
    </div>
  );
});

HeaderFooterPanel.displayName = 'HeaderFooterPanel';
