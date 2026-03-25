# Security Infra

Tämä hakemisto sisältää turva-Terraformin, jota EI ajeta pipelineissa.

Ajetaan vain manuaalisesti: terraform init/plan/apply.

## Ennen ajoa: aktivoi tarvittava Azure-oikeus PIM:llä

Suositeltu malli:
- `security-infra/` ajetaan ihmisoperaattorilla, ei GitHub-pipelinella.
- Korotettu Azure-oikeus aktivoidaan vain rajatuksi ajaksi PIM:llä ennen `terraform apply`:ta.

Käytännössä:
1. Avaa Azure Portal -> Entra ID -> Privileged Identity Management.
2. Avaa `My roles`.
3. Etsi security-stackin ajamiseen tarvittava rooli oikeassa scopessa.
4. Aktivoi rooli, lisää perustelu ja lyhyt kesto.
5. Suorita vasta sen jälkeen `terraform init/plan/apply`.

Jos käytätte erillistä security-subia, aktivoi rooli juuri siihen subscriptioniin tai sen hallittuun scopeen.
Jos käytätte erillistä security-RG:tä, aktivoi rooli siihen RG-scopeen mahdollisimman kapeasti.

Tarkempi identiteetti-, OIDC- ja PIM-runbook löytyy tiedostosta `docs/infra.md`.

## Manuaalinen ajo

Dev-esimerkki:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/dev/main.tfvars
terraform apply -var-file=envs/dev/main.tfvars
```

Prod-esimerkki:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/prod/main.tfvars
terraform apply -var-file=envs/prod/main.tfvars
```

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