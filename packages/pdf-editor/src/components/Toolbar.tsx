import { memo } from 'react';
import type { TextFormat, FormatOption } from '../types';
import { FONT_OPTIONS, FONT_SIZE_OPTIONS, BLOCK_FORMAT_OPTIONS } from '../types';

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
}) => {
  return (
    <fieldset disabled={disabled} className="editor-toolbar" role="toolbar" aria-label="Editor formatting tools" style={{ margin: 0, minWidth: 0, border: 0 }}>
      {/* Format Section */}
      <div className="toolbar-section">
        <ToolbarSelect
          options={BLOCK_FORMAT_OPTIONS}
          defaultValue="p"
          onChange={onFormatBlock}
          ariaLabel="Block format"
        />
        <ToolbarSelect
          options={FONT_OPTIONS}
          onChange={(value) => onCommand('fontName', value)}
          ariaLabel="Font family"
        />
        <ToolbarSelect
          options={FONT_SIZE_OPTIONS}
          defaultValue="3"
          onChange={(value) => onCommand('fontSize', value)}
          ariaLabel="Font size"
        />
      </div>

      <Divider />

      {/* Text Style Section */}
      <div className="toolbar-section">
        <ToolbarButton
          icon={<strong>B</strong>}
          title="Bold (Ctrl+B)"
          isActive={activeFormats.has('bold')}
          onClick={() => onCommand('bold')}
        />
        <ToolbarButton
          icon={<em>I</em>}
          title="Italic (Ctrl+I)"
          isActive={activeFormats.has('italic')}
          onClick={() => onCommand('italic')}
        />
        <ToolbarButton
          icon={<u>U</u>}
          title="Underline (Ctrl+U)"
          isActive={activeFormats.has('underline')}
          onClick={() => onCommand('underline')}
        />
        <ToolbarButton
          icon={<s>S</s>}
          title="Strikethrough"
          isActive={activeFormats.has('strikethrough')}
          onClick={() => onCommand('strikeThrough')}
        />
      </div>

      <Divider />

      {/* Color Section */}
      <div className="toolbar-section">
        <ColorPicker
          defaultValue="#000000"
          onChange={(color) => onCommand('foreColor', color)}
          title="Text Color"
        />
        <ColorPicker
          defaultValue="#ffff00"
          onChange={(color) => onCommand('hiliteColor', color)}
          title="Highlight Color"
        />
      </div>

      <Divider />

      {/* Alignment Section */}
      <div className="toolbar-section">
        <ToolbarButton
          icon="⫷"
          title="Align Left"
          isActive={activeFormats.has('left')}
          onClick={() => onCommand('justifyLeft')}
        />
        <ToolbarButton
          icon="⫶"
          title="Align Center"
          isActive={activeFormats.has('center')}
          onClick={() => onCommand('justifyCenter')}
        />
        <ToolbarButton
          icon="⫸"
          title="Align Right"
          isActive={activeFormats.has('right')}
          onClick={() => onCommand('justifyRight')}
        />
        <ToolbarButton
          icon="☰"
          title="Justify"
          isActive={activeFormats.has('justify')}
          onClick={() => onCommand('justifyFull')}
        />
      </div>

      <Divider />

      {/* Lists Section */}
      <div className="toolbar-section">
        <ToolbarButton
          icon="•"
          title="Bullet List"
          isActive={activeFormats.has('ul')}
          onClick={() => onCommand('insertUnorderedList')}
        />
        <ToolbarButton
          icon="1."
          title="Numbered List"
          isActive={activeFormats.has('ol')}
          onClick={() => onCommand('insertOrderedList')}
        />
        <ToolbarButton
          icon="⇤"
          title="Decrease Indent"
          onClick={() => onCommand('outdent')}
        />
        <ToolbarButton
          icon="⇥"
          title="Increase Indent"
          onClick={() => onCommand('indent')}
        />
      </div>

      <Divider />

      {/* Insert Section */}
      <div className="toolbar-section">
        <ToolbarButton
          icon="🔗"
          title="Insert Link"
          onClick={onInsertLink}
        />
        <ToolbarButton
          icon="🖼️"
          title="Insert Image"
          onClick={onInsertImage}
        />
        <ToolbarButton
          icon="―"
          title="Horizontal Line"
          onClick={() => onCommand('insertHorizontalRule')}
        />
      </div>

      <Divider />

      {/* History Section */}
      <div className="toolbar-section">
        <ToolbarButton
          icon="↩"
          title="Undo (Ctrl+Z)"
          onClick={() => onCommand('undo')}
        />
        <ToolbarButton
          icon="↪"
          title="Redo (Ctrl+Y)"
          onClick={() => onCommand('redo')}
        />
        <ToolbarButton
          icon="✕"
          title="Clear Formatting"
          onClick={() => onCommand('removeFormat')}
        />
      </div>

      <div className="toolbar-spacer" />

      {/* Document Settings Section */}
      <div className="toolbar-section toolbar-section-settings">
        <input
          type="text"
          className="toolbar-filename"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          placeholder="Document name"
          aria-label="PDF file name"
        />
        <label className="toolbar-toggle" title="Show Header/Footer settings">
          <input
            type="checkbox"
            checked={showHeaderFooter}
            onChange={onToggleHeaderFooter}
            aria-label="Toggle header and footer panel"
          />
          <span className="toggle-slider" />
          <span className="toggle-label">Header/Footer</span>
        </label>
        <ToolbarButton
          icon="⬇ PDF"
          title="Export to PDF (Ctrl+S)"
          isPrimary
          onClick={onExport}
        />
      </div>
    </fieldset>
  );
});

Toolbar.displayName = 'Toolbar';
