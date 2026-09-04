const conGrid = document.getElementById('conGrid');
const selectionStatus = document.getElementById('selectionStatus');

if (conGrid) {
  let pendingSelectionId = null;

  function selectedIdsForDrag(card) {
    const cards = [...conGrid.querySelectorAll('.con-card[data-con-id]')];
    const id = String(card.dataset.conId);

    if (card.classList.contains('selected')) {
      const selected = cards
        .filter(item => item.classList.contains('selected'))
        .map(item => String(item.dataset.conId));
      return selected.length ? selected : [id];
    }

    cards.forEach(item => item.classList.toggle('selected', item === card));
    if (selectionStatus) selectionStatus.textContent = '1개 선택';
    pendingSelectionId = id;
    return [id];
  }

  conGrid.addEventListener('dragstart', event => {
    if (conGrid.classList.contains('collection-order-editing')) return;
    const card = event.target.closest('.con-card[data-con-id]');
    if (!card || card.classList.contains('missing') || !event.dataTransfer) return;

    event.stopImmediatePropagation();
    const ids = selectedIdsForDrag(card);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('application/x-hhjcon-ids', JSON.stringify(ids));
    event.dataTransfer.setData('text/plain', ids.join('\n'));
    card.classList.add('dragging');
  }, true);

  conGrid.addEventListener('dragend', event => {
    const card = event.target.closest('.con-card[data-con-id]');
    card?.classList.remove('dragging');

    if (!card || !pendingSelectionId || String(card.dataset.conId) !== pendingSelectionId) return;
    pendingSelectionId = null;
    if (card.isConnected) card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, true);
}
