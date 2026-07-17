# OptiLoop Use Cases

## 1. Customer-support agent

A support agent reads a customer message, retrieves account details, drafts a response, and updates
the support ticket.

- **Optimization:** route classification and response drafting to a cheaper model.
- **Policy:** keep steps containing customer PII on the approved private model.
- **Eval gate:** verify the answer follows support policy, includes the correct resolution, and does
  not expose private account data.
- **Outcome:** ship the cheaper route only when every support eval still passes.

## 2. Coding agent

A coding agent reads an issue, searches a repository, edits files, and runs verification commands.

- **Optimization:** use cheaper models for repository search and routine edits while reserving the
  stronger model for planning or difficult changes.
- **Policy:** prevent secrets and proprietary source code from being sent to disallowed providers.
- **Eval gate:** run the project's tests and confirm the requested behavior works without regressions.
- **Outcome:** keep the optimized agent when tests pass; otherwise restore the original model route.

## 3. Document-processing agent

A document agent extracts fields from invoices, validates them, and sends approved records to an
accounting system.

- **Optimization:** route document classification and standard field extraction to a cheaper model.
- **Policy:** keep bank details, tax identifiers, and employee information on an approved model.
- **Eval gate:** compare extracted fields with expected values and reject missing, altered, or
  incorrectly formatted financial data.
- **Outcome:** lower processing cost without allowing incorrect records into the accounting system.
