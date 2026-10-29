// Structural checks on the exported workflows: importable, wired, guarded, secret-free.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'workflows');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const validator = fs.readFileSync(path.join(__dirname, '..', 'shared', 'validate.js'), 'utf8');

test('five workflows export with stable ids', () => {
  assert.deepEqual(files, ['01-invoice-intake.json', '02-erp-booking.json', '03-erp-retry.json', '04-review-decision.json', '05-error-handler.json']);
  for (const f of files) assert.match(load(f).id, /^Inv[A-Za-z0-9]{14}$/);
});

test('every connection targets an existing node', () => {
  for (const f of files) {
    const wf = load(f); const names = new Set(wf.nodes.map((n) => n.name));
    for (const [from, kinds] of Object.entries(wf.connections)) {
      assert.ok(names.has(from), `${f}: ${from}`);
      for (const outs of Object.values(kinds)) for (const b of outs) for (const c of b) assert.ok(names.has(c.node), `${f}: ${from} → ${c.node}`);
    }
  }
});

test('all operational workflows route failures to the error handler', () => {
  for (const f of files.filter((x) => !x.includes('error-handler'))) assert.equal(load(f).settings.errorWorkflow, 'InvErrorHandler01', f);
});

test('the validator embedded in n8n is byte-identical to shared/validate.js (and to the app copy)', () => {
  const core = validator.split("if (typeof module !== 'undefined')")[0];
  for (const f of ['01-invoice-intake.json', '04-review-decision.json']) {
    const code = load(f).nodes.find((n) => n.type === 'n8n-nodes-base.code' && /validateInvoice\(/.test(n.parameters.jsCode)).parameters.jsCode;
    assert.ok(code.startsWith(core), `${f}: Validate node drifted from shared/validate.js (run npm run build)`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'app', 'validate.js'), 'utf8'), validator, 'app/validate.js drifted (run scripts/setup.sh)');
});

test('ERP writes happen only in the ERP Booking workflow, and only via parameterised queries', () => {
  for (const f of files) {
    const wf = load(f);
    for (const n of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.postgres')) {
      const q = n.parameters.query;
      if (/insert into erp_invoices/i.test(q)) assert.equal(f, '02-erp-booking.json', `${f}: ${n.name} writes to the ERP`);
      if (/\$\d/.test(q)) assert.ok(n.parameters.options.queryReplacement, `${f}: ${n.name} uses placeholders without parameters`);
      assert.doesNotMatch(q, /\{\{/, `${f}: ${n.name} interpolates expressions into SQL`);
    }
  }
});

test('no credentials or secrets in the exports', () => {
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(raw, /sk_[A-Za-z0-9]{10,}|"password"\s*:/);
    for (const n of load(f).nodes) assert.equal(n.credentials, undefined, `${f}: ${n.name}`);
  }
});
