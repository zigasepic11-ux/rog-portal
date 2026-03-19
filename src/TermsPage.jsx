// src/TermsPage.jsx
export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <h2>Pogoji uporabe</h2>
        <p>
          Z uporabo aplikacije ROG, ki vključuje mobilno aplikacijo in spletni portal,
          se strinjate s temi pogoji uporabe.
        </p>

        <h3>1. Namen aplikacije</h3>
        <p>
          ROG je digitalna platforma, namenjena lovskim družinam za vodenje evidenc lova,
          spremljanje aktivnosti članov, upravljanje dogodkov in shranjevanje dokumentacije.
          Aplikacija služi kot organizacijsko in informacijsko orodje.
        </p>

        <h3>2. Uporabniške vloge</h3>
        <p>
          <strong>Member (član)</strong> ima dostop do osnovnih funkcij aplikacije, kot so
          pregled podatkov svoje lovske družine, uporaba dnevnika lova, pregled dogodkov in
          dostop do dokumentov, za katere ima dovoljenje.
        </p>
        <p>
          <strong>Moderator</strong> ima razširjene pravice znotraj svoje lovske družine in
          lahko upravlja določene vsebine, kot so dogodki, dokumenti in drugi organizacijski podatki.
          Moderator je odgovoren za pravilno in pošteno uporabo teh pooblastil.
        </p>

        <h3>3. Odgovornost uporabnikov</h3>
        <p>
          Vsak uporabnik je odgovoren za točnost, popolnost in resničnost podatkov, ki jih vnese v sistem.
          Uporabnik se zavezuje, da ne bo uporabljal aplikacije za zavajanje, prikrivanje podatkov ali
          kakršnokoli drugo nepooblaščeno ravnanje.
        </p>

        <h3>4. Prepovedana uporaba</h3>
        <p>Uporabnikom je prepovedano:</p>
        <ul>
          <li>vnašanje lažnih, zavajajočih ali namenoma napačnih podatkov,</li>
          <li>deljenje dostopnih podatkov z nepooblaščenimi osebami,</li>
          <li>poskusi nepooblaščenega dostopa do podatkov drugih uporabnikov ali drugih lovskih družin,</li>
          <li>nalaganje nezakonitih, škodljivih ali neprimernih vsebin,</li>
          <li>uporaba aplikacije v nasprotju z zakonodajo ali internimi pravili lovske družine.</li>
        </ul>

        <h3>5. Dokumenti in vsebine</h3>
        <p>
          Uporabniki lahko v sistem nalagajo dokumente in druge datoteke, kadar jim to dovoljuje njihova vloga.
          Naložene vsebine morajo biti zakonite, primerne in povezane z namenom uporabe aplikacije.
        </p>

        <h3>6. Točnost podatkov</h3>
        <p>
          ROG ne jamči za popolno točnost vseh podatkov, saj del podatkov vnašajo uporabniki sami.
          Za pravilnost vsebine in njeno uporabo je odgovorna posamezna lovska družina oziroma uporabnik,
          ki je podatek vnesel.
        </p>

        <h3>7. Razpoložljivost sistema</h3>
        <p>
          Upravljalec si prizadeva za zanesljivo delovanje sistema, vendar ne zagotavlja neprekinjenega
          delovanja brez napak, prekinitev ali začasne nedostopnosti.
        </p>

        <h3>8. Omejitev odgovornosti</h3>
        <p>
          ROG ne odgovarja za škodo, izgubo podatkov, napačne odločitve ali druge posledice, ki bi nastale
          zaradi napačnega vnosa, napačne uporabe ali nepravilne interpretacije podatkov v aplikaciji.
        </p>

        <h3>9. Spremembe pogojev</h3>
        <p>
          Pogoji uporabe se lahko občasno posodobijo. Nadaljnja uporaba aplikacije po objavi sprememb pomeni,
          da se uporabnik s spremembami strinja.
        </p>

        <h3>10. Kontakt</h3>
        <p>
          Za vprašanja glede pogojev uporabe se obrnite na upravljalca sistema preko kontaktnega e-naslova,
          ki ga določi upravljalec aplikacije.
        </p>
      </div>
    </div>
  );
}