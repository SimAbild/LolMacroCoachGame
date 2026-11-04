export function createElement(tagName, { className, text, attributes, dataset } = {}, ...children) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  for (const [name, value] of Object.entries(attributes ?? {})) {
    element.setAttribute(name, value);
  }
  Object.assign(element.dataset, dataset);
  element.append(...children.filter(Boolean));
  return element;
}

export function createImage(source, alternativeText, className) {
  const image = createElement('img', { className, attributes: { src: source, alt: alternativeText, draggable: 'false' } });
  image.loading = 'lazy';
  return image;
}

export function createButton(label, onClick, className = 'button') {
  const button = createElement('button', { className, text: label, attributes: { type: 'button' } });
  button.addEventListener('click', onClick);
  return button;
}
