import { useEffect, useState } from 'react';
import Admin from './Admin.jsx';
import FillForm from './FillForm.jsx';

// Tiny hash router: #/admin, #/form/<id>
function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const formMatch = hash.match(/^#\/form\/([\w-]+)/);

  return (
    <div className="container">
      {formMatch ? <FillForm formId={formMatch[1]} /> : <Admin />}
    </div>
  );
}
