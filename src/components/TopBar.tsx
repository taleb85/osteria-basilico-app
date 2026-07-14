import { memo } from 'react';

const TopBar = memo(function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-end px-4 pt-safe" aria-hidden="true" />
  );
});

export default TopBar;
