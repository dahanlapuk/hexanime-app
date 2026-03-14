import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { WatchOrder } from '../types';

interface NavbarProps {
  order: WatchOrder;
  onOrderChange: (o: WatchOrder) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function Navbar({ order, onOrderChange, searchQuery, onSearchChange }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center px-[4%] h-[68px] transition-all duration-400 ${scrolled ? 'bg-[#0f0f0fF8] shadow-[0_2px_20px_rgba(0,0,0,0.5)]' : 'bg-transparent'}`}>
      {/* Logo */}
      <Link to="/" className="font-display text-[2rem] tracking-[2px] text-accent uppercase mr-8 hover:opacity-90 transition-opacity">
        HEX<span className="text-text-primary">ANIME</span>
      </Link>

      {/* Nav links */}
      {isHome && (
        <div className="hidden md:flex gap-5">
          <a href="#library" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Library</a>
          <a href="#continue" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Lanjutkan</a>
        </div>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-4">
        {/* Search */}
        {isHome && (
          <div className="relative flex items-center">
            <button onClick={() => setSearchOpen(!searchOpen)} className="text-lg z-10 relative">🔍</button>
            <input
              type="text"
              placeholder="Cari series..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className={`absolute right-0 bg-black/75 border text-text-primary text-sm py-1.5 pl-9 pr-3 rounded transition-all duration-300 ${searchOpen ? 'w-[220px] opacity-100 border-[#555]' : 'w-0 opacity-0 border-transparent'}`}
            />
          </div>
        )}

        {/* Watch Order Toggle */}
        <div className="flex items-center bg-bg-surface rounded-full p-[3px] border border-[#333]">
          <button
            onClick={() => onOrderChange('tv')}
            className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${order === 'tv' ? 'bg-accent text-white' : ''}`}
          >
            📺 TV
          </button>
          <button
            onClick={() => onOrderChange('chronological')}
            className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${order === 'chronological' ? 'bg-accent text-white' : ''}`}
          >
            ⏳ Chrono
          </button>
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-[#ff6b6b] flex items-center justify-center font-bold text-xs">
          H
        </div>
      </div>
    </nav>
  );
}
