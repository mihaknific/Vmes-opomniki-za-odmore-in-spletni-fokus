# DEVELOPMENT.md

## Trenutni status: 0.9.2

V tej različici je cilj predvsem pravilno obnašanje in čist UX, ne maksimalno število funkcij.

### Scheduler

Vsak intervalni, enkratni in urni opomnik uporablja named alarm. Ponavljajoči se urni opomniki se po proženju znova izračunajo iz lokalnega časa, namesto da bi bili vezani na trajni interval. Ob restartu se alarmi ponovno ustvarijo.

### Site-time

Site-time ni globalni štopar za vse odprte zavihke. Obstaja ena aktivna seja za trenutno osredotočeno Firefoxovo okno. Ob menjavi taba, domene ali fokusa se seja flush-a v lokalno statistiko in konča.

### Permission model

- osnovni opomniki: brez host permission;
- spletni opomnik: request za konkretno domeno;
- in-page kanal: request za širši host access samo, ko ga uporabnik izbere.

### Notification channels

`system`, `inpage`, `window`, `both`, `all`.

Native system notification uporablja Firefoxov Notifications API. Lastna UI kanala (in-page in window) sta vizualno pod nadzorom projekta. Zvok je samo dodatna možnost za lastna kanala; native notification zvok je odvisen od OS/Firefox okolja.

### History semantics

Dogodki:

- `shown`
- `completed`
- `snoozed`
- `dismissed`
- `quiet-hours`
- `unavailable`
- `test`

To omogoča bolj smiselno statistiko kot preprosto štetje vseh vrstic v zgodovini.

### Testiranje

`npm test` preveri:

- sintakso vseh `.js` datotek;
- veljavnost `manifest.json`;
- obstoj lokalnih asset referenc;
- prisotnost obveznih map/datotek;
- konsistentnost verzije 0.9.2;
- ikone, zvočne prednastavitve in njihovo prisotnost v izbirniku.
- uvoz/izvoz dihalnih nastavitev, background integracijo ter gradnjo in poti statične strani.
- pravilne prve intervale, migracijo začetnih opomnikov, sistemske ikone in navigacijo uvodnega zaslona.

Predloge opomnikov uporabljajo tematske ikone. Če ima starejši uvožen opomnik izrecno shranjeno ikono, se ta ohrani; če ikone nima, se določi iz imena in sporočila. Ikono je vedno mogoče zamenjati v urejevalniku.

### Pred 1.0

Pred javno izdajo še ročno preveri:

- pravi AMO listing; AMO lahko določi končni Gecko ID;
- test matrix na Windows/macOS/Linux;
- testiranje DST in timezone edge caseov na dejanskem Firefoxu;
- native notifications, site permissions, časovne omejitve in blokado v Firefoxu;
- dostopnost in ozke zaslone.
