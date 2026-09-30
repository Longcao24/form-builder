# Form Builder

React (Vite) + Express. The admin creates forms, anyone with the link fills them in, and every submission is appended to a CSV file.

## Run

```bash
npm install
npm run dev          # http://localhost:5173  (API on :3001)
```

Production: `npm run build && npm start` serves everything on http://localhost:3001.

- Admin page: `/` (default password `admin`; change with `ADMIN_PASSWORD=secret npm start`)
- Public form: `/#/form/<id>` (copy the link from the admin page)
- Data: `data/forms.json` (form definitions), `data/<formId>.csv` (responses)
