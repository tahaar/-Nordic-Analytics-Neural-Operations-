# Security Architecture

## Scope
This layer protects the Azure subscription and runtime platform, not app business logic.

## Main controls
- Resource organization and tagging
- Kill switch for emergency containment
- Cost and security guard rails
- Monitoring and alerting wiring

## Design principle
Security infra is intentionally run manually (`terraform init/plan/apply`) to avoid accidental destructive automation.

## Example emergency pattern
1. Detect suspicious runtime behavior.
2. Trigger kill switch procedure.
3. Scale app workloads to zero and restrict write operations.
4. Investigate and recover in controlled steps.
