# Security Infra

Tämä hakemisto sisältää turva-Terraformin, jota EI ajeta pipelineissa.

Ajetaan vain manuaalisesti: terraform init/plan/apply.

## Sisältää

- **subscription-app**: sovellus-subin tagitus ja metadata
- **resource-groups**: RG:t sovellus-subiin
- **kill-switch**: skaalaa kontit nollaan ja asettaa subin ReadOnly-tilaan
- **cost-and-security-guard**: kustannusrajat ja haitallisten konttien hälytykset

## Dokumentaatio

Dokumentaatio löytyy `docs/`-hakemistosta.