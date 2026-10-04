function buildFearPicker(box) {
  box.replaceChildren(...FEARS.map((name) => {
    const label = el('label', 'fearchip');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = name;          // no `name` attribute, so FormData ignores it
    label.append(input, document.createTextNode(name));
    return label;
  }));
}
const getFears = (box) => [...box.querySelectorAll('input:checked')].map((i) => i.value);
const setFears = (box, list = []) => box.querySelectorAll('input').forEach((i) => (i.checked = list.includes(i.value)));

buildFearPicker($('ent-fears'));
buildFearPicker($('ep-fears'));