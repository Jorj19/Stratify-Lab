const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

const obGlobal = {
    obErori: null,
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const PORT = process.env.PORT || 8080;
const vect_foldere = ['temp', 'logs', 'backup', 'fisiere_uploadate'];

for (const numeFolder of vect_foldere) {
    const caleFolder = path.join(__dirname, numeFolder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
    }
}

app.use((req, res, next) => {
    app.locals.ipUtilizator = req.ip;
    res.locals.ipUtilizator = req.ip;
    next();
});

function obtineEroare(identificator) {
    const eroare = obGlobal.obErori.info_erori.find((elem) => elem.identificator === identificator);

    if (eroare) {
        return eroare;
    }

    return obGlobal.obErori.eroare_default;
}

function initErori() {
    obGlobal.obErori = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'resurse', 'json', 'erori.json'), 'utf-8')
    );

    obGlobal.obErori.info_erori = obGlobal.obErori.info_erori.map((eroare) => ({
        ...eroare,
        imagine: path.join(obGlobal.obErori.cale_baza, eroare.imagine).replace(/\\/g, '/'),
    }));

    obGlobal.obErori.eroare_default = {
        ...obGlobal.obErori.eroare_default,
        imagine: path.join(obGlobal.obErori.cale_baza, obGlobal.obErori.eroare_default.imagine).replace(/\\/g, '/'),
    };
}

function afisareEroare(res, identificator, titlu, text, imagine) {
    const areIdentificator = identificator !== undefined && identificator !== null;
    const eroareDinJson = areIdentificator ? obtineEroare(identificator) : obGlobal.obErori.eroare_default;
    const eroareDeAfisat = {
        titlu: titlu ?? eroareDinJson.titlu,
        text: text ?? eroareDinJson.text,
        imagine: imagine ?? eroareDinJson.imagine,
    };

    const status = areIdentificator && eroareDinJson !== obGlobal.obErori.eroare_default
        ? identificator
        : 500;

    return res.status(status).render('pagini/eroare', {
        pagina: res.req.path,
        ...eroareDeAfisat,
    });
}


/*
app.get('/', (req, res) => {
    res.send(`
        <h1>Server Express</h1>
        
        <h2>Informații despre căi:</h2>
        <p><b>__dirname:</b> ${__dirname}</p>
        <p><b>__filename:</b> ${__filename}</p>
        <p><b>process.cwd():</b> ${process.cwd()}</p>
    `);
});
*/

app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index');
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'imagini', 'favicon', 'favicon.ico'));
});

// Funcția de verificare a datelor din erori.json
function verificaEroriJSON() {
    const caleaErori = path.join(__dirname, 'resurse', 'json', 'erori.json');

    // 1. 
    if (!fs.existsSync(caleaErori)) {
        console.error("Eroare Critică: Nu există fișierul erori.json la calea specificată!");
        process.exit(); 
    }

    const textJson = fs.readFileSync(caleaErori, 'utf-8');
    let obEroriParsed;
    
    try {
        obEroriParsed = JSON.parse(textJson);
    } catch (e) {
        console.error("Eroare: Fișierul erori.json nu este un JSON valid. Nu se pot continua verificările. Detalii:", e.message);
        return; 
    }

    // 2. 
    const proprietatiPrincipale = ['info_erori', 'cale_baza', 'eroare_default'];
    proprietatiPrincipale.forEach(prop => {
        if (!(prop in obEroriParsed)) {
            console.error(`Eroare: Nu există proprietatea principală "${prop}" în erori.json.`);
        }
    });

    // 3. 
    if (obEroriParsed.eroare_default) {
        const propDefault = ['titlu', 'text', 'imagine'];
        propDefault.forEach(prop => {
            if (!(prop in obEroriParsed.eroare_default)) {
                console.error(`Eroare: Pentru 'eroare_default' lipsește proprietatea: "${prop}".`);
            }
        });
    }

    // 4. 
    let folderBaza = "";
    if (obEroriParsed.cale_baza) {
        folderBaza = path.join(__dirname, obEroriParsed.cale_baza);
        if (!fs.existsSync(folderBaza)) {
            console.error(`Eroare: Folderul specificat în "cale_baza" nu există în sistemul de fișiere la calea: ${folderBaza}`);
        }
    }

    // 5. 
    const verificaExistaImagine = (numeImagine, context) => {
        if (numeImagine && folderBaza) {
            const caleImagine = path.join(folderBaza, numeImagine);
            if (!fs.existsSync(caleImagine)) {
                console.error(`Eroare: Nu există în sistemul de fișiere imaginea asociată pentru ${context} (${caleImagine}).`);
            }
        }
    };

    if (obEroriParsed.eroare_default) {
        verificaExistaImagine(obEroriParsed.eroare_default.imagine, "eroarea default");
    }

    if (Array.isArray(obEroriParsed.info_erori)) {
        obEroriParsed.info_erori.forEach(eroare => {
            verificaExistaImagine(eroare.imagine, `eroarea cu identificatorul ${eroare.identificator}`);
        });
    }

    // 6. 
    const obiecteDinString = textJson.match(/\{[\s\S]*?\}/g) || [];
    obiecteDinString.forEach(bloc => {
        const cheiGasite = [...bloc.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]);
        const cheiUnice = new Set();
        
        cheiGasite.forEach(cheie => {
            if (cheiUnice.has(cheie)) {
                console.error(`Eroare JSON Brut: Proprietatea "${cheie}" este specificată de mai multe ori în același obiect!`);
            }
            cheiUnice.add(cheie);
        });
    });

    // 7. 
    if (Array.isArray(obEroriParsed.info_erori)) {
        const grupIdentificatori = {};
        
        obEroriParsed.info_erori.forEach(eroare => {
            if (eroare.identificator !== undefined) {
                if (!grupIdentificatori[eroare.identificator]) {
                    grupIdentificatori[eroare.identificator] = [];
                }
                grupIdentificatori[eroare.identificator].push(eroare);
            }
        });

        for (const [id, listaErori] of Object.entries(grupIdentificatori)) {
            if (listaErori.length > 1) {
                console.error(`Eroare: Există mai multe erori cu același identificator (${id}). Mai jos sunt proprietățile acestora (fără identificator):`);
                listaErori.forEach(eroare => {
                    const copieEroare = { ...eroare };
                    delete copieEroare.identificator; 
                    console.error(`  -> ${JSON.stringify(copieEroare)}`);
                });
            }
        }
    }
}

verificaEroriJSON();
initErori();

app.use((req, res, next) => {
    if (/\.ejs$/i.test(req.path)) {
        afisareEroare(res, 400);
        return;
    }

    next();
});

app.get(/^\/[^/.]+$/, (req, res) => {
    const pagina = req.path.slice(1);

    res.render(`pagini/${pagina}`, (eroare, rezultatRandare) => {
        if (eroare) {
            if (eroare.message && eroare.message.startsWith('Failed to lookup view')) {
                afisareEroare(res, 404);
                return;
            }

            const eroareGenerica = obtineEroare(500);
            res.status(500).render('pagini/eroare-generica', {
                mesaj: eroare.message,
                eroare: eroareGenerica,
            });
            return;
        }

        res.send(rezultatRandare);
    });
});

app.use(/^\/resurse(?:\/.*)?$/, (req, res, next) => {
    const caleCeruta = decodeURIComponent(req.originalUrl.split('?')[0]);
    const caleRelativa = caleCeruta.replace(/^\/resurse\/?/, '');
    const caleSolicitata = path.join(__dirname, 'resurse', caleRelativa);

    if (fs.existsSync(caleSolicitata) && fs.statSync(caleSolicitata).isDirectory()) {
        afisareEroare(res, 403);
        return;
    }

    next();
});

app.use('/resurse', express.static(path.join(__dirname, 'resurse')));
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
});

