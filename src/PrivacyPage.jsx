// src/PrivacyPage.jsx
export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <h2>Politika zasebnosti</h2>
        <p>
          Ta politika zasebnosti pojasnjuje, kako aplikacija ROG obdeluje podatke uporabnikov
          v okviru mobilne aplikacije in spletnega portala.
        </p>

        <h3>1. Katere podatke obdelujemo</h3>
        <p>V sistemu se lahko obdelujejo naslednji podatki:</p>
        <ul>
          <li>ime oziroma identifikacijski podatki uporabnika,</li>
          <li>pripadnost lovski družini,</li>
          <li>podatki o uporabniških aktivnostih znotraj aplikacije,</li>
          <li>vnos podatkov v dnevnik lova, dogodke in druge evidence,</li>
          <li>dokumenti in datoteke, ki jih uporabniki naložijo v sistem.</li>
        </ul>

        <h3>2. Namen obdelave</h3>
        <p>Podatki se uporabljajo za:</p>
        <ul>
          <li>zagotavljanje delovanja aplikacije,</li>
          <li>upravljanje evidenc in dogodkov znotraj lovske družine,</li>
          <li>organizacijo dela in pregled aktivnosti,</li>
          <li>omogočanje dostopa do dokumentov in vsebin glede na uporabniško vlogo.</li>
        </ul>

        <h3>3. Dostop do podatkov</h3>
        <p>
          Dostop do podatkov je omejen glede na vlogo uporabnika. Član vidi podatke, ki so povezani
          z njegovo lovsko družino in dovoljenimi funkcijami. Moderator ima razširjen dostop znotraj
          svoje lovske družine zaradi organizacijskih nalog.
        </p>

        <h3>4. Deljenje podatkov</h3>
        <p>
          Podatki se ne prodajajo in se ne delijo tretjim osebam, razen kadar je to nujno za tehnično
          delovanje sistema ali kadar to zahteva zakon.
        </p>

        <h3>5. Shranjevanje podatkov</h3>
        <p>
          Podatki se shranjujejo v digitalni infrastrukturi, potrebni za delovanje aplikacije.
          Uporabljeni so razumni tehnični in organizacijski ukrepi za zaščito podatkov.
        </p>

        <h3>6. Varnost</h3>
        <p>
          Upravljalec si prizadeva zagotavljati ustrezno varnost sistema, vendar popolna varnost
          nobenega informacijskega sistema ne more biti zagotovljena.
        </p>

        <h3>7. Pravice uporabnikov</h3>
        <p>Uporabnik lahko zahteva:</p>
        <ul>
          <li>vpogled v svoje podatke,</li>
          <li>popravek netočnih ali nepopolnih podatkov,</li>
          <li>pojasnilo glede uporabe svojih podatkov v okviru sistema.</li>
        </ul>

        <h3>8. Hramba podatkov</h3>
        <p>
          Podatki se hranijo toliko časa, kolikor je potrebno za namen delovanja sistema, organizacije dela
          lovske družine in izpolnjevanja tehničnih ali pravnih zahtev.
        </p>

        <h3>9. Spremembe politike zasebnosti</h3>
        <p>
          Politika zasebnosti se lahko občasno spremeni. Posodobljena različica velja od dne objave v sistemu.
        </p>

        <h3>10. Kontakt</h3>
        <p>
          Za vprašanja glede zasebnosti in obdelave podatkov se obrnite na upravljalca sistema preko
          kontaktnega e-naslova, ki ga določi upravljalec aplikacije.
        </p>
      </div>
    </div>
  );
}