const TYPES = new Map([
  ['hhjcon-collection', ['collection', '콘묶음', '콘묶음 불러오기']],
  ['hhjcon-collections', ['collection', '콘묶음', '콘묶음 불러오기']],
  ['hhjcon-story-save', ['story', '원고', '원고 백업 불러오기']],
  ['hhjcon-story-saves', ['story', '원고', '원고 백업 불러오기']],
  ['hhjcon-editor-backup', ['editor', '에디터', '에디터 백업 불러오기']]
]);

export function wrongBackupTypeMessage(format, expectedKind) {
  const type = TYPES.get(format);
  return !type || type[0] === expectedKind ? '' : `해당 파일은 ${type[1]} 백업파일입니다. ${type[2]}를 이용해주세요.`;
}
