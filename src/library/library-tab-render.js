import { CON_IDS_MIME, transferHasType } from '../story-dnd-utils.js?v=20260906-2';
import { libraryViewKey } from './library-tabs.js?v=20260911-2';

export function renderLibraryViewTabs(root, { views, activeViewKey, onActivate, onDrop, onClose }) {
  root.replaceChildren();
  views.forEach(view => {
    const key = libraryViewKey(view.type, view.id);
    const tab = document.createElement('div');
    tab.className = 'library-view-tab';
    tab.classList.toggle('active', key === activeViewKey);
    tab.classList.toggle('collection-tab', view.type === 'collections');

    const main = document.createElement('button');
    main.className = 'library-view-tab-main';
    main.textContent = view.name;
    main.title = view.type === 'collections' ? `내 콘묶음: ${view.name}` : `DC콘: ${view.name}`;
    main.addEventListener('click', () => onActivate(view));

    if (view.type === 'collections') {
      tab.addEventListener('dragover', event => {
        if (!transferHasType(event.dataTransfer, CON_IDS_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        tab.classList.add('drop-target');
      });
      tab.addEventListener('dragleave', () => tab.classList.remove('drop-target'));
      tab.addEventListener('drop', async event => {
        event.preventDefault();
        event.stopPropagation();
        tab.classList.remove('drop-target');
        await onDrop(event, view);
      });
    }

    const close = document.createElement('button');
    close.className = 'library-view-tab-close';
    close.textContent = '×';
    close.title = '탭 닫기';
    close.addEventListener('click', event => {
      event.stopPropagation();
      onClose(view, key);
    });

    tab.append(main, close);
    root.append(tab);
  });
  root.dispatchEvent(new Event('hhjcon:library-tabs-rendered'));
}
