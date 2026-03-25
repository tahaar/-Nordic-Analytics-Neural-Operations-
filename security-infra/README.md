# Security Infra

Tämä hakemisto sisältää turva-Terraformin, jota EI ajeta pipelineissa.

Ajetaan vain manuaalisesti: terraform init/plan/apply.

## Aloita tästä: luo ensin turvasubi

Pidä malli yksinkertaisena:
1. Luo erillinen security-painotteinen subscription, jos mahdollista.
2. Jos erillistä subia ei ole, tee vähintään erillinen security-RG ja rajattu omistajuus.
3. Lisää tänne guardrailit ennen kuin alat avata applikaatiota internetiin.

Miksi tämä ensin:
- kill switch ei ole kiinni normaalissa applikaatiodeployssa
- budjettihälytykset eivät ole riippuvaisia applikaatiosta
- containment onnistuu vaikka app-subissa olisi ongelma

## Mitä turvasubiin kannattaa laittaa ensin

Minimipaketti:
- budjetti ja kustannushälytykset
- kill switch -toimintatapa
- operointiohje kuka pysäyttää, mistä, ja milloin
- tarvittaessa lukitus / ReadOnly containment -malli

Kun tämä on tehty, vasta sitten app-subi:
- ACR
- Container Apps environment
- frontend/backend Container Appit
- tfstate-storage

## Yksinkertainen käytännön etenemisjärjestys

1. Turvasubi tai security-hallintakerros
2. Budget- ja cost-alertit
3. Kill switch -runbook
4. App-subi ja app-RG
5. tfstate backend
6. ACR + Container Apps
7. GitHub OIDC
8. Ensimmäinen deploy

## Mitä EI pidä tallentaa repositoryyn

- oikeita `.env`-tiedostoja
- ACR-salasanoja
- Azure access tokeneita
- JWT-esimerkkitokeneita oikeasta ympäristöstä
- Gemini API -avaimia
- terraform state dumppeja

Tämän repon tarkoitus on pysyä turvallisena deployata niin, että kaikki sensitiivinen data tulee GitHub Secretsin tai Azure-secrettien kautta.

## Sisältää

- **subscription-app**: sovellus-subin tagitus ja metadata
- **resource-groups**: RG:t sovellus-subiin
- **kill-switch**: skaalaa kontit nollaan ja asettaa subin ReadOnly-tilaan
- **cost-and-security-guard**: kustannusrajat ja haitallisten konttien hälytykset

## Suositeltu sijoittelu

- App-workloadit elävät sovellussubissa.
- Security- ja guardrail-logiikka kannattaa pitää erillisessä security-painotteisessa hallintakerroksessa tai vähintään selkeästi erotettuna omana stackinaan.
- Ajatus on, että kill switchit, budjettivalvonta ja containment-toiminnot eivät ole kiinni sovelluksen normaalista deploy-polusta.

## Dokumentaatio

Dokumentaatio löytyy `docs/`-hakemistosta.