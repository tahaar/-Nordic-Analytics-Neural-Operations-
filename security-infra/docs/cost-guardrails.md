# Cost Guardrails

## Objective
Keep monthly spend predictable for hobby-scale operation.

## Guardrails
- Budget thresholds with notifications
- Alerting for unusual scaling/restart behavior
- Manual review before increasing resource limits

## Suggested thresholds
- 50% budget: informational alert
- 80% budget: warning alert
- 95% budget: critical alert + immediate review

## Example response
If budget usage jumps from expected trend:
1. Check deployment history
2. Check autoscale and restarts
3. Validate traffic source
4. Apply temporary limit or kill-switch if needed
