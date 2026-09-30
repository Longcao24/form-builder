import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.describe.configure({ mode: 'serial' });

const TITLE = 'Khảo sát E2E';
let formLink;

async function login(page, password = 'admin') {
  await page.goto('/');
  await page.getByPlaceholder('Admin password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('wrong admin password is rejected', async ({ page }) => {
  await login(page, 'wrong');
  await expect(page.getByText('Wrong admin password')).toBeVisible();
  await expect(page.getByText('Create a new form')).toBeHidden();
});

test('admin creates a form with text and multiple choice', async ({ page }) => {
  await login(page);
  await expect(page.getByText('No forms yet.')).toBeVisible();

  // Only the two supported field types are offered.
  const typeSelect = page.locator('.field-editor select').first();
  await expect(typeSelect.locator('option')).toHaveText(['Text', 'Multiple choice']);

  await page.getByPlaceholder('Form title').fill(TITLE);
  await page.getByPlaceholder('Question / label').first().fill('Họ tên');
  await page.getByLabel('Required').first().check();

  await page.getByRole('button', { name: '+ Add field' }).click();
  await page.getByPlaceholder('Question / label').nth(1).fill('Màu yêu thích');
  await page.locator('.field-editor select').nth(1).selectOption('select');
  await page.getByPlaceholder(/Choices, comma separated/).fill('Đỏ, Xanh, Vàng');
  await page.getByLabel('Required').nth(1).check();

  await page.getByRole('button', { name: 'Create form' }).click();

  const row = page.locator('.form-row', { hasText: TITLE });
  await expect(row).toContainText('2 fields · 0 responses');
  formLink = await row.locator('a[target="_blank"]').getAttribute('href');
  expect(formLink).toMatch(/\/#\/form\/[0-9a-f]+$/);
});

test('form definition is saved to forms.json', () => {
  const forms = JSON.parse(fs.readFileSync('e2e/test-data/forms.json', 'utf8'));
  const form = forms.find((f) => f.title === TITLE);
  expect(form.fields.map((f) => [f.label, f.type, f.required])).toEqual([
    ['Họ tên', 'text', true],
    ['Màu yêu thích', 'select', true],
  ]);
  expect(form.fields[1].options).toEqual(['Đỏ', 'Xanh', 'Vàng']);
});

test('visitor fills the form and submits', async ({ page }) => {
  await page.goto(formLink);
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();

  // Required fields block submission.
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Thank you!')).toBeHidden();

  await page.locator('.field input[type="text"]').fill('Nguyễn Văn "A", Jr.');
  await expect(page.getByRole('radio')).toHaveCount(3);
  await page.getByRole('radio', { name: 'Xanh' }).check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Thank you!')).toBeVisible();

  // Second response.
  await page.getByRole('button', { name: 'Submit another response' }).click();
  await page.locator('.field input[type="text"]').fill('Trần B');
  await page.getByRole('radio', { name: 'Đỏ' }).check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Thank you!')).toBeVisible();
});

test('admin sees responses and downloads the CSV', async ({ page }) => {
  await login(page);
  const row = page.locator('.form-row', { hasText: TITLE });
  await expect(row).toContainText('2 responses');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByRole('link', { name: 'Download CSV' }).click(),
  ]);
  const csv = fs.readFileSync(await download.path(), 'utf8').trim().split('\n');
  expect(csv[0]).toBe('"Submitted At","Họ tên","Màu yêu thích"');
  expect(csv[1]).toMatch(/^"\d{4}-\d\d-\d\dT[^"]+","Nguyễn Văn ""A"", Jr\.","Xanh"$/);
  expect(csv[2]).toMatch(/,"Trần B","Đỏ"$/);
});

test('unknown form link shows not found', async ({ page }) => {
  await page.goto('/#/form/doesnotexist');
  await expect(page.getByText('Form not found')).toBeVisible();
});

test('admin deletes the form', async ({ page }) => {
  await login(page);
  page.on('dialog', (d) => d.accept());
  await page.locator('.form-row', { hasText: TITLE }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No forms yet.')).toBeVisible();
  expect(fs.readdirSync('e2e/test-data').filter((f) => f.endsWith('.csv'))).toEqual([]);
});
