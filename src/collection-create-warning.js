const button = document.getElementById('newCollectionBtn');
const WARNING = '(만들어둔 콘묶음은 브라우저 데이터 삭제시 지워집니다. 콘묶음 내보내기로 백업을 해두십시오.)';

if (button) {
  button.addEventListener('click', () => {
    const originalPrompt = window.prompt;
    window.prompt = function(message, defaultValue) {
      window.prompt = originalPrompt;
      const text = message === '새 콘묶음 이름을 입력하세요.'
        ? `${message}\n\n${WARNING}`
        : message;
      return originalPrompt.call(window, text, defaultValue);
    };
    queueMicrotask(() => {
      if (window.prompt !== originalPrompt) window.prompt = originalPrompt;
    });
  }, { capture: true });
}
