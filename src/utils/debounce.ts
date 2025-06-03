export interface DebouncedFunction<A extends unknown[]> {
  (...args: A): void;
  cancel: () => void;
}

export function debounce<A extends unknown[], R>(
  func: (...args: A) => R,
  wait: number
): DebouncedFunction<A> {
  let timeout: NodeJS.Timeout | null = null;

  const debounced: DebouncedFunction<A> = (...args: A) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
