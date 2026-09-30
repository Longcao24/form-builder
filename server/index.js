import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const FORMS_FILE = path.join(DATA_DIR, 'forms.json');
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

fs.mkdirSync(DATA_DIR, { recursive: true });

const loadForms = () =>
  fs.existsSync(FORMS_FILE) ? JSON.parse(fs.readFileSync(FORMS_FILE, 'utf8')) : [];
const saveForms = (forms) => fs.writeFileSync(FORMS_FILE, JSON.stringify(forms, null, 2));
const csvPath = (id) => path.join(DATA_DIR, `${id}.csv`);

// Quote every cell so commas, quotes and newlines are safe.
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvRow = (cells) => cells.map(csvCell).join(',') + '\n';

const app = express();
app.use(express.json());

const requireAdmin = (req, res, next) => {
  if (req.get('x-admin-password') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong admin password' });
  }
  next();
};

// ---- Admin ----
app.post('/api/admin/login', requireAdmin, (req, res) => res.json({ ok: true }));

app.get('/api/admin/forms', requireAdmin, (req, res) => {
  const forms = loadForms().map((f) => {
    const file = csvPath(f.id);
    const rows = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length - 1
      : 0;
    return { ...f, responses: Math.max(rows, 0) };
  });
  res.json(forms);
});

app.post('/api/admin/forms', requireAdmin, (req, res) => {
  const { title, description = '', fields } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: 'Add at least one field' });
  }
  if (fields.some((f) => !f.label?.trim())) {
    return res.status(400).json({ error: 'Every field needs a label' });
  }

  const form = {
    id: crypto.randomBytes(4).toString('hex'),
    title: title.trim(),
    description: description.trim(),
    fields: fields.map((f) => ({
      id: crypto.randomBytes(4).toString('hex'),
      label: f.label.trim(),
      type: f.type || 'text',
      required: !!f.required,
      options: f.type === 'select' ? (f.options || []).filter(Boolean) : undefined,
    })),
    createdAt: new Date().toISOString(),
  };

  saveForms([...loadForms(), form]);
  fs.writeFileSync(csvPath(form.id), csvRow(['Submitted At', ...form.fields.map((f) => f.label)]));
  res.status(201).json(form);
});

app.delete('/api/admin/forms/:id', requireAdmin, (req, res) => {
  saveForms(loadForms().filter((f) => f.id !== req.params.id));
  fs.rmSync(csvPath(req.params.id), { force: true });
  res.json({ ok: true });
});

// Password comes as a query param so a plain link can trigger the download.
app.get('/api/admin/forms/:id/csv', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) return res.status(401).send('Unauthorized');
  const file = csvPath(req.params.id);
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.download(file, `form-${req.params.id}.csv`);
});

// ---- Public ----
app.get('/api/forms/:id', (req, res) => {
  const form = loadForms().find((f) => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found' });
  res.json(form);
});

app.post('/api/forms/:id/submit', (req, res) => {
  const form = loadForms().find((f) => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const answers = req.body || {};
  const missing = form.fields.filter((f) => f.required && !String(answers[f.id] ?? '').trim());
  if (missing.length) {
    return res.status(400).json({ error: `Required: ${missing.map((f) => f.label).join(', ')}` });
  }

  fs.appendFileSync(
    csvPath(form.id),
    csvRow([new Date().toISOString(), ...form.fields.map((f) => answers[f.id] ?? '')])
  );
  res.json({ ok: true });
});

// Serve the built React app in production (npm run build && npm start).
const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
