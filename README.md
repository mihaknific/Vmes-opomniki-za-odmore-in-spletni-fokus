# Vmes: opomniki za odmore in spletni fokus 0.9.2

**Firefoxova razširitev za opomnike, časovne omejitve in blokiranje spletnih strani.** Načrtujte odmore za oči, pitje vode ali raztezanje ter omejite čas na izbranih domenah ali jih blokirajte za več fokusa. Čas se meri samo v aktivnem zavihku. Brez računa, sledenja ali oddaljenih strežnikov; podatki ostanejo lokalno v Firefoxu.

## Kaj je v 0.9.2

- prvi odštevalnik privzetega opomnika se ujema z izbranim intervalom: 10, 20 oziroma 5 minut
- obstoječi privzeti opomniki se ob nadgradnji varno popravijo; uporabniški opomniki ostanejo nedotaknjeni
- sistemska obvestila uporabljajo ikono in besedilo posameznega opomnika
- predloge opomnikov lahko samodejno izmenjujejo izvirna tematska sporočila; uporabnik lahko namesto tega nastavi svoje stalno besedilo
- gumb »Odpri izbrano« v uvodnem zaslonu odpre nastavitve v istem zavihku in napako jasno prikaže
- Firefox za Android uporablja zavihke za okna opomnikov in sledenje aktivnemu zavihku, ker nima namiznega API-ja `windows`
- napačno stanje dodatka v popupu ne prikazuje več lažnih vzorčnih opomnikov

## Vključeno iz različice 0.9.1

- 3-koračni wizard za ustvarjanje in urejanje opomnikov
- intervalni, enkratni, dnevni, tedenski in spletno specifični opomniki
- privzeti intervali: oči 10 minut, razteg 20 minut, voda 5 minut
- dnevne časovne omejitve in stroga blokada izbranih spletnih strani
- dejanski izračun naslednjega opomnika v popupu
- robustnejši scheduler: ponavljajoči se opomniki se po proženju znova nastavijo
- `Snooze`, `Zaključeno`, `Zaprtje` in zapis dogodkov v zgodovino
- sistemsko obvestilo, obvestilo na strani, ločeno okno, kombinacije kanalov
- neobvezen zvok za lastna obvestila
- tematsko izbrane ikone za nove predloge opomnikov; ikono lahko uporabnik kadarkoli spremeni
- lokalna zbirka SVG ikon, vključno z izbranimi ikonami odprtokodnega projekta Lucide
- lokalni zvočni vzorci CC0 in dodatni sintetizirani toni, z nastavljivo glasnostjo
- interaktivne vaje za oči (10 vaj z ilustracijami in diagrami)
- vodene vaje za telo (11 vaj z novimi ilustracijami, razdeljenih po sklopih)
- vodena dihalna vaja (škatlasto dihanje, 4-7-8, enakomerno)
- nastavitve dihalne vaje, ki jih je mogoče izvoziti in uvoziti kot lokalno JSON-datoteko za prenos med napravami
- `Ne moti` z možnostjo preskoka ali prikaza ob koncu tihega časa
- aktivni site-time: šteje samo aktivni zavihek v osredotočenem Firefoxovem oknu
- site-time dovoljenja po domenah pri spletno specifičnih opomnikih
- lokalna pravila fokusa za izbrane spletne domene
- spremljanja ni mogoče izključiti, dokler so aktivni spletni opomniki ali dnevne časovne omejitve, ki so od njega odvisni
- statistika prikazov, zaključkov, Snooze, zaprtij in aktivnega časa
- 14-dnevna lokalna statistika site-time
- privzeta zelena tema Vmes, druge barvne sheme, črno-beli načini ter prilagodljiva pisava in velikost besedila; uporabnik lahko dodatno prilagodi šest osnovnih barv, ki se uporabijo tudi v popupu in vajah
- onboarding ob prvi namestitvi
- GitHub Pages predstavitvena stran
- brez runtime knjižnic, CDN-jev ali omrežnih zahtev v razširitvi

Izbrane SVG-ikone Lucide, zvočni vzorci Kenney UI SFX (CC0) in pisava Google Sans (SIL OFL 1.1) so vključeni lokalno; licenčna obvestila so v `extension/THIRD_PARTY_NOTICES.txt`, `extension/sounds/LICENSE.txt` in `extension/fonts/OFL.txt`. Dodatni tonski signali se ustvarijo lokalno z Web Audio API.

## Arhitektura

```text
vmes/
├── extension/                 # Firefox WebExtension
│   ├── manifest.json
│   ├── background.js
│   ├── lib/                    # skupna logika, videz, ikone in zvok
│   ├── popup/                  # nadzorna plošča v orodni vrstici
│   ├── options/                # upravljanje in nastavitve
│   ├── onboarding/             # uvodni čarovnik
│   ├── notification/           # namensko okno obvestila
│   ├── content/                # obvestilo na strani
│   └── exercises/              # blokirana stran ter vaje
├── scripts/                    # preverjanje, testi in pakiranje
├── package.json
├── DEVELOPMENT.md
├── README.md
└── LICENSE
```

Javno spletno mesto je ena stran, ki povezuje vaje, namestitev in podrobnosti dodatka. Dve pristni sliki vmesnika prikazujeta pojavno okno in obrazec za omejitev spletne strani; podatki na slikah so vzorčni. Trenutna javna stran se gradi iz `extension/index.html`. Prejšnja različica predstavitvene strani je shranjena lokalno v `.local/website-reference/` samo za osebno referenco in ni del testov, spletne objave ali paketa dodatka. Podrobnosti o straneh, podatkovnem toku, dovoljenjih in pakiranju so v `ARCHITECTURE.md`.

## UX

```text
Install
  ↓
Onboarding
  ↓
Popup
  ├─ naslednji opomnik
  ├─ aktivni opomniki
  ├─ hiter pregled trenutne strani
  └─ upravljanje / statistika / nastavitve

Nov opomnik
  1. Osnova
  2. Kdaj
  3. Obvestilo

Obvestilo
  ├─ Zaključeno
  ├─ Snooze
  └─ Zapri
```

## Site-time: natančna definicija

Vmes uporablja definicijo **aktivne seje**:

- šteje samo trenutni aktivni zavihek v trenutno osredotočenem Firefoxovem oknu;
- čas se ustavi, ko uporabnik zamenja domeno, zapusti fokus Firefoxovega okna ali zapre zavihek;
- čas se beleži za domeno z aktivnim spletnim opomnikom ali pravilom fokusa, ne za nepovezane domene;
- po prikazu spletnega opomnika je možno merilnik ponastaviti, kar omogoča ponavljajoče se nudges v isti seji.

To prepreči, da bi Vmes napačno štel čas, ko Firefox teče v ozadju.

## Dovoljenja in zasebnost

Osnovni časovni in urni opomniki ne potrebujejo dostopa do spletnih strani.

Spletno specifični opomnik zahteva host permission samo za svojo domeno. Obvestilo »na strani« kot splošni kanal lahko zahteva širši host access, ker mora biti mogoče prikazati UI na poljubni spletni strani, kjer uporabnik ta kanal izbere.

Podatki se shranjujejo v `browser.storage.local`. Razširitev v tej različici nima računa, analitike, oglasov ali zunanjega API-ja.

## Firefox arhitektura

Projekt uporablja Firefoxov `background.scripts` pristop z nepermanentnim background dokumentom. Scheduler uporablja `browser.alarms`; ker alarmi ne preživijo ponovnega zagona brskalnika, se po `onStartup` ponovno ustvarijo. To je razlog, da razširitev ne temelji na `setInterval()` v background procesu.

## Lokalni preizkus

1. Firefox → `about:debugging`
2. **This Firefox**
3. **Load Temporary Add-on…**
4. izberite `extension/manifest.json`

## Samostojna stran Vmes

Vmes je skupna spletna stran za Firefoxov dodatek in vodene vaje. Zgradite statično spletno mesto z:

```bash
npm run build:vmes
```

Izhod je v `dist/vmes-site/`. Vaje imajo čiste, neposredne poti:

- `/dihanje/`
- `/oci/`
- `/gibanje/`
- `/` za skupno predstavitev, vaje in podrobnosti Firefoxovega dodatka
- `/dodatek/` kot združljiv preusmeritveni naslov na razdelek za namestitev

Vsaka vaja je samostojna statična stran z lastno datoteko `index.html`; navigacija uporablja običajne povezave. History API ali odjemalsko usmerjanje zato nista potrebna, neposredni obisk in osvežitev podstrani pa delujeta brez preusmeritvenih pravil. Pakiranje Firefoxove razširitve ohrani ta izhod.

Za lokalni ogled strani in preverjanje povezav zaženite:

```bash
npm run serve:vmes
```

Ukaz zgradi stran in zažene lokalni strežnik na `http://127.0.0.1:4173/`. Stran odprite prek tega naslova; pri odpiranju datoteke `index.html` z `file://` brskalnik čistih poti, kot je `/dihanje/`, ne obravnava kot spletni strežnik in jih zato ne more zanesljivo odpreti.

Dihalne nastavitve se privzeto shranjujejo v lokalnem brskalniku. Za prenos med napravami uporabite v dihalni vaji možnost **Nastavitve → Prenos nastavitev** in prenesite izvoženo JSON-datoteko v drugo napravo. Uvoz zamenja samo nastavitve dihalne vaje po izrecni potrditvi; podatki se ne pošiljajo na strežnik.

Za statične preveritve:

```bash
npm test
```

ali neposredno:

```bash
node scripts/validate.mjs
```

## GitHub Pages

GitHub Pages je objavljen na <https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/>. Workflow `.github/workflows/publish-vmes-site.yml` objavi izhod `dist/vmes-site/` ob pushu na `main` ali ročno iz zavihka Actions. V nastavitvah repozitorija nastavite **Pages → Build and deployment → Source: GitHub Actions**. Workflow izvede teste, zgradi spletno mesto in objavi statični izhod.

Skupni vir barvnih tem dodatka in spletnih vaj je `extension/lib/appearance.css`. Strani dodatka poleg tega z `extension/lib/appearance.js` uporabijo shranjeno uporabniško temo. Javna GitHub Pages uporablja isti privzeti zeleni videz, vendar ne more brati osebnih nastavitev Firefoxovega dodatka. Dihalna vaja ohrani svoj lasten izbirnik videza, ker je to ločena uporabniška nastavitev.

Pri privzetem naslovu projekta bo oblika približno `https://uporabnik.github.io/ime-repozitorija/`, vaje pa bodo na primer `/ime-repozitorija/dihanje/`. Lastna domena omogoča krajše povezave, na primer `https://vmes.si/dihanje/`. Za te statične poti History API ni potreben.

Vsi podatki o dodatku so na skupni naslovnici; `/dodatek/` preusmeri na njen razdelek za namestitev. Namestitveni gumbi vodijo na Mozilla Add-ons oziroma do zadnje priponke v GitHub Releases. Pred javno objavo preverite, da je AMO listing na naslovu `https://addons.mozilla.org/en-US/firefox/addon/spletni-opomnik/` objavljen in pravilen.

Gumba za namestitev na Mozilla Add-ons trenutno kažeta na naslov `https://addons.mozilla.org/en-US/firefox/addon/spletni-opomnik/`. Pred javno objavo preverite, da je listing na tem naslovu objavljen in pravilen.

Vmesova naslovnica združuje tri vaje in predstavitev Firefoxovega dodatka na eni strani.

## Mozilla Add-ons pred javno objavo

Pred oddajo preverite predvsem:

- končni Gecko ID;
- končno javno homepage URL povezavo;
- screenshots in icon assets;
- privacy disclosure, če bi bile v prihodnosti dodane funkcije, ki zbirajo podatke;
- realno testiranje native notifications na Windows, macOS in Linux;
- restricted/special pages;
- site permission flow na novi namestitvi;
- restart, sleep/wake, timezone in DST;
- več odprtih oken in fokus preklapljanja;
- accessibility/keyboard navigacijo.

## Projektna dokumentacija

- [ARCHITECTURE.md](./ARCHITECTURE.md) — razporeditev komponent in podatkovni tok.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — lokalni razvoj in testiranje.
- [TEST_PLAN.md](./TEST_PLAN.md) — ročni preizkus v Firefoxu.
- [QUALITY_GATE.md](./QUALITY_GATE.md) — kratek pregled pred izdajo.
- [PRIVACY.md](./PRIVACY.md) in [SECURITY.md](./SECURITY.md) — zasebnost in varnostne zasnove.
- [AMO_SUBMISSION.md](./AMO_SUBMISSION.md) — dovoljenja in priprava oddaje v Mozilla Add-ons.
- [STORE_LISTING.md](./STORE_LISTING.md) / [STORE_LISTING_EN.md](./STORE_LISTING_EN.md) — osnutka opisa za trgovino.
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) — spremembe izdaje.
