import { useEffect, useState } from 'react';

import { MOBILE } from './theme';

/** 订阅媒体查询，用法和 CSS 的 @media 一致，但结果能拿到 JS 里做布局分支。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery(`(max-width: ${MOBILE}px)`);
