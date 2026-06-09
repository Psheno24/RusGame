/** Кнопки «скоро» доступны только тестовому аккаунту. */
export function testOnlyLocked(isTest: boolean, testOnly?: boolean): boolean {
  return Boolean(testOnly) && !isTest;
}

export function testOnlyGridHint(
  isTest: boolean,
  testOnly?: boolean,
  hint?: string,
): string | undefined {
  if (testOnlyLocked(isTest, testOnly)) return "Скоро";
  if (testOnly && isTest) return "Тест";
  return hint;
}
