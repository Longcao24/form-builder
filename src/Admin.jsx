import { useEffect, useState } from 'react';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'select', label: 'Multiple choice' },
];
const emptyField = () => ({ label: '', type: 'text', required: false, options: [] });

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('adminPw') || '');
  const [loggedIn, setLoggedIn] = useState(false);
  const [forms, setForms] = useState([]);
  const [error, setError] = useState('');

  const api = (url, opts = {}) =>
    fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      return data;
    });

  const loadForms = () => api('/api/admin/forms').then(setForms).catch((e) => setError(e.message));

  const login = async (e) => {
    e?.preventDefault();
    try {
      await api('/api/admin/login', { method: 'POST' });
      sessionStorage.setItem('adminPw', password);
      setLoggedIn(true);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (password) login();
  }, []);

  useEffect(() => {
    if (loggedIn) loadForms();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <form className="card" onSubmit={login}>
        <h1>Admin Login</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Log in</button>
      </form>
    );
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this form and all its responses?')) return;
    await api(`/api/admin/forms/${id}`, { method: 'DELETE' });
    loadForms();
  };

  const logout = () => {
    sessionStorage.removeItem('adminPw');
    setPassword('');
    setLoggedIn(false);
  };

  return (
    <>
      <div className="header">
        <h1>Form Builder</h1>
        <button className="secondary" onClick={logout}>Log out</button>
      </div>

      <FormCreator api={api} onCreated={loadForms} />

      <div className="card">
        <h2>Your forms</h2>
        {forms.length === 0 && <p className="muted">No forms yet.</p>}
        {forms.map((f) => {
          const link = `${window.location.origin}/#/form/${f.id}`;
          return (
            <div key={f.id} className="form-row">
              <div>
                <strong>{f.title}</strong>
                <div className="muted">
                  {f.fields.length} fields · {f.responses} responses
                </div>
                <a href={link} target="_blank" rel="noreferrer">{link}</a>
              </div>
              <div className="actions">
                <button className="secondary" onClick={() => navigator.clipboard.writeText(link)}>
                  Copy link
                </button>
                <a
                  className="button"
                  href={`/api/admin/forms/${f.id}/csv?password=${encodeURIComponent(password)}`}
                >
                  Download CSV
                </a>
                <button className="danger" onClick={() => remove(f.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FormCreator({ api, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([emptyField()]);
  const [error, setError] = useState('');

  const updateField = (i, patch) =>
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/forms', {
        method: 'POST',
        body: JSON.stringify({ title, description, fields }),
      });
      setTitle('');
      setDescription('');
      setFields([emptyField()]);
      setError('');
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Create a new form</h2>
      <input placeholder="Form title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <h3>Fields</h3>
      {fields.map((f, i) => (
        <div key={i} className="field-editor">
          <input
            placeholder="Question / label"
            value={f.label}
            onChange={(e) => updateField(i, { label: e.target.value })}
          />
          <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value })}>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="inline">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => updateField(i, { required: e.target.checked })}
            />
            Required
          </label>
          <button
            type="button"
            className="danger"
            disabled={fields.length === 1}
            onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
          >
            ✕
          </button>
          {f.type === 'select' && (
            <input
              className="full"
              placeholder="Choices, comma separated (e.g. Red, Green, Blue)"
              value={f.options.join(',')}
              onChange={(e) =>
                updateField(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })
              }
            />
          )}
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => setFields([...fields, emptyField()])}>
        + Add field
      </button>

      {error && <p className="error">{error}</p>}
      <button type="submit">Create form</button>
    </form>
  );
}
