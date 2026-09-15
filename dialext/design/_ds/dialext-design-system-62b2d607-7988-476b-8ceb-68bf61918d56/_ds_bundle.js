/* @ds-bundle: {"format":4,"namespace":"DialextDesignSystem_62b2d6","components":[{"name":"Badge","sourcePath":"components/core/badge/Badge.jsx"},{"name":"Tag","sourcePath":"components/core/badge/Tag.jsx"},{"name":"Button","sourcePath":"components/core/button/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/button/IconButton.jsx"},{"name":"Card","sourcePath":"components/core/card/Card.jsx"},{"name":"Dialog","sourcePath":"components/core/dialog/Dialog.jsx"},{"name":"Sheet","sourcePath":"components/core/dialog/Sheet.jsx"},{"name":"EmptyState","sourcePath":"components/core/feedback/EmptyState.jsx"},{"name":"Toast","sourcePath":"components/core/feedback/Toast.jsx"},{"name":"Checkbox","sourcePath":"components/core/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/core/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/core/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/core/forms/Select.jsx"},{"name":"Icon","sourcePath":"components/core/icon/Icon.jsx"},{"name":"Tabs","sourcePath":"components/core/tabs/Tabs.jsx"},{"name":"AudioPlayer","sourcePath":"components/product/audio/AudioPlayer.jsx"},{"name":"LanguageSelector","sourcePath":"components/product/language/LanguageSelector.jsx"},{"name":"OriginalTranslationControl","sourcePath":"components/product/language/OriginalTranslationControl.jsx"},{"name":"MeetingHeader","sourcePath":"components/product/meeting-header/MeetingHeader.jsx"},{"name":"SearchResult","sourcePath":"components/product/search/SearchResult.jsx"},{"name":"PermissionBadge","sourcePath":"components/product/status/PermissionBadge.jsx"},{"name":"ProcessingStages","sourcePath":"components/product/status/ProcessingStages.jsx"},{"name":"RecordingStatus","sourcePath":"components/product/status/RecordingStatus.jsx"},{"name":"ActionItem","sourcePath":"components/product/summary/ActionItem.jsx"},{"name":"DecisionItem","sourcePath":"components/product/summary/DecisionItem.jsx"},{"name":"SummaryBlock","sourcePath":"components/product/summary/SummaryBlock.jsx"},{"name":"SpeakerLabel","sourcePath":"components/product/transcript/SpeakerLabel.jsx"},{"name":"TranscriptSegment","sourcePath":"components/product/transcript/TranscriptSegment.jsx"},{"name":"UncertaintyMarker","sourcePath":"components/product/transcript/UncertaintyMarker.jsx"}],"sourceHashes":{"components/core/badge/Badge.jsx":"12ffc29df2c5","components/core/badge/Tag.jsx":"49982d2ac127","components/core/button/Button.jsx":"05da5509526c","components/core/button/IconButton.jsx":"6779ad37938c","components/core/card/Card.jsx":"11c0e291fb38","components/core/dialog/Dialog.jsx":"b3fd28ddc1de","components/core/dialog/Sheet.jsx":"3d10fc073367","components/core/feedback/EmptyState.jsx":"ed64b3c64964","components/core/feedback/Toast.jsx":"3e92bc0df127","components/core/forms/Checkbox.jsx":"20e9ef70e8f4","components/core/forms/Input.jsx":"ad48bd1d29a6","components/core/forms/Radio.jsx":"3992a050c401","components/core/forms/Select.jsx":"0b92c2f6688a","components/core/icon/Icon.jsx":"a19049c9d901","components/core/tabs/Tabs.jsx":"bd8b8c25fec7","components/product/audio/AudioPlayer.jsx":"0c8b5e63bc2f","components/product/language/LanguageSelector.jsx":"4ea34161087b","components/product/language/OriginalTranslationControl.jsx":"4cfde6610197","components/product/meeting-header/MeetingHeader.jsx":"b2dd2d965971","components/product/search/SearchResult.jsx":"37800085a6f4","components/product/status/PermissionBadge.jsx":"3ce496c7a450","components/product/status/ProcessingStages.jsx":"9c6df7aec0c1","components/product/status/RecordingStatus.jsx":"a89e4375c144","components/product/summary/ActionItem.jsx":"77ce2b14a690","components/product/summary/DecisionItem.jsx":"95d8be577a5d","components/product/summary/SummaryBlock.jsx":"967f7f7f4c70","components/product/transcript/SpeakerLabel.jsx":"b33622d0e27d","components/product/transcript/TranscriptSegment.jsx":"213810b06376","components/product/transcript/UncertaintyMarker.jsx":"b0bf5a3d9cec","ui_kits/web-app/MeetingWorkspace.jsx":"d8561ca58c15","ui_kits/web-app/RecordingsList.jsx":"cc5aed074426","ui_kits/web-app/UploadPanel.jsx":"9d4656210a4b","ui_kits/web-app/app.jsx":"aa2813315055"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DialextDesignSystem_62b2d6 = window.DialextDesignSystem_62b2d6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/badge/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--surface-subtle)',
    fg: 'var(--text-secondary)'
  },
  information: {
    bg: 'var(--info-subtle)',
    fg: 'var(--info-strong)'
  },
  success: {
    bg: 'var(--success-subtle)',
    fg: 'var(--success-strong)'
  },
  warning: {
    bg: 'var(--warning-subtle)',
    fg: 'var(--warning-strong)'
  },
  error: {
    bg: 'var(--error-subtle)',
    fg: 'var(--error-strong)'
  },
  recording: {
    bg: 'var(--recording-subtle)',
    fg: 'var(--recording-strong)'
  },
  generated: {
    bg: 'var(--surface-generated)',
    fg: 'var(--brand-cyanotype)'
  },
  translation: {
    bg: 'var(--surface-translation)',
    fg: 'var(--text-secondary)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  icon
}) {
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 'var(--text-label-sm-size)',
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 'var(--radius-sm)',
      background: t.bg,
      color: t.fg,
      lineHeight: '16px'
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/badge/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/badge/Tag.jsx
try { (() => {
function Tag({
  children,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-body-sm-size)',
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-default)',
      color: 'var(--text-primary)'
    }
  }, children, onRemove ? /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Remove",
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--text-tertiary)',
      padding: 0,
      font: 'inherit'
    }
  }, "\xD7") : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/badge/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/button/Button.jsx
try { (() => {
const sizes = {
  md: {
    padding: '9px 16px',
    fontSize: 'var(--text-body-sm-size)',
    gap: 8
  },
  lg: {
    padding: '12px 20px',
    fontSize: 'var(--text-body-md-size)',
    gap: 8
  }
};
const variants = {
  primary: {
    mat: 'dlx-mat dlx-mat-control',
    base: {
      '--mat-base': 'var(--action-primary)',
      color: 'var(--text-inverse)',
      border: '1px solid var(--action-primary)'
    },
    hover: {
      '--mat-base': 'var(--action-primary-hover)',
      borderColor: 'var(--action-primary-hover)'
    },
    active: {
      '--mat-base': 'var(--action-primary-active)',
      borderColor: 'var(--action-primary-active)'
    }
  },
  secondary: {
    mat: 'dlx-mat dlx-mat-panel',
    base: {
      '--mat-base': 'var(--surface-default)',
      color: 'var(--action-secondary)',
      border: '1px solid var(--border-default)'
    },
    hover: {
      '--mat-base': 'var(--surface-subtle)',
      borderColor: 'var(--action-secondary)'
    },
    active: {
      '--mat-base': 'var(--surface-subtle)'
    }
  },
  tertiary: {
    mat: '',
    base: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid transparent'
    },
    hover: {
      background: 'var(--surface-subtle)'
    },
    active: {
      background: 'var(--surface-subtle)'
    }
  },
  destructive: {
    mat: '',
    base: {
      background: 'var(--action-danger)',
      color: 'var(--text-inverse)',
      border: '1px solid var(--action-danger)'
    },
    hover: {
      background: '#8A3936',
      borderColor: '#8A3936'
    },
    active: {
      background: '#712E2B'
    }
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  onClick,
  type = 'button'
}) {
  const [state, setState] = React.useState('default');
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const style = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: s.fontSize,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    padding: s.padding,
    borderRadius: 'var(--radius-md)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    minHeight: 44,
    transition: 'background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)',
    opacity: disabled ? 0.5 : 1,
    ...v.base,
    ...(state === 'hover' && !disabled ? v.hover : {}),
    ...(state === 'active' && !disabled ? v.active : {})
  };
  return React.createElement('button', {
    type,
    disabled: disabled || loading,
    onClick,
    className: v.mat,
    onMouseEnter: () => setState('hover'),
    onMouseLeave: () => setState('default'),
    onMouseDown: () => setState('active'),
    onMouseUp: () => setState('hover'),
    style
  }, loading ? React.createElement('span', {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      animation: 'dlx-spin 0.7s linear infinite'
    }
  }) : null, icon && iconPosition === 'left' && !loading ? icon : null, children, icon && iconPosition === 'right' && !loading ? icon : null, React.createElement('style', null, '@keyframes dlx-spin{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/button/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/button/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  size = 40,
  variant = 'tertiary',
  onClick,
  disabled = false
}) {
  const [hover, setHover] = React.useState(false);
  const bg = variant === 'tertiary' ? hover ? 'var(--surface-subtle)' : 'transparent' : hover ? 'var(--action-primary-hover)' : 'var(--action-primary)';
  const color = variant === 'tertiary' ? 'var(--text-primary)' : 'var(--text-inverse)';
  return React.createElement('button', {
    type: 'button',
    'aria-label': label,
    title: label,
    disabled,
    onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: Math.max(size, 44),
      height: Math.max(size, 44),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      border: variant === 'tertiary' ? '1px solid transparent' : '1px solid var(--action-primary)',
      background: bg,
      color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--motion-fast) var(--ease-standard)'
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/button/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/card/Card.jsx
try { (() => {
function Card({
  children,
  padding = 20,
  material = 'panel'
}) {
  const cls = material === 'none' ? '' : `dlx-mat dlx-mat-${material}`;
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: {
      '--mat-base': 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding,
      boxShadow: 'var(--shadow-1)'
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/card/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/dialog/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  actions
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "presentation",
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(22,49,47,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "dlx-dialog-title",
    onClick: e => e.stopPropagation(),
    className: "dlx-mat dlx-mat-panel",
    style: {
      '--mat-base': 'var(--surface-raised)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-3)',
      padding: 24,
      width: 'min(440px, 90vw)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    id: "dlx-dialog-title",
    style: {
      margin: '0 0 12px',
      fontSize: 'var(--text-heading-h4-size)',
      fontWeight: 600
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--text-secondary)',
      marginBottom: 20
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, actions)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/dialog/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/core/dialog/Sheet.jsx
try { (() => {
function Sheet({
  open,
  title,
  children,
  onClose,
  side = 'right'
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "presentation",
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(22,49,47,0.25)',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    className: "dlx-mat dlx-mat-fibre",
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      [side]: 0,
      width: 'min(400px, 92vw)',
      '--mat-base': 'var(--surface-raised)',
      boxShadow: 'var(--shadow-3)',
      padding: 24,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 16px',
      fontSize: 'var(--text-heading-h4-size)',
      fontWeight: 600
    }
  }, title), children));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/dialog/Sheet.jsx", error: String((e && e.message) || e) }); }

// components/core/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  title,
  description,
  action,
  icon,
  material = 'halftone'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: material === 'none' ? undefined : `dlx-mat dlx-mat-${material}`,
    style: {
      '--mat-base': 'var(--surface-default)',
      textAlign: 'center',
      padding: '48px 24px',
      color: 'var(--text-secondary)',
      borderRadius: 'var(--radius-md)'
    }
  }, icon ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      opacity: 0.6
    }
  }, icon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-title-serif-size)',
      lineHeight: 'var(--text-title-serif-lh)',
      fontWeight: 500,
      color: 'var(--text-primary)',
      marginBottom: 6
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      marginBottom: action ? 18 : 0
    }
  }, description), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/feedback/Toast.jsx
try { (() => {
function Toast({
  tone = 'neutral',
  children,
  onUndo
}) {
  const borderColor = {
    neutral: 'var(--border-default)',
    success: 'var(--success-default)',
    error: 'var(--error-default)'
  }[tone] || 'var(--border-default)';
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface-raised)',
      boxShadow: 'var(--shadow-2)',
      borderLeft: `3px solid ${borderColor}`,
      fontSize: 'var(--text-body-sm-size)'
    }
  }, /*#__PURE__*/React.createElement("span", null, children), onUndo ? /*#__PURE__*/React.createElement("button", {
    onClick: onUndo,
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--text-link)',
      font: 'inherit',
      fontWeight: 600,
      cursor: 'pointer',
      padding: 0
    }
  }, "Undo") : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/core/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  id
}) {
  const cid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: cid,
    style: {
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: cid,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      width: 18,
      height: 18,
      marginTop: 2,
      accentColor: 'var(--action-primary)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--text-primary)'
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/core/forms/Input.jsx
try { (() => {
function Input({
  label,
  help,
  error,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
  id
}) {
  const inputId = id || React.useId();
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6,
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label, required ? ' *' : ''), /*#__PURE__*/React.createElement("input", {
    id: inputId,
    type: type,
    value: value,
    placeholder: placeholder,
    required: required,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      font: 'inherit',
      fontSize: 'var(--text-body-md-size)',
      padding: '10px 12px',
      minHeight: 44,
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-primary)',
      background: disabled ? 'var(--surface-disabled)' : 'var(--surface-default)',
      border: `1px solid ${error ? 'var(--action-danger)' : focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
      outline: focused ? '2px solid var(--border-focus)' : 'none',
      outlineOffset: 1
    }
  }), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--action-danger)'
    }
  }, error) : help ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, help) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/forms/Radio.jsx
try { (() => {
function Radio({
  label,
  name,
  value,
  checked,
  onChange,
  disabled = false,
  id
}) {
  const rid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: rid,
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    disabled: disabled,
    onChange: () => onChange && onChange(value),
    style: {
      width: 18,
      height: 18,
      accentColor: 'var(--action-primary)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--text-primary)'
    }
  }, label));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/core/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options,
  help,
  required = false,
  disabled = false,
  id
}) {
  const selectId = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: selectId,
    style: {
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label, required ? ' *' : ''), /*#__PURE__*/React.createElement("select", {
    id: selectId,
    value: value,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      font: 'inherit',
      fontSize: 'var(--text-body-md-size)',
      padding: '10px 12px',
      minHeight: 44,
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: disabled ? 'var(--surface-disabled)' : 'var(--surface-default)',
      color: 'var(--text-primary)'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), help ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, help) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/icon/Icon.jsx
try { (() => {
// Icon direction: Lucide (CDN, 1.75px stroke) — see readme.md ICONOGRAPHY.
// No icon set exists in the source codebase, so Lucide was chosen as the closest
// CDN match to the spec's "simple 1.5-2px line weight, neutral, slightly softened" direction.
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.75,
  label,
  style
}) {
  return React.createElement('img', {
    src: `https://cdn.jsdelivr.net/npm/lucide-static@0.462.0/icons/${name}.svg`,
    width: size,
    height: size,
    alt: label || '',
    role: label ? 'img' : 'presentation',
    style: {
      display: 'inline-block',
      verticalAlign: 'middle',
      filter: color === 'currentColor' ? undefined : undefined,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/icon/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/tabs/Tabs.jsx
try { (() => {
function Tabs({
  tabs,
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, tabs.map(t => {
    const isActive = t.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": isActive,
      onClick: () => onChange && onChange(t.value),
      style: {
        font: 'inherit',
        fontWeight: 600,
        fontSize: 'var(--text-label-md-size)',
        padding: '10px 14px',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${isActive ? 'var(--action-primary)' : 'transparent'}`,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        minHeight: 44
      }
    }, t.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/tabs/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/product/audio/AudioPlayer.jsx
try { (() => {
function AudioPlayer({
  duration = 180,
  current = 0,
  playing = false,
  onTogglePlay,
  label = 'Original audio'
}) {
  const [pos, setPos] = React.useState(current);
  const pct = duration ? Math.min(100, pos / duration * 100) : 0;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "dlx-mat dlx-mat-fibre",
    style: {
      '--mat-base': 'var(--surface-raised)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onTogglePlay,
    "aria-label": playing ? 'Pause' : 'Play',
    className: "dlx-mat dlx-mat-control",
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: 'none',
      '--mat-base': 'var(--action-primary)',
      color: 'var(--text-inverse)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, playing ? '❚❚' : '▶'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-secondary)',
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: duration,
    value: pos,
    onChange: e => setPos(Number(e.target.value)),
    "aria-label": "Seek",
    style: {
      width: '100%',
      accentColor: 'var(--audio-active)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0
    }
  }, fmt(pos), " / ", fmt(duration)));
}
Object.assign(__ds_scope, { AudioPlayer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/audio/AudioPlayer.jsx", error: String((e && e.message) || e) }); }

// components/product/language/LanguageSelector.jsx
try { (() => {
function LanguageSelector({
  label,
  value,
  options,
  onChange,
  id
}) {
  const sid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: sid,
    style: {
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    id: sid,
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      font: 'inherit',
      fontSize: 'var(--text-body-md-size)',
      padding: '10px 12px',
      minHeight: 44,
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-default)',
      color: 'var(--text-primary)'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.own ? `${o.label} · ${o.own}` : o.label))));
}
Object.assign(__ds_scope, { LanguageSelector });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/language/LanguageSelector.jsx", error: String((e && e.message) || e) }); }

// components/product/language/OriginalTranslationControl.jsx
try { (() => {
function OriginalTranslationControl({
  mode,
  onChange,
  targetLanguage
}) {
  const modes = ['Translation', 'Original', 'Compare'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden'
    }
  }, modes.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => onChange && onChange(m),
    "aria-pressed": mode === m,
    className: mode === m ? 'dlx-mat dlx-mat-control' : 'dlx-mat dlx-mat-panel',
    style: {
      font: 'inherit',
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      padding: '9px 14px',
      minHeight: 44,
      border: 'none',
      borderRight: m !== 'Compare' ? '1px solid var(--border-default)' : 'none',
      '--mat-base': mode === m ? 'var(--action-primary)' : 'var(--surface-default)',
      color: mode === m ? 'var(--text-inverse)' : 'var(--text-primary)',
      cursor: 'pointer'
    }
  }, m === 'Translation' && targetLanguage ? `Translation · ${targetLanguage}` : m)));
}
Object.assign(__ds_scope, { OriginalTranslationControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/language/OriginalTranslationControl.jsx", error: String((e && e.message) || e) }); }

// components/product/meeting-header/MeetingHeader.jsx
try { (() => {
function MeetingHeader({
  title,
  date,
  duration,
  languages = [],
  visibility,
  status,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      paddingBottom: 16,
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-serif)',
      fontSize: 'var(--text-heading-h2-size)',
      fontWeight: 500,
      color: 'var(--text-primary)',
      overflowWrap: 'anywhere'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, date), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, duration), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, languages.join(', ')), visibility, status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, actions));
}
Object.assign(__ds_scope, { MeetingHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/meeting-header/MeetingHeader.jsx", error: String((e && e.message) || e) }); }

// components/product/search/SearchResult.jsx
try { (() => {
function SearchResult({
  title,
  date,
  speakers,
  language,
  snippet,
  matchTerm,
  timestamp,
  onOpen
}) {
  const parts = matchTerm && snippet ? snippet.split(new RegExp(`(${matchTerm})`, 'i')) : [snippet];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onOpen,
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '14px 16px',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface-default)',
      cursor: 'pointer',
      font: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("span", null, date)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 6px',
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-primary)',
      lineHeight: 1.6
    }
  }, parts.map((p, i) => p.toLowerCase() === (matchTerm || '').toLowerCase() ? /*#__PURE__*/React.createElement("mark", {
    key: i,
    style: {
      background: 'var(--surface-search-match)',
      padding: '0 1px'
    }
  }, p) : /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, p))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)'
    }
  }, speakers ? /*#__PURE__*/React.createElement("span", null, speakers) : null, language ? /*#__PURE__*/React.createElement("span", null, language) : null, timestamp ? /*#__PURE__*/React.createElement("span", null, timestamp) : null));
}
Object.assign(__ds_scope, { SearchResult });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/search/SearchResult.jsx", error: String((e && e.message) || e) }); }

// components/product/status/PermissionBadge.jsx
try { (() => {
function PermissionBadge({
  state = 'Private'
}) {
  const tone = {
    Private: 'neutral',
    Restricted: 'warning',
    Shared: 'information',
    'Organisation-wide': 'information',
    'External link': 'warning'
  }[state] || 'neutral';
  const bg = {
    neutral: 'var(--surface-subtle)',
    warning: 'var(--warning-subtle)',
    information: 'var(--info-subtle)'
  }[tone];
  const fg = {
    neutral: 'var(--text-secondary)',
    warning: 'var(--warning-strong)',
    information: 'var(--info-strong)'
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 'var(--text-label-sm-size)',
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 'var(--radius-sm)',
      background: bg,
      color: fg
    }
  }, state);
}
Object.assign(__ds_scope, { PermissionBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/status/PermissionBadge.jsx", error: String((e && e.message) || e) }); }

// components/product/status/ProcessingStages.jsx
try { (() => {
const stageOrder = ['Uploading', 'Preparing audio', 'Transcribing', 'Identifying languages', 'Translating', 'Creating minutes', 'Indexing for search', 'Complete'];
function ProcessingStages({
  current,
  failed
}) {
  return /*#__PURE__*/React.createElement("ol", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: 6
    }
  }, stageOrder.map((s, i) => {
    const idx = stageOrder.indexOf(current);
    const done = i < idx || current === 'Complete';
    const active = s === current;
    return /*#__PURE__*/React.createElement("li", {
      key: s,
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontSize: 'var(--text-body-sm-size)',
        color: done ? 'var(--text-primary)' : active ? 'var(--brand-cyanotype)' : 'var(--text-tertiary)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 16,
        height: 16,
        borderRadius: '50%',
        flexShrink: 0,
        border: `2px solid ${done ? 'var(--brand-deep-atlantic)' : active ? 'var(--brand-cyanotype)' : 'var(--border-default)'}`,
        background: done ? 'var(--brand-deep-atlantic)' : 'transparent'
      }
    }), s, active && !failed ? ' — in progress' : '');
  }), failed ? /*#__PURE__*/React.createElement("li", {
    style: {
      color: 'var(--action-danger)',
      fontSize: 'var(--text-body-sm-size)',
      fontWeight: 600
    }
  }, "Failed at ", current, " \u2014 your recording is safe, try again.") : null);
}
Object.assign(__ds_scope, { ProcessingStages });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/status/ProcessingStages.jsx", error: String((e && e.message) || e) }); }

// components/product/status/RecordingStatus.jsx
try { (() => {
function RecordingStatus({
  state = 'Ready to record'
}) {
  const isLive = state === 'Recording';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      color: isLive ? 'var(--status-recording)' : 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: isLive ? 'var(--status-recording)' : 'var(--border-strong)'
    }
  }), state);
}
Object.assign(__ds_scope, { RecordingStatus });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/status/RecordingStatus.jsx", error: String((e && e.message) || e) }); }

// components/product/summary/ActionItem.jsx
try { (() => {
function ActionItem({
  text,
  owner,
  dueDate,
  done = false,
  generated = true,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '12px 0',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: done,
    onChange: onToggle,
    "aria-label": text,
    style: {
      marginTop: 4,
      width: 18,
      height: 18,
      accentColor: 'var(--action-primary)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--text-primary)',
      textDecoration: done ? 'line-through' : 'none',
      opacity: done ? 0.6 : 1
    }
  }, text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4,
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, owner ? /*#__PURE__*/React.createElement("span", null, owner) : /*#__PURE__*/React.createElement("span", null, "No owner set"), dueDate ? /*#__PURE__*/React.createElement("span", null, "Due ", dueDate) : null)));
}
Object.assign(__ds_scope, { ActionItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/summary/ActionItem.jsx", error: String((e && e.message) || e) }); }

// components/product/summary/DecisionItem.jsx
try { (() => {
function DecisionItem({
  statement,
  owner,
  source,
  onCite
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      padding: '12px 0',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--brand-deep-atlantic)',
      marginTop: 8,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--text-primary)'
    }
  }, statement), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4,
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, owner ? /*#__PURE__*/React.createElement("span", null, owner) : null, source ? /*#__PURE__*/React.createElement("button", {
    onClick: onCite,
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--text-link)',
      font: 'inherit',
      cursor: 'pointer',
      padding: 0
    }
  }, source) : null)));
}
Object.assign(__ds_scope, { DecisionItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/summary/DecisionItem.jsx", error: String((e && e.message) || e) }); }

// components/product/summary/SummaryBlock.jsx
try { (() => {
function SummaryBlock({
  children,
  generatedAt,
  outputLanguage,
  onEdit
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "dlx-mat dlx-mat-ink",
    style: {
      '--mat-base': 'var(--content-generated)',
      '--mat-strength': 'var(--texture-reading)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      fontSize: 'var(--text-label-sm-size)',
      color: 'var(--brand-cyanotype)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", null, "Generated summary \xB7 ", outputLanguage), onEdit ? /*#__PURE__*/React.createElement("button", {
    onClick: onEdit,
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--text-link)',
      font: 'inherit',
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Edit") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      lineHeight: 'var(--text-body-md-lh)',
      color: 'var(--text-primary)'
    }
  }, children), generatedAt ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)'
    }
  }, "Last generated ", generatedAt) : null);
}
Object.assign(__ds_scope, { SummaryBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/summary/SummaryBlock.jsx", error: String((e && e.message) || e) }); }

// components/product/transcript/SpeakerLabel.jsx
try { (() => {
function SpeakerLabel({
  name,
  language
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'baseline',
      marginTop: 14,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-label-sm-size)',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)'
    }
  }, name), language ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)'
    }
  }, language) : null);
}
Object.assign(__ds_scope, { SpeakerLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/transcript/SpeakerLabel.jsx", error: String((e && e.message) || e) }); }

// components/product/transcript/TranscriptSegment.jsx
try { (() => {
function TranscriptSegment({
  speaker,
  language,
  timestamp,
  original,
  translation,
  edited = false,
  selected = false,
  onPlay
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: selected ? 'dlx-mat dlx-mat-reading' : undefined,
    style: {
      '--mat-base': selected ? 'var(--surface-selected)' : undefined,
      background: selected ? undefined : 'transparent',
      borderRadius: 'var(--radius-sm)',
      padding: selected ? '6px 10px' : '6px 0',
      marginLeft: selected ? -10 : 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SpeakerLabel, {
    name: speaker,
    language: language
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'baseline'
    }
  }, timestamp ? /*#__PURE__*/React.createElement("button", {
    onClick: onPlay,
    "aria-label": `Play from ${timestamp}`,
    style: {
      border: 0,
      background: 'none',
      color: 'var(--text-tertiary)',
      font: 'inherit',
      fontSize: 'var(--text-caption-size)',
      cursor: 'pointer',
      padding: 0,
      flexShrink: 0
    }
  }, timestamp) : null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-md-size)',
      lineHeight: 1.7,
      color: 'var(--text-primary)'
    }
  }, original)), translation ? /*#__PURE__*/React.createElement("p", {
    className: "dlx-mat dlx-mat-reading",
    style: {
      '--mat-base': 'var(--surface-translation)',
      margin: '4px 0 0 0',
      fontSize: 'var(--text-body-sm-size)',
      lineHeight: 1.7,
      color: 'var(--text-secondary)',
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)'
    }
  }, translation) : null, edited ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)',
      fontVariant: 'small-caps',
      letterSpacing: '0.05em'
    }
  }, "Edited") : null);
}
Object.assign(__ds_scope, { TranscriptSegment });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/transcript/TranscriptSegment.jsx", error: String((e && e.message) || e) }); }

// components/product/transcript/UncertaintyMarker.jsx
try { (() => {
function UncertaintyMarker({
  children,
  onOpen,
  resolved = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onOpen,
    style: {
      font: 'inherit',
      color: 'inherit',
      background: 'none',
      border: 0,
      padding: 0,
      margin: 0,
      cursor: 'pointer',
      textDecoration: resolved ? 'underline solid color-mix(in srgb, var(--brand-cyanotype) 42%, transparent)' : 'underline dotted color-mix(in srgb, var(--text-secondary) 70%, transparent)',
      textUnderlineOffset: '0.22em',
      textDecorationThickness: '1px'
    },
    "aria-label": resolved ? `${children} — reviewed` : `${children} — may need review`
  }, children);
}
Object.assign(__ds_scope, { UncertaintyMarker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/product/transcript/UncertaintyMarker.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/MeetingWorkspace.jsx
try { (() => {
const {
  Button,
  IconButton,
  Icon,
  Tabs,
  Badge,
  Toast,
  Dialog,
  EmptyState
} = window.DialextDesignSystem_62b2d6;
const {
  MeetingHeader,
  SummaryBlock,
  DecisionItem,
  ActionItem,
  TranscriptSegment,
  UncertaintyMarker,
  AudioPlayer,
  OriginalTranslationControl,
  PermissionBadge,
  RecordingStatus,
  ProcessingStages
} = window.DialextDesignSystem_62b2d6;
const TRANSCRIPT = [{
  speaker: 'Máire',
  language: 'Irish',
  timestamp: '12:04',
  original: 'Ba chóir dúinn an seoladh a bhogadh go Deireadh Fómhair, chun teacht le comhdháil na gcomhpháirtithe.',
  translation: 'We should move the launch to October, to line up with the partner conference.'
}, {
  speaker: 'Tom',
  timestamp: '12:19',
  original: 'Agreed — I\u2019ll check the partner conference dates this week.',
  edited: true
}, {
  speaker: 'Sinéad',
  language: 'English',
  timestamp: '12:31',
  uncertain: true,
  original: 'That works for marketing, assuming the venue confirms by the fourteenth.'
}, {
  speaker: 'Tom',
  timestamp: '13:02',
  original: 'I\u2019ll own the venue confirmation and report back at standup.'
}];
function DownloadsPanel() {
  const items = [{
    name: 'Minutes.docx',
    ready: true
  }, {
    name: 'Minutes.pdf',
    ready: true
  }, {
    name: 'Transcript.docx',
    ready: true
  }, {
    name: 'Original audio.m4a',
    ready: false
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.name,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: it.ready ? 'var(--text-primary)' : 'var(--text-disabled)'
    }
  }, it.name), it.ready ? /*#__PURE__*/React.createElement(IconButton, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 16
    }),
    label: `Download ${it.name}`
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--text-tertiary)'
    }
  }, "Preparing\u2026"))));
}
function OverviewTab({
  onGoTranscript
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(SummaryBlock, {
    outputLanguage: "English",
    generatedAt: "14:32"
  }, "The team agreed to move the product launch to October to align with the partner conference. Marketing will lead the revised timeline once the venue is confirmed."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-heading-h4-size)',
      fontWeight: 600,
      margin: '0 0 4px',
      color: 'var(--text-primary)'
    }
  }, "Decisions"), /*#__PURE__*/React.createElement(DecisionItem, {
    statement: "Move launch to October",
    owner: "Product",
    source: "12:04 \xB7 Transcript",
    onCite: onGoTranscript
  }), /*#__PURE__*/React.createElement(DecisionItem, {
    statement: "Marketing owns the revised timeline",
    owner: "Marketing",
    source: "12:19 \xB7 Transcript",
    onCite: onGoTranscript
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-heading-h4-size)',
      fontWeight: 600,
      margin: '0 0 4px',
      color: 'var(--text-primary)'
    }
  }, "Actions"), /*#__PURE__*/React.createElement(ActionItem, {
    text: "Confirm partner conference dates",
    owner: "M\xE1ire",
    dueDate: "14 Aug"
  }), /*#__PURE__*/React.createElement(ActionItem, {
    text: "Confirm venue",
    owner: "Tom",
    dueDate: "14 Aug"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-heading-h4-size)',
      fontWeight: 600,
      margin: '0 0 10px',
      color: 'var(--text-primary)'
    }
  }, "Downloads"), /*#__PURE__*/React.createElement(DownloadsPanel, null)));
}
function TranscriptTab() {
  const [mode, setMode] = React.useState('Compare');
  const [playing, setPlaying] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(OriginalTranslationControl, {
    mode: mode,
    onChange: setMode,
    targetLanguage: "English"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "tertiary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "list-checks",
      size: 16
    })
  }, "Check uncertain passages (1)")), /*#__PURE__*/React.createElement(AudioPlayer, {
    duration: 2520,
    current: 724,
    playing: playing,
    onTogglePlay: () => setPlaying(!playing),
    label: "Original audio"
  }), /*#__PURE__*/React.createElement("div", null, TRANSCRIPT.map((t, i) => /*#__PURE__*/React.createElement(TranscriptSegment, {
    key: i,
    speaker: t.speaker,
    language: t.language,
    timestamp: t.timestamp,
    translation: mode === 'Compare' ? t.translation : mode === 'Translation' ? t.translation || t.original : undefined,
    edited: t.edited,
    original: t.uncertain ? /*#__PURE__*/React.createElement(React.Fragment, null, "That works for marketing, assuming the ", /*#__PURE__*/React.createElement(UncertaintyMarker, {
      onOpen: () => setReviewing(i)
    }, "venue confirms"), " by the fourteenth.") : mode === 'Translation' && t.translation ? t.translation : t.original
  }))), /*#__PURE__*/React.createElement(Dialog, {
    open: reviewing !== null,
    title: "Uncertain passage",
    onClose: () => setReviewing(null),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "tertiary",
      onClick: () => setReviewing(null)
    }, "Dismiss"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setReviewing(null)
    }, "Mark reviewed"))
  }, "The recognition engine was not confident about \"venue confirms\" (12:31). Listen to the original audio to verify."));
}
function AskTab() {
  const [q, setQ] = React.useState('When is the launch happening?');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      flex: 1,
      font: 'inherit',
      fontSize: 'var(--text-body-md-size)',
      padding: '10px 12px',
      minHeight: 44,
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 16
    })
  }, "Ask")), /*#__PURE__*/React.createElement("div", {
    className: "dlx-mat dlx-mat-ink",
    style: {
      '--mat-base': 'var(--content-generated)',
      '--mat-strength': 'var(--texture-reading)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-label-sm-size)',
      color: 'var(--brand-cyanotype)',
      fontWeight: 600,
      marginBottom: 8
    }
  }, "Answer based on 1 meeting"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 12px',
      color: 'var(--text-primary)'
    }
  }, "The team decided to move the launch to October, to align with the partner conference."), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--text-link)',
      font: 'inherit',
      fontSize: 'var(--text-body-sm-size)',
      cursor: 'pointer',
      padding: 0
    }
  }, "Q3 planning sync \xB7 12:04")));
}
function MeetingWorkspace({
  meeting,
  onBack
}) {
  const [tab, setTab] = React.useState('overview');
  const [shareOpen, setShareOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      border: 'none',
      background: 'none',
      color: 'var(--text-secondary)',
      font: 'inherit',
      fontSize: 'var(--text-body-sm-size)',
      cursor: 'pointer',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-left",
    size: 16
  }), " Meetings"), /*#__PURE__*/React.createElement(MeetingHeader, {
    title: meeting.title,
    date: meeting.date,
    duration: meeting.duration,
    languages: meeting.languages,
    visibility: /*#__PURE__*/React.createElement(PermissionBadge, {
      state: meeting.visibility
    }),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setShareOpen(true)
    }, "Share"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "download",
        size: 16
      })
    }, "Export"))
  }), meeting.status === 'Transcribing' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "information"
  }, "Processing"), /*#__PURE__*/React.createElement(ProcessingStages, {
    current: "Transcribing"
  })) : meeting.status === 'Failed' ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "Processing failed",
    description: "The recording is safe. Try processing again, or contact support if this keeps happening.",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary"
    }, "Try again")
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Tabs, {
    tabs: [{
      value: 'overview',
      label: 'Overview'
    }, {
      value: 'minutes',
      label: 'Minutes'
    }, {
      value: 'transcript',
      label: 'Transcript'
    }, {
      value: 'ask',
      label: 'Ask Dialext'
    }],
    active: tab,
    onChange: setTab
  }), tab === 'overview' || tab === 'minutes' ? /*#__PURE__*/React.createElement(OverviewTab, {
    onGoTranscript: () => setTab('transcript')
  }) : null, tab === 'transcript' ? /*#__PURE__*/React.createElement(TranscriptTab, null) : null, tab === 'ask' ? /*#__PURE__*/React.createElement(AskTab, null) : null), /*#__PURE__*/React.createElement(Dialog, {
    open: shareOpen,
    title: "Share this meeting",
    onClose: () => setShareOpen(false),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "tertiary",
      onClick: () => setShareOpen(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setShareOpen(false)
    }, "Update sharing"))
  }, "Currently ", /*#__PURE__*/React.createElement("strong", null, meeting.visibility), ". Changing this to organisation-wide lets everyone in Dialext see the summary, transcript and audio."));
}
window.MeetingWorkspace = MeetingWorkspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/MeetingWorkspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/RecordingsList.jsx
try { (() => {
const {
  Button,
  IconButton,
  Icon,
  Input,
  Checkbox,
  Card,
  Badge,
  Tag,
  Tabs,
  Dialog,
  Toast,
  EmptyState
} = window.DialextDesignSystem_62b2d6;
const {
  MeetingHeader,
  SummaryBlock,
  DecisionItem,
  ActionItem,
  TranscriptSegment,
  UncertaintyMarker,
  AudioPlayer,
  LanguageSelector,
  OriginalTranslationControl,
  SearchResult,
  RecordingStatus,
  ProcessingStages,
  PermissionBadge
} = window.DialextDesignSystem_62b2d6;
const MEETINGS = [{
  id: 'm1',
  title: 'Q3 planning sync',
  date: '7 Aug 2026',
  duration: '42 min',
  languages: ['Irish', 'English'],
  visibility: 'Restricted',
  status: 'Complete'
}, {
  id: 'm2',
  title: 'Weekly engineering standup',
  date: '4 Aug 2026',
  duration: '18 min',
  languages: ['English'],
  visibility: 'Organisation-wide',
  status: 'Complete'
}, {
  id: 'm3',
  title: 'Board update — Deireadh Fómhair',
  date: '31 Jul 2026',
  duration: '55 min',
  languages: ['Irish', 'English'],
  visibility: 'Private',
  status: 'Transcribing'
}, {
  id: 'm4',
  title: 'Client onboarding call',
  date: '28 Jul 2026',
  duration: '31 min',
  languages: ['English'],
  visibility: 'Shared',
  status: 'Failed'
}];
function StatusCell({
  status
}) {
  if (status === 'Complete') return /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Complete");
  if (status === 'Transcribing') return /*#__PURE__*/React.createElement(Badge, {
    tone: "information"
  }, "Transcribing");
  if (status === 'Failed') return /*#__PURE__*/React.createElement(Badge, {
    tone: "error"
  }, "Failed");
  return /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, status);
}
function RecordingsList({
  onOpen,
  onUpload
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-heading-h1-size)',
      fontWeight: 600,
      margin: 0,
      color: 'var(--text-primary)'
    }
  }, "Meetings"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "upload",
      size: 16
    }),
    onClick: onUpload
  }, "Upload a meeting")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, MEETINGS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => onOpen(m),
    style: {
      textAlign: 'left',
      font: 'inherit',
      cursor: 'pointer',
      padding: 0,
      border: 'none',
      background: 'none'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-primary)',
      overflowWrap: 'anywhere'
    }
  }, m.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)',
      marginTop: 4
    }
  }, m.date, " \xB7 ", m.duration, " \xB7 ", m.languages.join(', '))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(StatusCell, {
    status: m.status
  }), /*#__PURE__*/React.createElement(PermissionBadge, {
    state: m.visibility
  }))))))));
}
window.RecordingsList = RecordingsList;
window.StatusCell = StatusCell;
window.MEETINGS = MEETINGS;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/RecordingsList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/UploadPanel.jsx
try { (() => {
const {
  Button,
  Input,
  Checkbox,
  Dialog
} = window.DialextDesignSystem_62b2d6;
function UploadPanel({
  open,
  onClose,
  onUploaded
}) {
  const [title, setTitle] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [stage, setStage] = React.useState('form'); // form | uploading
  const canSubmit = title.trim().length > 0 && confirmed;
  function submit() {
    setStage('uploading');
    setTimeout(() => {
      onUploaded(title);
      setStage('form');
      setTitle('');
      setConfirmed(false);
    }, 1200);
  }
  return /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    title: "Add a recording",
    onClose: onClose,
    actions: stage === 'form' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "tertiary",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      disabled: !canSubmit,
      onClick: submit
    }, "Upload")) : null
  }, stage === 'form' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Meeting title",
    value: title,
    onChange: setTitle,
    placeholder: "e.g. Q3 planning sync",
    required: true
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 'var(--text-label-md-size)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      display: 'block',
      marginBottom: 6
    }
  }, "Audio file"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 20,
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-body-sm-size)'
    }
  }, "meeting-recording.m4a \u2014 42.1 MB")), /*#__PURE__*/React.createElement(Checkbox, {
    label: "I confirm we hold the rights to process this recording.",
    checked: confirmed,
    onChange: setConfirmed
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--text-secondary)',
      background: 'var(--surface-subtle)',
      borderLeft: '3px solid var(--brand-cyanotype)',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)'
    }
  }, "Recordings are accepted as development content. Customer-data processing is not yet enabled.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 0',
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-body-sm-size)'
    }
  }, "Uploading \u2014 this will keep processing after you close this dialog."));
}
window.UploadPanel = UploadPanel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/UploadPanel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/app.jsx
try { (() => {
function App() {
  const [screen, setScreen] = React.useState('list');
  const [meeting, setMeeting] = React.useState(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  function openMeeting(m) {
    setMeeting(m);
    setScreen('meeting');
  }
  function onUploaded(title) {
    setToast(`"${title}" is uploading — you can track progress from Meetings.`);
    setUploadOpen(false);
    setTimeout(() => setToast(null), 3200);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "dlx-mat dlx-mat-ambient",
    style: {
      display: 'flex',
      minHeight: '100vh',
      '--mat-base': 'var(--background-app)'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    className: "dlx-mat dlx-mat-ink",
    style: {
      width: 240,
      flexShrink: 0,
      '--mat-base': 'var(--brand-deep-atlantic)',
      color: 'var(--text-inverse)',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-serif)',
      fontWeight: 500,
      fontSize: 22,
      letterSpacing: '0.01em'
    }
  }, "Dialext"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 4,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setScreen('list');
    },
    style: {
      color: 'inherit',
      textDecoration: 'none',
      padding: '8px 10px',
      borderRadius: 8,
      background: screen === 'list' ? 'rgba(255,255,255,0.12)' : 'transparent'
    }
  }, "Meetings"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'rgba(255,255,255,0.7)',
      textDecoration: 'none',
      padding: '8px 10px'
    }
  }, "Search"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'rgba(255,255,255,0.7)',
      textDecoration: 'none',
      padding: '8px 10px'
    }
  }, "Settings")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      fontSize: 12,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.6)'
    }
  }, "Acme Council")), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      padding: '40px 48px',
      maxWidth: 960
    }
  }, screen === 'list' ? /*#__PURE__*/React.createElement(RecordingsList, {
    onOpen: openMeeting,
    onUpload: () => setUploadOpen(true)
  }) : /*#__PURE__*/React.createElement(MeetingWorkspace, {
    meeting: meeting,
    onBack: () => setScreen('list')
  })), /*#__PURE__*/React.createElement(UploadPanel, {
    open: uploadOpen,
    onClose: () => setUploadOpen(false),
    onUploaded: onUploaded
  }), toast ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 24,
      right: 24
    }
  }, /*#__PURE__*/React.createElement(window.DialextDesignSystem_62b2d6.Toast, {
    tone: "success"
  }, toast)) : null);
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/app.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Sheet = __ds_scope.Sheet;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.AudioPlayer = __ds_scope.AudioPlayer;

__ds_ns.LanguageSelector = __ds_scope.LanguageSelector;

__ds_ns.OriginalTranslationControl = __ds_scope.OriginalTranslationControl;

__ds_ns.MeetingHeader = __ds_scope.MeetingHeader;

__ds_ns.SearchResult = __ds_scope.SearchResult;

__ds_ns.PermissionBadge = __ds_scope.PermissionBadge;

__ds_ns.ProcessingStages = __ds_scope.ProcessingStages;

__ds_ns.RecordingStatus = __ds_scope.RecordingStatus;

__ds_ns.ActionItem = __ds_scope.ActionItem;

__ds_ns.DecisionItem = __ds_scope.DecisionItem;

__ds_ns.SummaryBlock = __ds_scope.SummaryBlock;

__ds_ns.SpeakerLabel = __ds_scope.SpeakerLabel;

__ds_ns.TranscriptSegment = __ds_scope.TranscriptSegment;

__ds_ns.UncertaintyMarker = __ds_scope.UncertaintyMarker;

})();
