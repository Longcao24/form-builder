import { useEffect, useState } from 'react';

export default function FillForm({ formId }) {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState('loading'); // loading | ready | submitted | notfound
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/forms/${formId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((f) => {
        setForm(f);
        setStatus('ready');
      })
      .catch(() => setStatus('notfound'));
  }, [formId]);

  const submit = async (e) => {
    e.preventDefault();
    const r = await fetch(`/api/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });
    const data = await r.json();
    if (!r.ok) return setError(data.error);
    setStatus('submitted');
  };

  if (status === 'loading') return <div className="card">Loading…</div>;
  if (status === 'notfound') return <div className="card"><h1>Form not found</h1></div>;
  if (status === 'submitted') {
    return (
      <div className="card">
        <h1>Thank you!</h1>
        <p>Your response has been recorded.</p>
        <button onClick={() => { setAnswers({}); setStatus('ready'); }}>Submit another response</button>
      </div>
    );
  }

  const set = (id, value) => setAnswers({ ...answers, [id]: value });

  return (
    <form className="card" onSubmit={submit}>
      <h1>{form.title}</h1>
      {form.description && <p className="muted">{form.description}</p>}

      {form.fields.map((f) => (
        <div key={f.id} className="field">
          <label>
            {f.label} {f.required && <span className="error">*</span>}
          </label>
          <Input field={f} value={answers[f.id] ?? ''} onChange={(v) => set(f.id, v)} />
        </div>
      ))}

      {error && <p className="error">{error}</p>}
      <button type="submit">Submit</button>
    </form>
  );
}

function Input({ field, value, onChange }) {
  const common = { required: field.required, value, onChange: (e) => onChange(e.target.value) };

  if (field.type === 'select') {
    return (
      <div className="choices">
        {field.options.map((o) => (
          <label key={o} className="inline">
            <input
              type="radio"
              name={field.id}
              value={o}
              required={field.required}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }
  return <input type="text" {...common} />;
}
