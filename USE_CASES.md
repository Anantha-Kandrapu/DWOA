# DWOA Use Cases

Each use case demonstrates the same contract: DWOA may reduce prompt tokens and tool calls, but
the optimized loop ships only when its task-specific evals pass.

## 1. Customer-support resolution agent

### Job

Read a support request, inspect the customer's account and recent orders, find the relevant policy,
draft a response, and update the ticket.

### Baseline waste

- The full support handbook is included in every step.
- Customer and ticket context is repeated in the planner, researcher, and writer prompts.
- The agent fetches the same account and order twice.
- It searches the policy tool once per candidate response.

### DWOA compilation

- Keep only the policy sections relevant to the detected issue.
- Replace repeated context with one shared, structured context block.
- Reuse identical read-only account, order, and policy results within the run.
- Preserve the final ticket update because it has a side effect.

### Safety constraints

- Never remove refund limits, escalation rules, or required disclosure text.
- Never merge or cache ticket-update calls.
- Keep customer PII inside approved tools and providers.

### Eval gate

- Correctly classify refund, delivery, cancellation, and account-access cases.
- Produce the expected resolution and required disclosure.
- Never reveal another customer's data.
- Perform exactly one final ticket update with the correct status.

### Demo proof

Show prompt tokens and read-only tool calls decreasing while the same support cases pass. Inject a
response missing a required disclosure to show automatic rejection and rollback.

## 2. Repository coding agent

### Job

Read an issue, inspect a repository, locate the responsible code, make the smallest change, and run
verification.

### Baseline waste

- Repository instructions and the issue are repeated before every model step.
- Large files are reread even when only one function is needed.
- The same search query and dependency metadata commands run multiple times.
- Broad test commands run after every edit.

### DWOA compilation

- Deduplicate repository instructions and issue context.
- Carry forward only referenced code excerpts instead of entire files.
- Merge identical searches and reuse read-only command output within the run.
- Run targeted verification after intermediate edits and the required full check before completion.

### Safety constraints

- Never remove write, migration, deployment, or version-control operations as duplicates.
- Never reuse tool output after a file it depends on has changed.
- Preserve security, testing, and repository instructions verbatim.

### Eval gate

- The requested behavior passes a focused regression check.
- Existing required checks still pass.
- The diff touches only necessary files.
- No secrets, generated files, or unrelated user changes are modified.

### Demo proof

Use a small bug-fix trace containing duplicate searches and file reads. Show fewer prompt tokens and
tool calls, the same final patch, and passing verification. Then inject a failing regression check
to demonstrate rollback.

## 3. Invoice-processing agent

### Job

Read an invoice, identify the vendor, extract financial fields, check for duplicates, validate the
purchase order, and submit an approved record to accounting.

### Baseline waste

- OCR text and extraction instructions are copied into every step.
- The vendor and purchase order are fetched repeatedly.
- Duplicate checks run once per extracted field instead of once per invoice.
- Accounting submission is retried without distinguishing an unknown result from a failed result.

### DWOA compilation

- Convert OCR output into one compact structured context.
- Keep only extraction rules relevant to the invoice type.
- Reuse vendor and purchase-order reads within the run.
- Merge field-level duplicate checks into one invoice-level query.
- Preserve accounting submission as a single auditable side effect.

### Safety constraints

- Never cache bank details, tax identifiers, or approval decisions across runs.
- Never merge, repeat, or remove accounting submissions.
- Preserve currency, tax, tolerance, and approval rules exactly.

### Eval gate

- Vendor, invoice number, date, currency, subtotal, tax, and total match expected values.
- Duplicate invoices are rejected.
- Purchase-order totals remain within the configured tolerance.
- Exactly one accounting submission occurs for an approved invoice and none for a rejected invoice.

### Demo proof

Show lower prompt tokens, fewer lookup calls, and reduced estimated latency on a batch of invoice
fixtures. Introduce an incorrect total to show that the optimized plan is blocked before submission.

## Shared success metrics

For every use case, compare:

- prompt tokens before and after;
- read-only tool calls removed or merged;
- side-effecting tool calls preserved;
- estimated latency and cost;
- eval pass rate;
- ship or rollback decision.
