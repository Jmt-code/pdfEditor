import { memo } from 'react';
import type { TextFormat, FormatOption, ToolId, CustomToolbarItem } from '../types';
import { FONT_OPTIONS, FONT_SIZE_OPTIONS, BLOCK_FORMAT_OPTIONS } from '../types';
import { MESSAGES_EN } from '../i18n';
import type { EditorMessages } from '../i18n';

interface ToolbarProps {
  disabled?: boolean;
  activeFormats: Set<TextFormat>;
  showHeaderFooter: boolean;
  fileName: string;
  onFileNameChange: (name: string) => void;
  onToggleHeaderFooter: () => void;
  onExport: () => void;
  onCommand: (command: string, value?: string) => void;
  onFormatBlock: (tag: string) => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertImageFile?: () => void;
  onInsertTable?: () => void;
  onInsertPageBreak?: () => void;
  /** Textos de la interfaz (por defecto, inglés) */
  messages?: EditorMessages;
  /** Herramientas que no se muestran */
  hiddenTools?: ToolId[];
  /** Botones adicionales, al final de la barra */
  customItems?: CustomToolbarItem[];
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  isActive?: boolean;
  isPrimary?: boolean;
  onClick: () => void;
}

const ToolbarButton = memo<ToolbarButtonProps>(({
  icon,
  title,
  isActive = false,
  isPrimary = false,
  onClick,
}) => (
  <button
    type="button"
    className={`toolbar-btn ${isActive ? 'active' : ''} ${isPrimary ? 'toolbar-btn-primary' : ''}`}
    // Evita que el botón robe el foco y la selección del editor
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={isActive}
  >
    {icon}
  </button>
));

ToolbarButton.displayName = 'ToolbarButton';

interface ToolbarSelectProps {
  options: FormatOption[];
  defaultValue?: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

const ToolbarSelect = memo<ToolbarSelectProps>(({
  options,
  defaultValue,
  onChange,
  ariaLabel,
}) => (
  <select
    className="toolbar-select"
    defaultValue={defaultValue}
    onChange={(e) => onChange(e.target.value)}
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
));

ToolbarSelect.displayName = 'ToolbarSelect';

interface ColorPickerProps {
  defaultValue: string;
  onChange: (color: string) => void;
  title: string;
}

const ColorPicker = memo<ColorPickerProps>(({ defaultValue, onChange, title }) => (
  <input
    type="color"
    className="toolbar-color"
    defaultValue={defaultValue}
    onChange={(e) => onChange(e.target.value)}
    title={title}
    aria-label={title}
  />
));

ColorPicker.displayName = 'ColorPicker';

const Divider = () => <div className="toolbar-divider" aria-hidden="true" />;

export const Toolbar = memo<ToolbarProps>(({
  disabled = false,
  activeFormats,
  showHeaderFooter,
  fileName,
  onFileNameChange,
  onToggleHeaderFooter,
  onExport,
  onCommand,
  onFormatBlock,
  onInsertLink,
  onInsertImage,
  onInsertImageFile,
  onInsertTable,
  onInsertPageBreak,
  messages: t = MESSAGES_EN,
  hiddenTools = [],
  customItems = [],
}) => {
  const hidden = new Set<ToolId>(hiddenTools);
  const show = (id: ToolId) => !hidden.has(id);

  return (
    <fieldset disabled={disabled} className="editor-toolbar" role="toolbar" aria-label={t.toolbarLabel} style={{ margin: 0, minWidth: 0, border: 0 }}>
      {/* Format Section */}
      {(show('blockFormat') || show('fontFamily') || show('fontSize')) && (
        <>
          <div className="toolbar-section">
            {show('blockFormat') && (
              <ToolbarSelect options={BLOCK_FORMAT_OPTIONS} defaultValue="p" onChange={onFormatBlock} ariaLabel={t.blockFormat} />
            )}
            {show('fontFamily') && (
              <ToolbarSelect options={FONT_OPTIONS} onChange={(value) => onCommand('fontName', value)} ariaLabel={t.fontFamily} />
            )}
            {show('fontSize') && (
              <ToolbarSelect options={FONT_SIZE_OPTIONS} defaultValue="3" onChange={(value) => onCommand('fontSize', value)} ariaLabel={t.fontSize} />
            )}
          </div>
          <Divider />
        </>
      )}

      {/* Text Style Section */}
      {show('textStyle') && (
        <>
          <div className="toolbar-section">
            <ToolbarButton icon={<strong>B</strong>} title={t.bold} isActive={activeFormats.has('bold')} onClick={() => onCommand('bold')} />
            <ToolbarButton icon={<em>I</em>} title={t.italic} isActive={activeFormats.has('italic')} onClick={() => onCommand('italic')} />
            <ToolbarButton icon={<u>U</u>} title={t.underline} isActive={activeFormats.has('underline')} onClick={() => onCommand('underline')} />
            <ToolbarButton icon={<s>S</s>} title={t.strikethrough} isActive={activeFormats.has('strikethrough')} onClick={() => onCommand('strikeThrough')} />
          </div>
          <Divider />
        </>
      )}

      {/* Color Section */}
      {show('colors') && (
        <>
          <div className="toolbar-section">
            <ColorPicker defaultValue="#000000" onChange={(color) => onCommand('foreColor', color)} title={t.textColor} />
            <ColorPicker defaultValue="#ffff00" onChange={(color) => onCommand('hiliteColor', color)} title={t.highlightColor} />
          </div>
          <Divider />
        </>
      )}

      {/* Alignment Section */}
      {show('alignment') && (
        <>
          <div className="toolbar-section">
            <ToolbarButton icon="⫷" title={t.alignLeft} isActive={activeFormats.has('left')} onClick={() => onCommand('justifyLeft')} />
            <ToolbarButton icon="⫶" title={t.alignCenter} isActive={activeFormats.has('center')} onClick={() => onCommand('justifyCenter')} />
            <ToolbarButton icon="⫸" title={t.alignRight} isActive={activeFormats.has('right')} onClick={() => onCommand('justifyRight')} />
            <ToolbarButton icon="☰" title={t.justify} isActive={activeFormats.has('justify')} onClick={() => onCommand('justifyFull')} />
          </div>
          <Divider />
        </>
      )}

      {/* Lists Section */}
      {show('lists') && (
        <>
          <div className="toolbar-section">
            <ToolbarButton icon="•" title={t.bulletList} isActive={activeFormats.has('ul')} onClick={() => onCommand('insertUnorderedList')} />
            <ToolbarButton icon="1." title={t.numberedList} isActive={activeFormats.has('ol')} onClick={() => onCommand('insertOrderedList')} />
            <ToolbarButton icon="⇤" title={t.decreaseIndent} onClick={() => onCommand('outdent')} />
            <ToolbarButton icon="⇥" title={t.increaseIndent} onClick={() => onCommand('indent')} />
          </div>
          <Divider />
        </>
      )}

      {/* Insert Section */}
      {show('insert') && (
        <>
          <div className="toolbar-section">
            <ToolbarButton icon="🔗" title={t.insertLink} onClick={onInsertLink} />
            <ToolbarButton icon="🖼️" title={t.insertImage} onClick={onInsertImage} />
            {onInsertImageFile && <ToolbarButton icon="📁" title={t.insertImageFile} onClick={onInsertImageFile} />}
            {onInsertTable && <ToolbarButton icon="▦" title={t.insertTable} onClick={onInsertTable} />}
            {onInsertPageBreak && <ToolbarButton icon="⤓" title={t.insertPageBreak} onClick={onInsertPageBreak} />}
            <ToolbarButton icon="―" title={t.horizontalLine} onClick={() => onCommand('insertHorizontalRule')} />
          </div>
          <Divider />
        </>
      )}

      {/* History Section */}
      {show('history') && (
        <div className="toolbar-section">
          <ToolbarButton icon="↩" title={t.undo} onClick={() => onCommand('undo')} />
          <ToolbarButton icon="↪" title={t.redo} onClick={() => onCommand('redo')} />
          <ToolbarButton icon="✕" title={t.clearFormatting} onClick={() => onCommand('removeFormat')} />
        </div>
      )}

      {customItems.length > 0 && (
        <>
          <Divider />
          <div className="toolbar-section">
            {customItems.map((item) => (
              <ToolbarButton key={item.id} icon={item.icon ?? item.label} title={item.title ?? item.label} onClick={item.onClick} />
            ))}
          </div>
        </>
      )}

      <div className="toolbar-spacer" />

      {/* Document Settings Section */}
      <div className="toolbar-section toolbar-section-settings">
        {show('fileName') && (
          <input
            type="text"
            className="toolbar-filename"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            placeholder={t.fileNamePlaceholder}
            aria-label={t.fileNameLabel}
          />
        )}
        {show('headerFooter') && (
          <label className="toolbar-toggle" title={t.headerFooterToggleTitle}>
            <input type="checkbox" checked={showHeaderFooter} onChange={onToggleHeaderFooter} aria-label={t.headerFooterToggleTitle} />
            <span className="toggle-slider" />
            <span className="toggle-label">{t.headerFooterToggle}</span>
          </label>
        )}
        {show('export') && <ToolbarButton icon="⬇ PDF" title={t.exportPdf} isPrimary onClick={onExport} />}
      </div>
    </fieldset>
  );
});

Toolbar.displayName = 'Toolbar';
