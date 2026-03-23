# Security Operations

## Normal cadence
- Review budget and anomaly alerts weekly.
- Review container platform health daily for active environments.
- Validate kill-switch readiness monthly.

## Incident quick flow
1. Confirm alert source and impact.
2. Decide if kill switch is required.
3. Contain first, analyze second.
4. Document timeline and recovery actions.

## Practical checks
- Are backend/frontend container images expected versions?
- Is 5xx rate elevated together with restart spikes?
- Are costs spiking unexpectedly compared to normal traffic?

## Post-incident notes
Always capture:
- Triggering symptom
- Immediate mitigation
- Root cause hypothesis
- Follow-up hardening task
