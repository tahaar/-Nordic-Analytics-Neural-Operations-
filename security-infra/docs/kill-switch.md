# Kill Switch

## Purpose
Fast containment control when there is security or cost risk.

## Trigger examples
- Suspected compromise
- Runaway scaling or restart storm
- Severe budget anomaly

## High-level effect
- Scale workloads down to zero
- Restrict mutation operations where configured

## Operational rule
Use kill switch as containment, not as root-cause fix. Always follow with investigation and controlled recovery.

## Alert-triggered usage
- Kill switch can be invoked as the operational response to platform alerts.
- Typical triggers:
	- budget anomaly or unexpected spend spike
	- restart storm
	- sudden 5xx spike combined with suspicious runtime behavior
- Recommended pattern:
	1. alert fires
	2. human confirms signal quality
	3. kill switch is executed
	4. workloads are contained before deeper analysis
