import { memo, useId } from 'react';
import { MESSAGES_EN } from '../i18n';
import type { EditorMessages } from '../i18n';

interface HeaderFooterPanelProps {
  headerText: string;
  footerText: string;
  onHeaderChange: (value: string) => void;
  onFooterChange: (value: string) => void;
  messages?: EditorMessages;
  /** Solo lectura: no se pueden cambiar cabecera ni pie */
  disabled?: boolean;
}

export const HeaderFooterPanel = memo<HeaderFooterPanelProps>(({
  headerText,
  footerText,
  onHeaderChange,
  onFooterChange,
  messages: t = MESSAGES_EN,
  disabled = false,
}) => {
  // Ids únicos por instancia: varios editores pueden convivir en la misma página
  const id = useId();
  return (
    <div className="header-footer-panel" role="region" aria-label={`${t.headerLabel} / ${t.footerLabel}`}>
      <div className="hf-input-group">
        <label htmlFor={`${id}-header`}>{t.headerLabel}:</label>
        <input
          id={`${id}-header`}
          type="text"
          value={headerText}
          onChange={(e) => onHeaderChange(e.target.value)}
          readOnly={disabled}
          placeholder={t.headerPlaceholder}
        />
      </div>
      <div className="hf-input-group">
        <label htmlFor={`${id}-footer`}>{t.footerLabel}:</label>
        <input
          id={`${id}-footer`}
          type="text"
          value={footerText}
          onChange={(e) => onFooterChange(e.target.value)}
          readOnly={disabled}
          placeholder={t.footerPlaceholder}
        />
      </div>
    </div>
  );
});

HeaderFooterPanel.displayName = 'HeaderFooterPanel';
