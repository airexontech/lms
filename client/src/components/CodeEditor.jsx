import React, { useRef, useEffect, useState, useCallback } from 'react';

/* ── Syntax token colors ──────────────────────────────────────── */
const KW = {
  java: new Set([
    'abstract','assert','boolean','break','byte','case','catch','char','class','const',
    'continue','default','do','double','else','enum','extends','final','finally','float',
    'for','goto','if','implements','import','instanceof','int','interface','long','native',
    'new','package','private','protected','public','return','short','static','strictfp',
    'super','switch','synchronized','this','throw','throws','transient','try','void',
    'volatile','while','true','false','null','String','System','out','println','print',
    'main','Scanner','Math','Integer','Double','Arrays','ArrayList','HashMap','List',
  ]),
  python: new Set([
    'and','as','assert','async','await','break','class','continue','def','del','elif',
    'else','except','finally','for','from','global','if','import','in','is','lambda',
    'nonlocal','not','or','pass','raise','return','try','while','with','yield',
    'True','False','None','print','input','range','len','int','str','float','list',
    'dict','set','tuple','type','enumerate','zip','map','filter','sorted','reversed',
  ]),
  javascript: new Set([
    'async','await','break','case','catch','class','const','continue','debugger','default',
    'delete','do','else','export','extends','false','finally','for','function','if',
    'import','in','instanceof','let','new','null','of','return','static','super','switch',
    'this','throw','true','try','typeof','undefined','var','void','while','with','yield',
    'console','log','Promise','require','module','exports','from','Arrow','Math',
  ]),
  c: new Set([
    'auto','break','case','char','const','continue','default','do','double','else','enum',
    'extern','float','for','goto','if','inline','int','long','register','return','short',
    'signed','sizeof','static','struct','switch','typedef','union','unsigned','void',
    'volatile','while','NULL','printf','scanf','include','define','main','malloc','free',
  ]),
  cpp: new Set([
    'alignas','alignof','auto','bool','break','case','catch','char','class','const',
    'constexpr','continue','decltype','default','delete','do','double','else','enum',
    'explicit','extern','false','float','for','friend','goto','if','inline','int','long',
    'mutable','namespace','new','noexcept','nullptr','operator','override','private',
    'protected','public','return','short','signed','sizeof','static','struct','switch',
    'template','this','throw','true','try','typedef','typename','union','unsigned','using',
    'virtual','void','volatile','while','cout','cin','endl','string','vector','include','std','main',
  ]),
};

const COLORS = {
  comment:  '#6b7280',
  string:   '#059669',
  number:   '#b45309',
  keyword:  '#7c3aed',  // vivid purple
  class:    '#0369a1',
  builtin:  '#c2410c',
  default:  '#e2e8f0',
};

function highlight(line, lang) {
  const kws = KW[lang] || new Set();
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\b\d+\.?\d*\b|\b[A-Z][a-zA-Z0-9_]*\b|\b\w+\b|[^\w\s]|\s+)/g;
  const parts = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    const tok = m[0];
    let color;
    if (/^(\/\/|\/\*|#)/.test(tok))       color = COLORS.comment;
    else if (/^["'`]/.test(tok))            color = COLORS.string;
    else if (/^\d/.test(tok))               color = COLORS.number;
    else if (kws.has(tok))                  color = COLORS.keyword;
    else if (/^[A-Z][a-zA-Z0-9_]*$/.test(tok)) color = COLORS.class;
    else                                    color = COLORS.default;
    parts.push({ tok, color });
  }
  return parts;
}

/* ── CodeEditor component ─────────────────────────────────────── */
export default function CodeEditor({
  value = '',
  onChange,
  language = 'java',
  minHeight = 360,
  readOnly = false,
}) {
  const containerRef  = useRef(null);
  const textareaRef   = useRef(null);
  const highlightRef  = useRef(null);
  const lineNumRef    = useRef(null);
  const [focused, setFocused] = useState(false);

  /* Keep the highlight div and line-number column scrolled in sync
     with the textarea at all times */
  const syncScroll = useCallback(() => {
    const ta  = textareaRef.current;
    const hl  = highlightRef.current;
    const ln  = lineNumRef.current;
    if (!ta || !hl || !ln) return;
    hl.scrollTop  = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
    ln.scrollTop  = ta.scrollTop;
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('scroll', syncScroll, { passive: true });
    return () => ta.removeEventListener('scroll', syncScroll);
  }, [syncScroll]);

  /* Tab key → 2-space indent */
  const handleKeyDown = (e) => {
    if (readOnly) return;
    const ta    = e.target;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      const indent  = '  ';
      const newVal  = value.slice(0, start) + indent + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + indent.length;
      });
      return;
    }

    /* Auto-close brackets */
    const PAIRS = { '{': '}', '(': ')', '[': ']' };
    if (PAIRS[e.key]) {
      e.preventDefault();
      const sel    = value.slice(start, end);
      const newVal = value.slice(0, start) + e.key + sel + PAIRS[e.key] + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = start + 1;
        ta.selectionEnd   = start + 1 + sel.length;
      });
    }

    /* Enter key → auto-indent to match current line's indent */
    if (e.key === 'Enter') {
      e.preventDefault();
      const lines  = value.slice(0, start).split('\n');
      const curLine = lines[lines.length - 1];
      const indent  = curLine.match(/^(\s*)/)[1];
      /* Extra indent after opening brace */
      const extra   = /\{\s*$/.test(curLine) ? '  ' : '';
      const ins     = '\n' + indent + extra;
      const newVal  = value.slice(0, start) + ins + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + ins.length;
      });
    }
  };

  const lines = value.split('\n');
  const lineCount = lines.length;

  /* Shared font style — MUST be identical on textarea + overlay */
  const FONT = {
    fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code','Consolas',monospace",
    fontSize:   '13.5px',
    lineHeight: '21px',   // fixed px so every line is exactly 21px
    tabSize:    2,
  };
  const LINE_H = 21; // px, must match lineHeight above
  const PAD_V  = 14; // top/bottom padding

  const editorHeight = Math.max(minHeight, lineCount * LINE_H + PAD_V * 2);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        background: '#1e1e2e',
        border: `1.5px solid ${focused ? '#7c3aed' : '#374151'}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: focused ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
    >
      {/* ── Line-number gutter ───────────────────────────── */}
      <div
        ref={lineNumRef}
        aria-hidden="true"
        style={{
          ...FONT,
          flexShrink: 0,
          width: lineCount >= 100 ? 56 : 44,
          background: '#181825',
          borderRight: '1px solid #2d2d3f',
          padding: `${PAD_V}px 0`,
          overflowY: 'hidden',
          overflowX: 'hidden',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {lines.map((_, i) => (
          <div
            key={i}
            style={{
              height: LINE_H,
              lineHeight: `${LINE_H}px`,
              textAlign: 'right',
              paddingRight: 10,
              paddingLeft: 4,
              color: '#4a5568',
              fontSize: 12,
              fontFamily: FONT.fontFamily,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* ── Editor area ─────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

        {/* Syntax-highlight layer (pointer-events: none) */}
        <div
          ref={highlightRef}
          aria-hidden="true"
          style={{
            ...FONT,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: `${PAD_V}px 14px`,
            overflowX: 'auto',
            overflowY: 'auto',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            color: COLORS.default,
            /* scrollbar hidden on overlay */
            scrollbarWidth: 'none',
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{ height: LINE_H, lineHeight: `${LINE_H}px`, display: 'block' }}
            >
              {highlight(line, language).map(({ tok, color }, j) => (
                <span key={j} style={{ color }}>{tok}</span>
              ))}
              {/* invisible char keeps empty lines at correct height */}
              {line === '' && <span style={{ color: 'transparent' }}>.</span>}
            </div>
          ))}
        </div>

        {/* Actual textarea — transparent text so cursor is visible,
            background transparent so highlight layer shows through */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => !readOnly && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={{
            ...FONT,
            position: 'relative',
            display: 'block',
            width: '100%',
            height: editorHeight,
            minHeight,
            padding: `${PAD_V}px 14px`,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'transparent',      // hide native text rendering
            caretColor: '#a78bfa',      // but show the cursor in purple
            whiteSpace: 'pre',
            overflowX: 'auto',
            overflowY: 'auto',
            /* force textarea to NOT wrap — match overlay */
            wordBreak: 'keep-all',
            overflowWrap: 'normal',
            cursor: readOnly ? 'default' : 'text',
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}
