// the retro window look: every dialog gets a real close button (the red × square) over its title bar
// (it's added to the form, not the title: editor.js rewrites the title's text, which would wipe a button inside it)
document.querySelectorAll('dialog').forEach((dialog) => {
  const x = el('button', 'win-x', '×');
  x.type = 'button';          // inside a form, a button would otherwise submit it
  x.title = 'Close';
  x.onclick = () => dialog.close();   // same as Cancel / Esc
  dialog.querySelector('form').append(x);
});
