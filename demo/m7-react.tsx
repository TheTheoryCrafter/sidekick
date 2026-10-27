// A small React app shaped like theorycrafter.com: StrictMode, client-side
// routes, a profile dropdown that controls the pet, and tools that emit events.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sidekick, useSidekick } from '../src/react';
import creamCat from '../src/pets/cream-cat';

const ROUTES = ['/', '/theories', '/crafts', '/about'];

function useRoute(): [string, (to: string) => void] {
  const read = () => new URLSearchParams(location.search).get('route') ?? '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onPop = () => setRoute(read());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const go = (to: string) => {
    history.pushState({}, '', `${location.pathname}?route=${to}`);
    setRoute(to);
  };
  return [route, go];
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const pet = useSidekick();
  return (
    <>
      <button className="avatar" onClick={() => setOpen(!open)} aria-expanded={open}>S</button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="label">shrikar@example.com</div>
          <label className="item">
            <span>Website pet</span>
            <input type="checkbox" checked={pet.enabled} disabled={!pet.ready} onChange={pet.toggle} />
          </label>
          <label className="item">
            <span>Pet</span>
            <select value={pet.pet ?? ''} disabled={!pet.ready || !pet.enabled} onChange={(e) => void pet.setPet(e.target.value)}>
              {pet.pets.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="item">Log out</div>
        </div>
      )}
    </>
  );
}

function ToolPage() {
  const { emit } = useSidekick();
  const [busy, setBusy] = useState(false);
  const run = (fail: boolean) => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      emit(fail ? 'error' : 'tool-completed');
    }, 600);
  };
  return (
    <div className="card">
      <h2>A craft tool</h2>
      <p>Pretend this generates a fuel bill. When it finishes, the site calls <code>emit('tool-completed')</code>; on failure <code>emit('error')</code>.</p>
      <button disabled={busy} onClick={() => run(false)}>{busy ? 'Working…' : 'Generate'}</button>
      <button disabled={busy} onClick={() => run(true)}>Generate (fails)</button>
    </div>
  );
}

function App() {
  const [route, go] = useRoute();
  return (
    <>
      {/* Once, outside the routes: survives navigation. */}
      <Sidekick pets={[creamCat, 'box-cat']} petUrls={{ 'box-cat': '/demo/pets/box-cat/' }} storageKey="sidekick:m7-react" />
      <nav className="nav">
        {ROUTES.map((r) => (
          <a key={r} className={r === route ? 'active' : ''} onClick={() => go(r)}>{r === '/' ? 'Home' : r.slice(1)}</a>
        ))}
        <span className="spacer" />
        <ProfileMenu />
      </nav>
      <main>
        <h1>{route === '/' ? 'Home' : route.slice(1)}</h1>
        <p className="note">React {`18`} StrictMode · the pet is mounted once in &lt;App&gt; and controlled from the avatar menu.</p>
        {route === '/crafts' ? <ToolPage /> : (
          <div className="card"><h2>Page {route}</h2><p>Switch routes in the top bar: the cat stays, looks around, and nothing is re-created.</p></div>
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
