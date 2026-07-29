// ===================================================
// Google Flow Auto Generator — Page Bridge
// ===================================================
// Runs in the page's MAIN world. Content scripts live in an isolated world
// where React's __reactFiber$ / __reactProps$ expandos are invisible, so the
// only way to reach Flow's Slate editor object is from here.
//
// Why this exists: Flow's composer keeps its prompt in Slate's React state.
// Synthetic ClipboardEvent / execCommand writes land in the DOM but never in
// that state, so the send handler sees an empty prompt and silently does
// nothing — which looks exactly like "the click didn't work".
//
// Talks to content.js over window.postMessage.
(() => {
  const CALL = 'flowext-call';
  const RESULT = 'flowext-result';

  const fiberKey = (el) => Object.keys(el).find(k => k.startsWith('__reactFiber$'));
  const propsKey = (el) => Object.keys(el).find(k => k.startsWith('__reactProps$'));

  // ── Reach Slate's editor instance through the fiber tree ───────────────────
  function findSlateEditor() {
    const el = document.querySelector('[data-slate-editor="true"]') ||
               document.querySelector('[contenteditable="true"]');
    if (!el) return null;
    const key = fiberKey(el);
    if (!key) return null;

    let f = el[key];
    let hops = 0;
    while (f && hops < 40) {
      const p = f.memoizedProps;
      if (p && p.editor && typeof p.editor.insertText === 'function') return p.editor;
      const s = f.memoizedState && f.memoizedState.memoizedState;
      if (s && s.editor && typeof s.editor.insertText === 'function') return s.editor;
      f = f.return;
      hops++;
    }
    return null;
  }

  function slateText(editor) {
    return (editor.children || [])
      .map(n => (n.children || []).map(c => c.text || '').join(''))
      .join('\n');
  }

  // End of the document, so the whole thing can be selected and replaced.
  function endPoint(editor) {
    const nodes = editor.children || [];
    const li = Math.max(0, nodes.length - 1);
    const kids = (nodes[li] && nodes[li].children) || [];
    const ki = Math.max(0, kids.length - 1);
    return { path: [li, ki], offset: ((kids[ki] && kids[ki].text) || '').length };
  }

  // A React-SyntheticEvent-shaped plain object. Nothing here is a real Event,
  // which is the point: isTrusted can be told the truth the handler wants.
  function fakeClickEvent(btn) {
    const r = btn.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);

    const common = {
      type: 'click', bubbles: true, cancelable: true, isTrusted: true,
      target: btn, currentTarget: btn, srcElement: btn, view: window,
      button: 0, buttons: 0, detail: 1, clientX: x, clientY: y,
      screenX: x, screenY: y, pageX: x, pageY: y,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      defaultPrevented: false, eventPhase: 2, timeStamp: performance.now(),
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {}, stopImmediatePropagation() {},
      composedPath: () => [btn],
      getModifierState: () => false
    };

    return Object.assign({}, common, {
      nativeEvent: Object.assign({}, common),
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      persist() {}
    });
  }

  function findSendButton() {
    const btns = [...document.querySelectorAll('button')].filter(b =>
      b.offsetParent && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    return btns.find(b => [...b.querySelectorAll('i, span')]
      .some(n => /^(arrow_forward|arrow_upward|send)$/.test((n.textContent || '').trim()))) || null;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const actions = {
    // Push text straight into Slate's state — the same path a real keystroke
    // takes, so React re-renders and the send handler actually sees a prompt.
    setPrompt({ text }) {
      const editor = findSlateEditor();
      if (!editor) return { ok: false, error: 'Slate editor not reachable from fiber' };

      try {
        editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: endPoint(editor) };
        if (typeof editor.deleteFragment === 'function') editor.deleteFragment();
      } catch (e) {
        // Non-fatal: a failed clear just means we append instead of replace.
        editor.selection = { anchor: { path: [0, 0], offset: 0 },
                             focus: { path: [0, 0], offset: 0 } };
      }

      try {
        editor.insertText(text);
      } catch (e) {
        return { ok: false, error: 'insertText failed: ' + e.message };
      }

      const now = slateText(editor);
      return { ok: now.trim() === text.trim(), text: now };
    },

    // What the app actually believes is in the composer.
    getPrompt() {
      const editor = findSlateEditor();
      if (!editor) return { ok: false, error: 'Slate editor not reachable from fiber' };
      return { ok: true, text: slateText(editor) };
    },

    // Invoke React's own onClick prop directly.
    //
    // Flow's handler reads two properties off the event before doing anything.
    // A real MouseEvent carries isTrusted === false and cannot be corrected —
    // isTrusted is [LegacyUnforgeable], a non-configurable own property, so
    // defineProperty throws on it. A plain object has no such restriction, so
    // the event we hand the handler is built from scratch rather than wrapped.
    reactClick() {
      const btn = findSendButton();
      if (!btn) return { ok: false, error: 'send button not found' };
      const key = propsKey(btn);
      const props = key && btn[key];
      if (!props || typeof props.onClick !== 'function') {
        return { ok: false, error: 'no onClick prop on send button' };
      }
      try {
        props.onClick(fakeClickEvent(btn));
      } catch (e) {
        return { ok: false, error: 'onClick threw: ' + e.message };
      }
      return { ok: true };
    },

    // Same call, but every property the handler touches is recorded. Use this
    // when the send still does nothing: the log names the exact property path
    // the minified handler depends on.
    probeClick() {
      const btn = findSendButton();
      if (!btn) return { ok: false, error: 'send button not found' };
      const key = propsKey(btn);
      const props = key && btn[key];
      if (!props || typeof props.onClick !== 'function') {
        return { ok: false, error: 'no onClick prop on send button' };
      }

      const reads = [];
      const spy = (path, obj) => new Proxy(obj, {
        get(t, k) {
          const name = String(k);
          reads.push(path + '.' + name);
          const v = t[k];
          if (typeof v === 'function') return v.bind(t);
          if (v && typeof v === 'object' && !(v instanceof Node) && !(v instanceof Window)) {
            return spy(path + '.' + name, v);
          }
          return v;
        }
      });

      let threw = null;
      try {
        props.onClick(spy('event', fakeClickEvent(btn)));
      } catch (e) {
        threw = e.message;
      }
      return { ok: !threw, reads, threw };
    },

    ping() { return { ok: true, editor: !!findSlateEditor() }; }
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.tag !== CALL) return;

    let result;
    try {
      const fn = actions[d.action];
      result = fn ? fn(d.payload || {}) : { ok: false, error: 'unknown action: ' + d.action };
    } catch (err) {
      result = { ok: false, error: err.message };
    }
    window.postMessage({ tag: RESULT, id: d.id, result }, '*');
  });

  console.log('[FlowExt bridge] page-world bridge ready.');
})();
