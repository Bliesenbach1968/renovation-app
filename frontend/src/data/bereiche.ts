export interface BereichNode {
  label: string;
  children?: BereichNode[];
}

/** Top-Level-Bereiche für Entkernung + Renovierung */
export const BEREICHE_ENTKERNUNG_RENOVIERUNG: string[] = [
  'I. Innenausbau / Innenräume',
  'II. Treppenhaus',
  'III. Außenanlage',
  'IV. Elektrik',
  'V. Heizung / Sanitär Allgemein',
  'VI. Dach',
  'VII. Fenster',
  'VIII. Fassade',
  'IX. Keller',
  'X. Balkone',
  'XI. Pauschale Kosten',
];

/** Vollständige Hierarchie: Top-Level → Sub-Ebenen */
export const BEREICHE_HIERARCHIE: Record<string, BereichNode[]> = {
  'I. Innenausbau / Innenräume': [
    {
      label: '1. Wände', children: [
        { label: 'a) Spachteln' },
        { label: 'b) Streichen' },
        { label: 'c) Tapeten' },
        {
          label: 'd) Trockenbauwände', children: [
            { label: 'da) Wandprofile' },
            { label: 'db) Rigipsplatten' },
          ],
        },
      ],
    },
    {
      label: '2. Decken', children: [
        { label: 'a) Spachteln' },
        { label: 'b) Streichen' },
        { label: 'c) Tapeten' },
        {
          label: 'd) Abhangdecken', children: [
            { label: 'da) Deckenprofile' },
            { label: 'db) Rigipsplatten' },
          ],
        },
      ],
    },
    {
      label: '3. Boden', children: [
        {
          label: 'a) Bodenbelag', children: [
            { label: 'aa) Fliesen' },
            { label: 'ab) Parkett' },
            { label: 'ac) Laminat' },
            { label: 'ad) Vinyl' },
          ],
        },
        { label: 'b) Estrich' },
        { label: 'c) Trittschalldämmung' },
        { label: 'd) Kleber' },
        { label: 'e) Fugenmaterial' },
        { label: 'f) Silikon' },
        { label: 'g) Sockelleisten' },
      ],
    },
    {
      label: '4. Badezimmer', children: [
        { label: 'a) Wasserleitung' },
        { label: 'b) Abwasserleitung' },
        {
          label: 'c) Toilette', children: [
            { label: 'ca) Toilettenspülkasten + Befestigung' },
            { label: 'cb) Toilette' },
            { label: 'cc) Drückerplatte' },
            { label: 'cd) WC-Anschlusset' },
            { label: 'ce) WC-Schallschutzset' },
            { label: 'cf) Toilettendeckel' },
          ],
        },
        {
          label: 'd) Baden', children: [
            { label: 'da) Badewanne + Befestigung' },
            { label: 'db) Spritzschutz' },
            { label: 'dc) Badewannenarmatur (Unterputz / Aufputz)' },
            { label: 'dd) Duschbrause, -schlauch, -auslauf und -aufhängung' },
          ],
        },
        {
          label: 'e) Duschen', children: [
            { label: 'ea) Duschtasse + Befestigung' },
            { label: 'eb) Duschkabine' },
            { label: 'ec) Badarmatur (Unterputz / Aufputz)' },
            { label: 'ed) Duschbrause, -schlauch, -auslauf und -aufhängung' },
          ],
        },
        { label: 'f) Badheizkörper' },
        { label: 'g) Waschbecken' },
        { label: 'h) Durchlauferhitzer' },
        { label: 'i) Wasserzähler' },
        { label: 'j) Bodenabdichtung' },
        { label: 'k) Trockenbau' },
        { label: 'l) Lüfter' },
        { label: 'm) Waschmaschinenanschluss' },
      ],
    },
    {
      label: '5. Küche', children: [
        { label: 'a) Wasserleitung' },
        { label: 'b) Abwasserleitung' },
        { label: 'c) Untertischgerät' },
        { label: 'd) Herdanschlussdose' },
        { label: 'e) Sonstiges' },
      ],
    },
    {
      label: '6. Türen', children: [
        { label: 'a) Wohnungseingangstüren' },
        { label: 'b) Zimmertüren' },
        { label: 'c) Türzargen' },
      ],
    },
    {
      label: '7. Elektrik Innenausbau', children: [
        { label: 'a) Steckdosen' },
        { label: 'b) Lichtschalter' },
        { label: 'c) Antennensteckdose' },
        { label: 'd) TAE Anschlussdose' },
        { label: 'e) Smart Home Anlage' },
        { label: 'f) Unterputzverteiler' },
        { label: 'g) Unterputzverteilermultimedia' },
        { label: 'h) Unterputzverteiler Innenleben' },
        { label: 'i) Kabel (laufende Meter)' },
        { label: 'j) Hauptzuleitung zur Unterverteilung' },
        { label: 'k) Rauchmelder' },
        { label: 'l) Sonstiges' },
      ],
    },
    {
      label: '8. Heizung Innenausbau', children: [
        {
          label: 'a) Fußbodenheizung (pro m²)', children: [
            { label: 'aa) Verteilerkasten' },
            { label: 'ab) Raumthermostat' },
            { label: 'ac) Styropor' },
            { label: 'ad) Rolljet' },
            { label: 'ae) Ausgleichsschüttung' },
            { label: 'af) Verrohrung' },
            { label: 'ag) Randdämmstreifen' },
          ],
        },
        {
          label: 'b) Heizkörper (pro m²)', children: [
            { label: 'ba) Verrohrung' },
            { label: 'bb) Heizkörper' },
            { label: 'bc) Heizkörperanschlüsse' },
            { label: 'bd) Heizkörperaufhängung' },
          ],
        },
      ],
    },
  ],

  'II. Treppenhaus': [
    { label: '1. Treppenstufen' },
    { label: '2. Geländer / Handlauf' },
    { label: '3. Wände' },
    { label: '4. Decken' },
    { label: '5. Haupteingangstüre' },
    { label: '6. Briefkastenanlage' },
    { label: '7. Gegensprechanlage' },
    { label: '8. Treppenhauselektrik' },
  ],

  'III. Außenanlage': [
    { label: '1. Abriss / Entsorgung' },
    { label: '2. Unterbank' },
    { label: '3. Carport' },
    { label: '4. Garage' },
    { label: '5. Spielfläche' },
    { label: '6. Fahrradstellplätze' },
    { label: '7. Lastenradstellplätze' },
  ],

  'IV. Elektrik': [
    { label: '1. Zählerschrankkasten' },
    { label: '2. Zählerschrankkasten Innenleben' },
  ],

  'V. Heizung / Sanitär Allgemein': [
    {
      label: 'V.I Heizung', children: [
        {
          label: '1. Heizung', children: [
            { label: 'a) Hausübergabestation (Fernwärme)' },
            { label: 'b) Ölheizung' },
            { label: 'c) Gasbrennwert' },
            { label: 'd) Wärmepumpe' },
          ],
        },
        {
          label: '2. Anschluss der Heizung', children: [
            { label: 'a) Fernwärme' },
            { label: 'b) Gasanschluss' },
          ],
        },
        {
          label: '3. Hauptleitungen / Stränge', children: [
            { label: 'a) Dämmung der Leitungen' },
          ],
        },
        { label: '4. Hydraulischer Abgleich' },
        { label: '5. Sonstige Kosten' },
      ],
    },
    {
      label: 'V.II Sanitär', children: [
        {
          label: '1. Steigleitungen', children: [
            { label: 'a) Frischwasser' },
            { label: 'b) Abwasser' },
          ],
        },
        { label: '2. Waschküche' },
        {
          label: '3. Sonstiges', children: [
            { label: 'a) Regenwassernutzungsanlage' },
            { label: 'b) Wasserenthärtungsanlage' },
            { label: 'c) Hebeanlagen' },
          ],
        },
      ],
    },
  ],

  'VI. Dach': [
    { label: '1. Dachstuhl' },
    { label: '2. Dachziegel' },
    { label: '3. Dämmung' },
    { label: '4. Dampfbremse' },
    { label: '5. Unterspannbahn' },
    { label: '6. Dachlattung' },
    { label: '7. Solaranlage' },
    { label: '8. Photovoltaik' },
    { label: '9. Dachfenster' },
    { label: '10. Regenrinnen / Fallrohre' },
    { label: '11. Schornstein' },
  ],

  'VII. Fenster': [
    { label: '1. Fensterbänke innen' },
    { label: '2. Fensterbänke außen' },
    { label: '3. Fensterlaibungen' },
    { label: '4. Fenster' },
  ],

  'VIII. Fassade': [
    { label: '1. Klinkerfassade reinigen + verfugen' },
    { label: '2. Wärmedämmverbundsystem' },
    { label: '3. Putzfassade' },
    { label: '4. Dämmung' },
    { label: '5. Dübel' },
    { label: '6. Armierungsgewebe' },
    { label: '7. Armierungskleber' },
    { label: '8. Oberputz' },
    { label: '9. Fassadenanstrich' },
    { label: '10. Fassadenreinigung' },
    { label: '11. Sonstige Kosten' },
    { label: '12. Sockelabdichtung' },
  ],

  'IX. Keller': [
    { label: '1. Kellertüre' },
    { label: '2. Außenabdichtung' },
    { label: '3. Dämmung Kelleraußenwand (Perimeterdämmung)' },
    { label: '4. Dämmung Kellerdecke' },
    { label: '5. Horizontalsperre gegen Feuchtigkeit' },
    { label: '6. Bodenplatte prüfen' },
    { label: '7. Kellerfenster' },
  ],

  'X. Balkone': [],

  'XI. Pauschale Kosten': [
    { label: '1. Gerüst' },
  ],
};
