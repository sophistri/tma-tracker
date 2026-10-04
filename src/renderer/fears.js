// Fears are picked from a dropdown you can tick several things in (a plain <select> can only hold one).
// The button shows what's ticked; clicking it opens a list of checkboxes underneath.
function buildFearPicker(box) {
  box.classList.add('multi');

  const toggle = el('button', 'multi-toggle');   // shows the summary of what's ticked
  toggle.type = 'button';                        // inside a form, a button would otherwise submit it
  toggle.append(el('span'));

  const panel = el('div', 'multi-panel');
  panel.hidden = true;

  const clear = el('button', 'multi-clear', 'Clear all');
  clear.type = 'button';
  clear.onclick = () => {
    panel.querySelectorAll('input').forEach((i) => (i.checked = false));
    fearSummary(box);
    box.dispatchEvent(new Event('input', { bubbles: true }));   // so the form knows something changed
  };
  panel.append(clear, ...FEARS.map((name) => {
    const label = el('label', 'multi-opt');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = name;          // no `name` attribute, so FormData ignores it
    input.onchange = () => fearSummary(box);   // ticking a box already fires an 'input' event, which the forms listen for
    label.append(input, document.createTextNode(name));
    return label;
  }));

  toggle.onclick = () => { panel.hidden = !panel.hidden; };
  // Esc closes just this list: without this it would also close the dialog it sits in
  box.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !panel.hidden) {
      ev.preventDefault();
      ev.stopPropagation();
      panel.hidden = true;
      toggle.focus();
    }
  });

  box.replaceChildren(toggle, panel);
  fearSummary(box);
}

// the text on the button: "None", or the ticked names (the CSS adds "…" if they don't fit)
function fearSummary(box) {
  const chosen = getFears(box);
  const toggle = box.querySelector('.multi-toggle');
  toggle.firstChild.textContent = chosen.length ? chosen.join(', ') : 'None';
  toggle.title = chosen.length ? chosen.join(', ') : 'No fears ticked';
}

const getFears = (box) => [...box.querySelectorAll('input:checked')].map((i) => i.value);

const setFears = (box, list = []) => {
  box.querySelectorAll('input').forEach((i) => (i.checked = list.includes(i.value)));
  box.querySelector('.multi-panel').hidden = true;   // a form being (re)loaded always starts with the list closed
  fearSummary(box);
};

// clicking anywhere outside an open list closes it
document.addEventListener('mousedown', (ev) => {
  document.querySelectorAll('.multi-panel:not([hidden])').forEach((p) => {
    if (!p.parentElement.contains(ev.target)) p.hidden = true;
  });
});

buildFearPicker($('ent-fears'));
buildFearPicker($('ep-fears'));
