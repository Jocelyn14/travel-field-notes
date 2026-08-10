export function classifyHorizontalGesture({ deltaX, deltaY, threshold }) {
  if (Math.abs(deltaY) >= Math.abs(deltaX)) return 'none';
  if (deltaX <= -Math.abs(threshold)) return 'reveal';
  if (deltaX >= Math.abs(threshold)) return 'close';
  return 'none';
}

export function nextPanelState(current, action) {
  if (action.type === 'open-editor') {
    return {
      type: 'editor',
      dayDate: action.dayDate,
      originId: action.originId,
    };
  }
  if (action.type === 'open-evening') {
    return {
      type: 'evening',
      guideDate: action.guideDate,
      originId: action.originId,
    };
  }
  if (action.type === 'close') return null;
  throw new Error(`未知面板操作：${action.type}`);
}
