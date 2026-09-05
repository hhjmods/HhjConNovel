import { buildStoryHtmlSnapshot } from './story-html.js?v=20260905-7';

const storyList = document.getElementById('storyList');
const toolbar = document.querySelector('.text-format-toolbar');
const toastNode = document.getElementById('toast');

if (storyList && toolbar) {
  const toggle = toolbar.querySelector('.story-html-toggle');
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'story-html-copy';
  copyButton.textContent = '작성내용 복사';
  copyButton.title = '현재 작성내용을 DC 글쓰기 에디터에 바로 붙여넣을 수 있는 형식으로 복사';

  const style = document.createElement('style');
  style.id = 'story-html-copy-style';
  style.textContent = `
.story-html-copy{margin-left:auto;white-space:nowrap}.text-format-toolbar>.story-html-copy+.story-html-toggle{margin-left:0}.text-format-toolbar.html-preview-active>.story-html-copy{opacity:1!important;pointer-events:auto!important}
`;
  document.head.append(style);

  if (toggle) toolbar.insertBefore(copyButton, toggle);
  else toolbar.append(copyButton);

  let toastTimer = null;
  let copying = false;

  function showToast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2600);
  }

  function htmlToPlainText(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    box.querySelectorAll('img.written_dccon').forEach(image => {
      const label = image.getAttribute('alt') || image.getAttribute('title') || '디시콘';
      image.replaceWith(document.createTextNode(`[디시콘: ${label}]`));
    });
    box.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
    box.querySelectorAll('p, div').forEach(block => block.append(document.createTextNode('\n')));
    return box.textContent.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }

  async function copyWithClipboardApi(html, plain) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    return true;
  }

  function copyWithClipboardEvent(html, plain) {
    let handled = false;
    const onCopy = event => {
      if (!event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', plain);
      handled = true;
    };
    document.addEventListener('copy', onCopy, true);
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      document.removeEventListener('copy', onCopy, true);
    }
    return copied && handled;
  }

  function copyWithSelection(html) {
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;pointer-events:none;';
    holder.innerHTML = html;
    document.body.append(holder);

    const selection = window.getSelection();
    const savedRanges = [];
    if (selection) {
      for (let index = 0; index < selection.rangeCount; index += 1) savedRanges.push(selection.getRangeAt(index).cloneRange());
    }

    const range = document.createRange();
    range.selectNodeContents(holder);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    holder.remove();
    if (selection) {
      selection.removeAllRanges();
      savedRanges.forEach(saved => selection.addRange(saved));
    }
    return copied;
  }

  async function copyStoryHtml(html, plain) {
    try {
      if (await copyWithClipboardApi(html, plain)) return true;
    } catch {
    }
    if (copyWithClipboardEvent(html, plain)) return true;
    return copyWithSelection(html);
  }

  copyButton.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    copyButton.disabled = true;
    const originalText = copyButton.textContent;
    copyButton.textContent = '복사 중...';

    try {
      const snapshot = await buildStoryHtmlSnapshot(storyList);
      if (!snapshot.html.trim()) {
        showToast('복사할 원고가 없습니다.');
        return;
      }
      const plain = htmlToPlainText(snapshot.html);
      const copied = await copyStoryHtml(snapshot.html, plain);
      if (!copied) throw new Error('clipboard copy failed');
      if (snapshot.missingConCount > 0) {
        showToast(`작성내용을 복사했습니다. · 미보유/미동기화 콘 ${snapshot.missingConCount}개 포함`);
      } else {
        showToast('작성내용을 복사했습니다. DC 글쓰기에서 Ctrl+V로 붙여넣으세요.');
      }
    } catch (error) {
      console.error('Story clipboard copy failed', error);
      showToast('작성내용 복사에 실패했습니다. HTML 보기에서 내용을 확인해주세요.');
    } finally {
      copying = false;
      copyButton.disabled = false;
      copyButton.textContent = originalText;
    }
  });
}