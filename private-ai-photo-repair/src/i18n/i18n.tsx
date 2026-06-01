import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UiLanguage = "hr" | "en";

const STORAGE_KEY = "papr-lang";

type Dict = Record<string, string>;

/** Croatian first — it is the default UI language. */
const HR: Dict = {
  "app.title": "Private AI Photo Repair",
  "app.tagline": "Tvoje fotografije nikad ne napuštaju uređaj.",
  "header.privacyBadge": "🔒 Privatnost na prvom mjestu",
  "header.privacyBadgeTitle": "Sva obrada se odvija lokalno u tvojem pregledniku",
  "header.theme.toLight": "Prebaci na svijetlu temu",
  "header.theme.toDark": "Prebaci na tamnu temu",
  "header.lang.label": "Jezik",

  "common.yes": "Da",
  "common.no": "Ne",
  "common.unknown": "Nepoznato",
  "common.cancel": "Odustani",

  "privacy.title": "Tvoje fotografije nikad ne napuštaju uređaj.",
  "privacy.body":
    "Većina AI uređivača slika učitava tvoje slike na servere u oblaku. Ova aplikacija radi drukčije. Preuzima AI modele na tvoj uređaj i pokreće ih lokalno. Prvo preuzimanje može potrajati, ali događa se samo jednom. Preuzete modele možeš obrisati u bilo kojem trenutku.",
  "privacy.p1": "Preuzmi AI modele jednom.",
  "privacy.p2": "Koristi ih više puta.",
  "privacy.p3": "Obriši ih kad god želiš.",
  "privacy.p4": "Obrađuj fotografije lokalno.",
  "privacy.p5": "Slike ostaju privatne — bez slanja na server.",

  "device.title": "Mogućnosti uređaja",
  "device.detecting": "Otkrivanje mogućnosti uređaja…",
  "device.localSupported": "Lokalni AI podržan",
  "device.localNotSupported": "Lokalni AI nije podržan",
  "device.tier": "Razina uređaja",
  "device.backend": "Odabrani backend",
  "device.maxInput": "Najveća ulazna veličina",
  "device.maxInputValue": "{n}px po duljoj strani",
  "device.storage": "Dostupna pohrana",
  "device.cores": "CPU jezgre",
  "device.memory": "Memorija uređaja",
  "device.webgpu": "WebGPU",
  "device.webglWasm": "WebGL / WASM",
  "device.browser": "Preglednik",
  "device.secure": "Sigurni kontekst",
  "device.webgpuWarn":
    "⚠ WebGPU nije dostupan na ovom uređaju/pregledniku. Aplikacija će koristiti sporiju zamjenu.",
  "device.webgpuToggle": "Koristi WebGPU (eksperimentalno)",
  "device.webgpuToggleHint":
    "Brže, ali na nekim preglednicima (Chrome/Opera) može srušiti karticu. Prema zadanome koristi se pouzdaniji WebAssembly (CPU). Uključi samo ako WebGPU radi stabilno kod tebe.",
  "device.unsupportedWarn":
    "⚠ Tvoj preglednik ne podržava potrebne lokalne API-je (Web Workers, WASM i IndexedDB/Cache Storage) za pokretanje AI modela.",
  "device.storageValue": "{free} slobodno od {total}",

  "image.title": "Glavna fotografija",
  "image.help": "Učitaj fotografiju koju želiš popraviti (JPEG, PNG ili WebP).",
  "image.drop": "Dodirni ili ispusti sliku ovdje",
  "image.stays": "Ostaje na tvojem uređaju.",
  "image.filename": "Naziv datoteke",
  "image.size": "Veličina",
  "image.dimensions": "Dimenzije",
  "image.type": "Vrsta",
  "image.tooLarge":
    "⚠ Ova slika je velika za ovaj uređaj i bit će smanjena na {n}px (dulja strana) prije obrade.",
  "image.replace": "Zamijeni",
  "image.remove": "Ukloni",

  "ref.title": "Neobavezne referentne fotografije",
  "ref.help":
    "Referentne fotografije koriste se lokalno za usmjeravanje obnove. Ne učitavaju se na server. Koristi kvalitetnije fotografije iste osobe za bolji rezultat.",
  "ref.add": "+ Dodaj referentnu fotografiju",
  "ref.typeAria": "Vrsta reference",
  "ref.styleOnly": "Utječe samo na stil/boju osim ako nije označeno kao ista osoba.",
  "ref.remove": "Ukloni",
  "ref.type.same-person": "Ista osoba",
  "ref.type.same-face": "Isto lice",
  "ref.type.same-scene": "Ista scena",
  "ref.type.color-style": "Referenca boje / stila",
  "ref.type.unknown": "Nepoznato",

  "prompt.title": "Opiši što treba učiniti",
  "prompt.help":
    "Piši na hrvatskom ili engleskom. Na primjer: „ukloni pozadinu“ ili „restore old photo“.",
  "prompt.placeholder": "ukloni pozadinu / remove background / popravi staru fotografiju…",
  "prompt.understoodAs": "Shvaćeno kao",
  "prompt.strength": "Jačina",
  "prompt.language": "Jezik",
  "prompt.reference": "Referenca",
  "prompt.confidence": "Pouzdanost",

  "suggest.title": "Predložene naredbe",
  "suggest.en": "Engleski",
  "suggest.hr": "Hrvatski",

  "process.title": "Obrada",
  "process.hint.upload": "Učitaj glavnu fotografiju za početak.",
  "process.hint.recognise": "Upiši ili odaberi naredbu kako bi zadatak bio prepoznat.",
  "process.hint.download": "Preuzmi potrebni model prije obrade.",
  "process.hint.unsupported": "Ovaj uređaj ne podržava lokalnu AI obradu.",
  "process.hint.readyMock": "Spremno. Ovaj zadatak će se izvršiti u demo (simuliranom) načinu.",
  "process.hint.readyFirstUse":
    "Spremno. Pravi model će se preuzeti pri prvom korištenju (zatim se sprema lokalno).",
  "process.hint.ready": "Spremno za lokalnu obradu.",
  "process.start": "Pokreni",
  "process.processing": "Obrađujem…",
  "process.cancel": "Odustani",
  "process.modelWarn":
    "⚠ Potreban pravi model još nije preuzet. Prvo pokretanje će ga preuzeti (~{size}). Možeš nastaviti — preuzimanje počinje pri obradi.",
  "process.modelWarnOnnx":
    "⚠ Potreban model još nije preuzet. Preuzmi ga gore prije obrade.",

  "processing.title": "Obrada",
  "processing.cancel": "Prekini obradu",

  "tile.title": "Napredak po pločicama",
  "tile.processing": "Obrada pločice {current} od {total}",
  "tile.overall": "{pct}% ukupno",
  "tile.eta": " — još otprilike {time}",

  "compare.title": "Prije / poslije",
  "compare.before": "◀ Prije",
  "compare.after": "Poslije ▶",
  "compare.mockWarn":
    "⚠ Ovaj rezultat je generiran u demo načinu. Spoji pravi model za produkcijsku kvalitetu.",
  "compare.original": "Original",
  "compare.processed": "Obrađeno",
  "compare.format": "Izlazni format",
  "compare.backend": "Backend",
  "compare.duration": "Trajanje",

  "export.title": "Izvezi rezultat",
  "export.pngRecommended":
    "⚠ Za uklanjanje pozadine preporučuje se PNG kako bi se sačuvala prozirnost.",
  "export.download": "Preuzmi",

  "model.title": "AI model",
  "model.required": "Potreban AI model",
  "model.requiredBody":
    "Za obradu fotografija izravno na ovom uređaju, ovaj AI model treba se preuzeti jednom.",
  "model.b1": "Preuzima se samo jednom",
  "model.b2": "Pohranjeno lokalno na tvojem uređaju",
  "model.b3": "Ponovno se koristi sljedeći put",
  "model.b4": "Može se obrisati u bilo kojem trenutku",
  "model.b5": "Tvoje fotografije ostaju na ovom uređaju",
  "model.name": "Naziv modela",
  "model.version": "Verzija",
  "model.size": "Veličina modela",
  "model.storageAvail": "Dostupna pohrana",
  "model.afterInstall": "Procijenjeni prostor nakon instalacije",
  "model.insufficient":
    "⚠ Nema dovoljno slobodne pohrane preglednika za ovaj model. Obriši instalirane modele ili odaberi manji zadatak.",
  "model.download": "Preuzmi model",
  "model.readyOnDevice": "Spremno na uređaju",
  "model.readyBody": "„{name}“ (v{version}) je pohranjen lokalno i bit će ponovno korišten.",
  "model.realFirstUse": "Pravi model — preuzima se pri prvom korištenju",
  "model.realFirstUseBody":
    "Ovaj zadatak koristi pravi AI model ({id}). Preuzima se automatski pri prvom korištenju i sprema lokalno za ponovnu upotrebu.",
  "model.mockBadge": "Demo način",
  "model.mockBody":
    "Za ovaj zadatak nema konfiguriranog pravog modela, pa se izvodi u demo načinu. Rezultati su simulirani i jasno označeni. Preuzimanje nije potrebno.",

  "setup.title": "Postavljanje AI modela",
  "setup.titleSelect": "Postavi AI modele",
  "setup.body":
    "Aplikacija pokreće AI na tvojem uređaju. Za korištenje pravih AI zadataka, modeli ispod trebaju se preuzeti jednom. Pohranjeni su lokalno, ponovno se koriste i mogu se obrisati u bilo kojem trenutku. Odaberi koje preuzeti sada — ili preskoči i preuzmi ih kasnije pri prvom korištenju.",
  "setup.selectedTotal": "Odabrano ukupno",
  "setup.storageAvail": "Dostupna pohrana",
  "setup.notEnough":
    "⚠ Nema dovoljno slobodne pohrane za odabrane modele. Odznači neke ili oslobodi prostor.",
  "setup.dontAsk": "Ne pitaj ponovno pri pokretanju",
  "setup.downloadSelected": "Preuzmi odabrano ({n})",
  "setup.notNow": "Ne sada",
  "setup.downloadingNum": "Preuzimanje modela {current} od {total}",
  "setup.keepUsing":
    "Možeš nastaviti koristiti aplikaciju dok se modeli preuzimaju. Pohranjeni su lokalno i ponovno se koriste sljedeći put.",
  "setup.starting": "Pokretanje…",

  "download.title": "Preuzimanje modela",
  "download.cancel": "Prekini preuzimanje",

  "load.title": "Učitavanje modela",

  "manager.title": "Upravitelj modela",
  "manager.checkCache": "Provjeri predmemoriju",
  "manager.totalUsed": "Ukupno korištena AI pohrana: {size}",
  "manager.col.model": "Model",
  "manager.col.version": "Verzija",
  "manager.col.size": "Veličina",
  "manager.col.status": "Status",
  "manager.col.lastUsed": "Zadnje korišteno",
  "manager.col.actions": "Radnje",
  "manager.status.cached": "Predmemorirano",
  "manager.status.notDownloaded": "Nije preuzeto",
  "manager.status.mockOnly": "Samo demo",
  "manager.status.real": "Pravi (na zahtjev)",
  "manager.delete": "Obriši",
  "manager.redownload": "Ponovno preuzmi",
  "manager.download": "Preuzmi",
  "manager.saver": "Štednja pohrane: automatski ukloni modele nekorištene",
  "manager.saverDays": "dana",
  "manager.deleteAll": "Obriši sve modele",

  "diag.title": "Dijagnostika",
  "diag.copy": "Kopiraj dijagnostiku (JSON)",
  "diag.copied": "Kopirano!",

  "error.title": "Nešto je pošlo po zlu",
  "error.dismiss": "Zatvori grešku",

  "footer": "Private AI Photo Repair · Sva obrada je lokalna · Bez slanja slika",
};

const EN: Dict = {
  "app.title": "Private AI Photo Repair",
  "app.tagline": "Your photos never leave your device.",
  "header.privacyBadge": "🔒 Privacy-first",
  "header.privacyBadgeTitle": "All processing happens locally in your browser",
  "header.theme.toLight": "Switch to light theme",
  "header.theme.toDark": "Switch to dark theme",
  "header.lang.label": "Language",

  "common.yes": "Yes",
  "common.no": "No",
  "common.unknown": "Unknown",
  "common.cancel": "Cancel",

  "privacy.title": "Your photos never leave your device.",
  "privacy.body":
    "Most AI photo editors upload your images to cloud servers. This app works differently. It downloads AI models to your device and runs them locally. The first download may take some time, but it only happens once. You can delete downloaded models at any time.",
  "privacy.p1": "Download AI models once.",
  "privacy.p2": "Use them repeatedly.",
  "privacy.p3": "Delete them whenever you want.",
  "privacy.p4": "Process photos locally.",
  "privacy.p5": "Keep photos private — no image upload in this MVP.",

  "device.title": "Device capabilities",
  "device.detecting": "Detecting device capabilities…",
  "device.localSupported": "Local AI supported",
  "device.localNotSupported": "Local AI not supported",
  "device.tier": "Device tier",
  "device.backend": "Selected backend",
  "device.maxInput": "Max input size",
  "device.maxInputValue": "{n}px longest side",
  "device.storage": "Storage available",
  "device.cores": "CPU cores",
  "device.memory": "Device memory",
  "device.webgpu": "WebGPU",
  "device.webglWasm": "WebGL / WASM",
  "device.browser": "Browser",
  "device.secure": "Secure context",
  "device.webgpuWarn":
    "⚠ WebGPU is not available on this device/browser. The app will use a slower fallback.",
  "device.webgpuToggle": "Use WebGPU (experimental)",
  "device.webgpuToggleHint":
    "Faster, but on some browsers (Chrome/Opera) it can crash the tab. The reliable WebAssembly (CPU) backend is used by default. Enable only if WebGPU is stable for you.",
  "device.unsupportedWarn":
    "⚠ Your browser does not support the required local APIs (Web Workers, WASM, and IndexedDB/Cache Storage) for running AI models.",
  "device.storageValue": "{free} free of {total}",

  "image.title": "Main photo",
  "image.help": "Upload the photo you want to repair (JPEG, PNG or WebP).",
  "image.drop": "Tap or drop an image here",
  "image.stays": "It stays on your device.",
  "image.filename": "Filename",
  "image.size": "Size",
  "image.dimensions": "Dimensions",
  "image.type": "Type",
  "image.tooLarge":
    "⚠ This image is large for this device and will be resized to {n}px (longest side) before processing.",
  "image.replace": "Replace",
  "image.remove": "Remove",

  "ref.title": "Optional reference photos",
  "ref.help":
    "Reference photos are used locally to guide restoration. They are not uploaded. Use better-quality photos of the same person to guide a repair.",
  "ref.add": "+ Add reference photo",
  "ref.typeAria": "Reference type",
  "ref.styleOnly": "Affects style/color only unless marked same person.",
  "ref.remove": "Remove",
  "ref.type.same-person": "Same person",
  "ref.type.same-face": "Same face",
  "ref.type.same-scene": "Same scene",
  "ref.type.color-style": "Color / style reference",
  "ref.type.unknown": "Unknown",

  "prompt.title": "Describe what to do",
  "prompt.help":
    "Write in Croatian or English. For example: “ukloni pozadinu” or “restore old photo”.",
  "prompt.placeholder": "ukloni pozadinu / remove background / popravi staru fotografiju…",
  "prompt.understoodAs": "Understood as",
  "prompt.strength": "Strength",
  "prompt.language": "Language",
  "prompt.reference": "Reference",
  "prompt.confidence": "Confidence",

  "suggest.title": "Suggested commands",
  "suggest.en": "English",
  "suggest.hr": "Hrvatski",

  "process.title": "Process",
  "process.hint.upload": "Upload a main photo to begin.",
  "process.hint.recognise": "Enter or pick a command so the task can be recognised.",
  "process.hint.download": "Download the required model before processing.",
  "process.hint.unsupported": "This device does not support local AI processing.",
  "process.hint.readyMock": "Ready. This task will run in mock mode (simulated).",
  "process.hint.readyFirstUse":
    "Ready. The real model downloads on first use (then cached locally).",
  "process.hint.ready": "Ready to process locally.",
  "process.start": "Start",
  "process.processing": "Processing…",
  "process.cancel": "Cancel",
  "process.modelWarn":
    "⚠ The required real model isn't downloaded yet. The first run will fetch it (~{size}). You can continue — download starts on processing.",
  "process.modelWarnOnnx":
    "⚠ The required model isn't downloaded yet. Download it above before processing.",

  "processing.title": "Processing",
  "processing.cancel": "Cancel processing",

  "tile.title": "Tile progress",
  "tile.processing": "Processing tile {current} of {total}",
  "tile.overall": "{pct}% overall",
  "tile.eta": " — about {time} left",

  "compare.title": "Before / after",
  "compare.before": "◀ Before",
  "compare.after": "After ▶",
  "compare.mockWarn":
    "⚠ This result was generated in mock mode. Connect a real model for production-quality results.",
  "compare.original": "Original",
  "compare.processed": "Processed",
  "compare.format": "Output format",
  "compare.backend": "Backend",
  "compare.duration": "Duration",

  "export.title": "Export result",
  "export.pngRecommended":
    "⚠ PNG is recommended for background removal to preserve transparency.",
  "export.download": "Download",

  "model.title": "AI model",
  "model.required": "AI Model Required",
  "model.requiredBody":
    "To process photos directly on this device, this AI model must be downloaded once.",
  "model.b1": "Downloaded only once",
  "model.b2": "Stored locally on your device",
  "model.b3": "Reused next time",
  "model.b4": "Can be deleted at any time",
  "model.b5": "Your photos stay on this device",
  "model.name": "Model name",
  "model.version": "Version",
  "model.size": "Model size",
  "model.storageAvail": "Storage available",
  "model.afterInstall": "Estimated space after install",
  "model.insufficient":
    "⚠ Not enough free browser storage is available for this model. You can delete installed models or choose a smaller task.",
  "model.download": "Download Model",
  "model.readyOnDevice": "Ready on device",
  "model.readyBody": "“{name}” (v{version}) is stored locally and will be reused.",
  "model.realFirstUse": "Real model — downloads on first use",
  "model.realFirstUseBody":
    "This task uses a real AI model ({id}). It downloads automatically on first use and is cached locally for reuse.",
  "model.mockBadge": "Mock mode",
  "model.mockBody":
    "No real model is configured for this task, so it runs in mock mode. Results are simulated and clearly labelled. No download is required.",

  "setup.title": "Setting up AI models",
  "setup.titleSelect": "Set up AI models",
  "setup.body":
    "This app runs AI on your device. To use real AI tasks, the models below need to be downloaded once. They are stored locally, reused next time, and can be deleted any time. Choose which to download now — or skip and download them later on first use.",
  "setup.selectedTotal": "Selected total",
  "setup.storageAvail": "Storage available",
  "setup.notEnough":
    "⚠ Not enough free browser storage for the selected models. Deselect some or free up space.",
  "setup.dontAsk": "Don’t ask again on startup",
  "setup.downloadSelected": "Download selected ({n})",
  "setup.notNow": "Not now",
  "setup.downloadingNum": "Downloading model {current} of {total}",
  "setup.keepUsing":
    "You can keep using the app while models download. They are stored locally and reused next time.",
  "setup.starting": "Starting…",

  "download.title": "Model download",
  "download.cancel": "Cancel download",

  "load.title": "Loading model",

  "manager.title": "Model manager",
  "manager.checkCache": "Check cache",
  "manager.totalUsed": "Total AI storage used: {size}",
  "manager.col.model": "Model",
  "manager.col.version": "Version",
  "manager.col.size": "Size",
  "manager.col.status": "Status",
  "manager.col.lastUsed": "Last used",
  "manager.col.actions": "Actions",
  "manager.status.cached": "Cached",
  "manager.status.notDownloaded": "Not downloaded",
  "manager.status.mockOnly": "Mock only",
  "manager.status.real": "Real (on demand)",
  "manager.delete": "Delete",
  "manager.redownload": "Re-download",
  "manager.download": "Download",
  "manager.saver": "Storage saver: auto-remove models unused for",
  "manager.saverDays": "days",
  "manager.deleteAll": "Delete all models",

  "diag.title": "Diagnostics",
  "diag.copy": "Copy Diagnostics JSON",
  "diag.copied": "Copied!",

  "error.title": "Something went wrong",
  "error.dismiss": "Dismiss error",

  "footer": "Private AI Photo Repair · All processing happens locally · No image upload",
};

const DICTS: Record<UiLanguage, Dict> = { hr: HR, en: EN };

interface I18nContextValue {
  lang: UiLanguage;
  setLang: (lang: UiLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLang(): UiLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "hr" || value === "en") return value;
  } catch {
    /* ignore */
  }
  return "hr"; // Croatian first
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<UiLanguage>(() => readStoredLang());

  const setLang = useCallback((next: UiLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICTS[lang];
      const template = dict[key] ?? DICTS.en[key] ?? key;
      return interpolate(template, vars);
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
