import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that returns a function to check if the component is currently mounted.
 * Useful for preventing state updates on unmounted components in async operations.
 *
 * @returns {() => boolean} A function that returns true if the component is mounted, false otherwise.
 *
 * @example
 * const isMounted = useIsMounted();
 *
 * useEffect(() => {
 *   someAsyncOperation().then(data => {
 *     if (isMounted()) {
 *       setState(data);
 *     }
 *   });
 * }, []);
 */
export const useIsMounted = (): (() => boolean) => {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
};
