import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, GraduationCap, LayoutDashboard, LogOut, Menu, School, ScrollText, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Shell() {
  const { admin, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Small screens: the menu closes after you pick a page, or press Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const link = (to: string, label: string, Icon: typeof School, end = false) => (
    <NavLink to={to} end={end}><Icon size={17} />{label}</NavLink>
  );
  return (
    <div className="shell">
      <aside className="rail" data-open={open}>
        <div className="rail-top">
          <div className="brand"><span className="brand-mark" />Sabino Control</div>
          <button className="menu-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="rail-body" onClick={() => setOpen((o) => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div className="rail-body" id="rail-body">
          <nav className="nav" aria-label="Main">
            {link('/', 'Overview', LayoutDashboard, true)}
            {link('/schools', 'Schools', School)}
            {link('/students', 'Students', GraduationCap)}
            {can('owner', 'admin') && link('/notifications', 'Notifications', Bell)}
            {can('owner', 'admin') && link('/audit', 'Audit log', ScrollText)}
            {can('owner') && link('/admins', 'Admins', ShieldCheck)}
            {link('/account', 'Account', UserRound)}
          </nav>
          <div className="rail-foot">
            <strong>{admin?.name}</strong>
            <span>{admin?.role}</span>
            <br />
            <button onClick={logout}><LogOut size={15} />Sign out</button>
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
