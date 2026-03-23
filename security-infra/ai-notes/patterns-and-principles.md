# Patterns and Principles

Hyvät koodauskäytännöt ovat tärkein periaate.

## Sääntö 100
- Funktiot < 20 riviä
- Tiedostot < 100 riviä

## Tässä projektissa
- Maksimi tiedostopituus 300–450 riviä, jotta koodi on helposti siirrettävissä Copilotille.
- Ei any-tyyppiä.
- Zod-validointi kaikelle ulkoa tulevalle datalle.
- Dependency Injection backendissä.
- Kommentoi vain "miksi", ei "mitä".

## Jokaisen muutoksen jälkeen
- Tarkista syntaksi
- Päivitä dokumentaatio

**Huomio:** Rivimäärä SAA ylittyä jos koodi on loogista! Eli yhtä asiaa kuitenkin per tiedosto mutta älä myöskään pilko tiedostoja pilkkomisen huvista!