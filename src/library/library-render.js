export function createMissingThumbnail(label = '미보유콘') {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'missing-thumb';
  const mark = document.createElement('strong');
  mark.textContent = '?';
  thumbnail.append(mark);
  if (label) {
    const text = document.createElement('small');
    text.textContent = label;
    thumbnail.append(text);
  }
  return thumbnail;
}

export function renderPackageNavigation(root, { packages, cons, activeId, onSelect }) {
  root.replaceChildren();
  if (!packages.length) {
    const empty = document.createElement('div');
    empty.className = 'nav-empty';
    empty.textContent = '동기화된 디시콘이 없습니다.';
    root.append(empty);
    return;
  }
  packages.forEach(pkg => {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.classList.toggle('active', pkg.id === activeId);
    const name = document.createElement('span');
    name.textContent = String(pkg.name);
    const count = document.createElement('small');
    count.textContent = String(cons.filter(con => con.packageId === pkg.id).length);
    button.append(name, count);
    button.addEventListener('click', () => onSelect(pkg.id));
    root.append(button);
  });
}

export function renderCollectionNavigation(root, { collections, activeId, onSelect, onDrop }) {
  root.replaceChildren();
  if (!collections.length) {
    const empty = document.createElement('div');
    empty.className = 'nav-empty';
    empty.textContent = '새 콘묶음을 만들어 디시콘을 분류해 보세요.';
    root.append(empty);
    root.dispatchEvent(new Event('hhjcon:library-navigation-rendered'));
    return;
  }
  collections.forEach(collection => {
    const row = document.createElement('div');
    row.className = 'collection-row';
    row.dataset.collectionId = collection.id;
    row.classList.toggle('active', collection.id === activeId);

    const button = document.createElement('button');
    button.className = 'collection-main';
    const name = document.createElement('span');
    name.textContent = String(collection.name);
    const count = document.createElement('small');
    count.textContent = String(collection.items.length);
    button.append(name, count);
    button.addEventListener('click', () => onSelect(collection.id));

    row.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', async event => {
      event.preventDefault();
      row.classList.remove('drop-target');
      await onDrop(event, collection.id);
    });

    const remove = document.createElement('button');
    remove.className = 'icon-button';
    remove.title = '콘묶음 삭제';
    remove.textContent = '×';
    row.append(button, remove);
    root.append(row);
  });
  root.dispatchEvent(new Event('hhjcon:library-navigation-rendered'));
}

export function renderConGrid(root, { cons, selectedIds, collectionMode, onSelect, onOpen, onDrop }) {
  root.replaceChildren();
  cons.forEach(con => {
    const card = document.createElement('button');
    card.className = 'con-card';
    card.draggable = !con.missing;
    card.dataset.conId = con.id;
    card.classList.toggle('selected', selectedIds.has(con.id));
    card.classList.toggle('missing', Boolean(con.missing));

    let thumbnail;
    if (con.thumbnailUrl) {
      thumbnail = document.createElement('img');
      thumbnail.src = String(con.thumbnailUrl);
      thumbnail.alt = '';
    } else {
      thumbnail = createMissingThumbnail(con.missing ? '미보유콘' : '');
    }
    const name = document.createElement('span');
    name.textContent = String(con.name);
    card.append(thumbnail, name);
    card.title = con.missing ? con.id : `${con.name}\n${con.id}`;
    card.addEventListener('click', event => onSelect(event, con.id));
    card.addEventListener('dblclick', () => {
      if (!con.missing) onOpen(con.id);
    });

    if (collectionMode) {
      card.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        card.classList.add('reorder-target');
      });
      card.addEventListener('dragleave', () => card.classList.remove('reorder-target'));
      card.addEventListener('drop', async event => {
        event.preventDefault();
        card.classList.remove('reorder-target');
        await onDrop(event, con.id);
      });
    }
    root.append(card);
  });

  if (collectionMode) {
    const tail = document.createElement('div');
    tail.className = 'reorder-tail';
    tail.textContent = '여기에 놓으면 맨 뒤로 이동';
    tail.addEventListener('dragover', event => event.preventDefault());
    tail.addEventListener('drop', async event => {
      event.preventDefault();
      await onDrop(event, null);
    });
    root.append(tail);
  }
  root.dispatchEvent(new Event('hhjcon:library-grid-rendered'));
}
