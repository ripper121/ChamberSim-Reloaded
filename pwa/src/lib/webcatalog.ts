import type { AppLanguage } from "./language";

type Localized = readonly [source: string, de: string, fr: string, it: string];

const shared: readonly Localized[] = [
  ["Load ratio", "Ladeverhältnis", "Taux de chargement", "Rapporto di caricamento"],
  ["Maximum pressure", "Maximaldruck", "Pression maximale", "Pressione massima"],
  ["Muzzle velocity", "Mündungsgeschwindigkeit", "Vitesse initiale", "Velocità alla volata"],
  ["Barrel Time general (BT)", "Allgemeine Laufzeit (BT)", "Temps de canon général (BT)", "Tempo di canna generale (BT)"],
  ["Bullet Lead Time 10% pmax (BLT)", "Geschoss-Anlaufzeit 10 % pmax (BLT)", "Temps d'avance du projectile à 10 % pmax (BLT)", "Tempo di avvio del proiettile al 10% pmax (BLT)"],
  ["Target", "Ziel", "Cible", "Obiettivo"],
  ["Calculate", "Berechnen", "Calculer", "Calcola"],
  ["Propellant", "Treibladung", "Propulsif", "Propellente"],
  ["Results", "Ergebnisse", "Résultats", "Risultati"],
  ["Status", "Status", "État", "Stato"],
  ["Current", "Aktuell", "Actuel", "Attuale"],
  ["Minimum", "Minimum", "Minimum", "Minimo"],
  ["Maximum", "Maximum", "Maximum", "Massimo"],
  ["Manufacturer", "Hersteller", "Fabricant", "Produttore"],
  ["Product name", "Produktname", "Nom du produit", "Nome prodotto"],
  ["Energy", "Energie", "Énergie", "Energia"],
  ["Mass", "Masse", "Masse", "Massa"],
  ["File", "Datei", "Fichier", "File"],
  ["Back", "Zurück", "Retour", "Indietro"],
  ["Next", "Weiter", "Suivant", "Avanti"],
  ["off", "aus", "désactivé", "disattivato"],
  ["finished", "fertig", "terminé", "terminato"],
  ["ready", "bereit", "prêt", "pronto"],
  ["Sort by %1", "Nach %1 sortieren", "Trier par %1", "Ordina per %1"],
  ["Select %1", "%1 auswählen", "Sélectionner %1", "Seleziona %1"]
];

const propellantMass: readonly Localized[] = [
  ["Propellant Mass", "Treibladungsmasse", "Masse de propulsif", "Massa del propellente"],
  ["Load ratio slider", "Regler für Ladeverhältnis", "Curseur du taux de chargement", "Cursore del rapporto di caricamento"],
  ["Pmax -15%", "Pmax -15 %", "Pmax -15 %", "Pmax -15%"],
  ["Pmax -25%", "Pmax -25 %", "Pmax -25 %", "Pmax -25%"],
  ["Clear target", "Ziel löschen", "Effacer la cible", "Cancella obiettivo"],
  ["Reset target", "Ziel zurücksetzen", "Réinitialiser la cible", "Ripristina obiettivo"],
  ["Clear %1 target", "Ziel %1 löschen", "Effacer la cible %1", "Cancella obiettivo %1"],
  ["Reset %1 target", "Ziel %1 zurücksetzen", "Réinitialiser la cible %1", "Ripristina obiettivo %1"],
  ["%1 target", "Ziel %1", "Cible %1", "Obiettivo %1"],
  ["Target: %1", "Ziel: %1", "Cible : %1", "Obiettivo: %1"],
  ["The selected target is not reachable", "Das gewählte Ziel ist nicht erreichbar", "La cible sélectionnée n'est pas atteignable", "L'obiettivo selezionato non è raggiungibile"],
  ["Enter one target, then click Calculate", "Ein Ziel eingeben und dann Berechnen anklicken", "Saisissez une cible, puis cliquez sur Calculer", "Inserisci un obiettivo, quindi fai clic su Calcola"],
  ["Enter one target value and click Calculate to determine the powder mass.", "Einen Zielwert eingeben und Berechnen anklicken, um die Pulvermasse zu bestimmen.", "Saisissez une valeur cible et cliquez sur Calculer pour déterminer la masse de poudre.", "Inserisci un valore obiettivo e fai clic su Calcola per determinare la massa della polvere."],
  ["Calculated powder masses can result in an unusable or dangerous load. Always compare the result with current manufacturer loading data and start low.", "Berechnete Pulvermassen können zu einer unbrauchbaren oder gefährlichen Ladung führen. Das Ergebnis immer mit aktuellen Ladedaten des Herstellers vergleichen und niedrig beginnen.", "Les masses de poudre calculées peuvent produire une charge inutilisable ou dangereuse. Comparez toujours le résultat aux données de chargement actuelles du fabricant et commencez bas.", "Le masse di polvere calcolate possono produrre una carica inutilizzabile o pericolosa. Confronta sempre il risultato con i dati di caricamento attuali del produttore e inizia dal basso."],
  ["Propellant mass result", "Ergebnis Treibladungsmasse", "Résultat de masse de propulsif", "Risultato massa del propellente"],
  ["Applied Propellant Mass Wizard result", "Ergebnis des Assistenten für Treibladungsmasse angewendet", "Résultat de l'assistant de masse de propulsif appliqué", "Risultato della procedura guidata massa del propellente applicato"]
];

const parametric: readonly Localized[] = [
  ["Parametric Powder Search", "Parametrische Pulversuche", "Recherche paramétrique de poudre", "Ricerca parametrica della polvere"],
  ["Generic tolerance synthesis", "Generische Toleranzsynthese", "Synthèse générique de tolérance", "Sintesi generica delle tolleranze"],
  ["%1 — current load", "%1 — aktuelle Ladung", "%1 — charge actuelle", "%1 — carica attuale"],
  ["Propellant selection for the search", "Treibladungsauswahl für die Suche", "Sélection des propulsifs pour la recherche", "Selezione del propellente per la ricerca"],
  ["Conditions", "Bedingungen", "Conditions", "Condizioni"],
  ["Manual powder selection", "Manuelle Pulverauswahl", "Sélection manuelle de poudre", "Selezione manuale della polvere"],
  ["Similarity powder search", "Ähnlichkeitssuche für Pulver", "Recherche de poudres similaires", "Ricerca di polveri simili"],
  ["Reference propellant", "Referenztreibladung", "Propulsif de référence", "Propellente di riferimento"],
  ["Tolerance window", "Toleranzfenster", "Fenêtre de tolérance", "Finestra di tolleranza"],
  ["Direction", "Richtung", "Direction", "Direzione"],
  ["plus/minus", "plus/minus", "plus/moins", "più/meno"],
  ["plus", "plus", "plus", "più"],
  ["minus", "minus", "moins", "meno"],
  ["Maximum range", "Maximaler Bereich", "Plage maximale", "Intervallo massimo"],
  ["Similarity search by", "Ähnlichkeitssuche nach", "Recherche de similarité par", "Ricerca di somiglianza per"],
  ["Similarity factor", "Ähnlichkeitsfaktor", "Facteur de similarité", "Fattore di somiglianza"],
  ["Similarity tolerance", "Ähnlichkeitstoleranz", "Tolérance de similarité", "Tolleranza di somiglianza"],
  ["brisance/progressivity (Brp)", "Brisanz/Progressivität (Brp)", "brisance/progressivité (Brp)", "brisanza/progressività (Brp)"],
  ["brisance (Br)", "Brisanz (Br)", "brisance (Br)", "brisanza (Br)"],
  ["progressivity (Bp)", "Progressivität (Bp)", "progressivité (Bp)", "progressività (Bp)"],
  ["Individual powder-data tolerances", "Individuelle Toleranzen der Pulverdaten", "Tolérances individuelles des données de poudre", "Tolleranze individuali dei dati della polvere"],
  ["Spec. explosive heat (Qex)", "Spez. Explosionswärme (Qex)", "Chaleur explosive spéc. (Qex)", "Calore esplosivo spec. (Qex)"],
  ["Isentropic exponent (κ)", "Isentropenexponent (κ)", "Exposant isentropique (κ)", "Esponente isoentropico (κ)"],
  ["Combustion coefficient (Ba)", "Abbrandkoeffizient (Ba)", "Coefficient de combustion (Ba)", "Coefficiente di combustione (Ba)"],
  ["prog./deg. coefficient (a0)", "Prog./Deg.-Koeffizient (a0)", "coefficient prog./dégr. (a0)", "coefficiente prog./degr. (a0)"],
  ["Transition limit (z1)", "Übergangsgrenze (z1)", "Limite de transition (z1)", "Limite di transizione (z1)"],
  ["Transition limit (z2)", "Übergangsgrenze (z2)", "Limite de transition (z2)", "Limite di transizione (z2)"],
  ["Propellant material density (pc)", "Treibladungsstoffdichte (pc)", "Masse volumique du propulsif (pc)", "Densità del materiale propellente (pc)"],
  ["Propellant bulk density (pcd)", "Treibladungsschüttdichte (pcd)", "Masse volumique apparente du propulsif (pcd)", "Densità apparente del propellente (pcd)"],
  ["Search results", "Suchergebnisse", "Résultats de recherche", "Risultati della ricerca"],
  ["Select all displayed powders", "Alle angezeigten Pulver auswählen", "Sélectionner toutes les poudres affichées", "Seleziona tutte le polveri visualizzate"],
  ["Lot-ID/No.", "Los-ID/Nr.", "ID/N° de lot", "ID/N. lotto"],
  ["Maximum difference", "Maximale Abweichung", "Écart maximal", "Differenza massima"],
  ["Check the powders to use as synthesis candidates.", "Die Pulver markieren, die als Synthesekandidaten verwendet werden sollen.", "Cochez les poudres à utiliser comme candidates pour la synthèse.", "Seleziona le polveri da usare come candidate per la sintesi."],
  ["No propellant is inside every enabled tolerance window.", "Keine Treibladung liegt innerhalb aller aktivierten Toleranzfenster.", "Aucun propulsif ne se trouve dans toutes les fenêtres de tolérance activées.", "Nessun propellente rientra in tutte le finestre di tolleranza abilitate."],
  ["Enable at least one search criterion.", "Mindestens ein Suchkriterium aktivieren.", "Activez au moins un critère de recherche.", "Abilita almeno un criterio di ricerca."],
  ["%1 selected for synthesis", "%1 für die Synthese ausgewählt", "%1 sélectionné(s) pour la synthèse", "%1 selezionato/i per la sintesi"],
  ["Similar propellants are not interchangeable.", "Ähnliche Treibladungen sind nicht austauschbar.", "Les propulsifs similaires ne sont pas interchangeables.", "I propellenti simili non sono intercambiabili."],
  ["Verify the selected powder against current manufacturer loading data and recalculate the charge.", "Das gewählte Pulver anhand aktueller Ladedaten des Herstellers prüfen und die Ladung neu berechnen.", "Vérifiez la poudre sélectionnée avec les données de chargement actuelles du fabricant et recalculez la charge.", "Verifica la polvere selezionata con i dati di caricamento attuali del produttore e ricalcola la carica."],
  ["Primary conditions", "Primäre Bedingungen", "Conditions principales", "Condizioni primarie"],
  ["Secondary conditions", "Sekundäre Bedingungen", "Conditions secondaires", "Condizioni secondarie"],
  ["Target min.", "Ziel min.", "Cible min.", "Obiettivo min."],
  ["Target max.", "Ziel max.", "Cible max.", "Obiettivo max."],
  ["Result filters", "Ergebnisfilter", "Filtres de résultats", "Filtri dei risultati"],
  ["Min", "Min", "Min", "Min"],
  ["Max", "Max", "Max", "Max"],
  ["Clear %1 limits", "Grenzen für %1 löschen", "Effacer les limites de %1", "Cancella limiti di %1"],
  ["Clear limits", "Grenzen löschen", "Effacer les limites", "Cancella limiti"],
  ["Reset %1 target", "Ziel %1 zurücksetzen", "Réinitialiser la cible %1", "Ripristina obiettivo %1"],
  ["Reset target to current value", "Ziel auf aktuellen Wert zurücksetzen", "Réinitialiser la cible à la valeur actuelle", "Ripristina l'obiettivo al valore attuale"],
  ["%1 target", "Ziel %1", "Cible %1", "Obiettivo %1"],
  ["%1 target minimum", "Zielminimum %1", "Minimum de la cible %1", "Minimo obiettivo %1"],
  ["%1 target maximum", "Zielmaximum %1", "Maximum de la cible %1", "Massimo obiettivo %1"],
  ["%1 tolerance", "Toleranz %1", "Tolérance %1", "Tolleranza %1"],
  ["individual", "indiv.", "indiv.", "indiv."],
  ["Burnt propellant", "Verbrannte Treibladung", "Propulsif brûlé", "Propellente bruciato"],
  ["Effective efficiency rate", "Effektiver Wirkungsgrad", "Taux de rendement effectif", "Tasso di efficienza effettiva"],
  ["Discard results with a %1", "Ergebnisse verwerfen mit %1", "Écarter les résultats avec %1", "Scarta risultati con %1"],
  ["pressure", "Druck", "pression", "pressione"],
  ["velocity", "Geschwindigkeit", "vitesse", "velocità"],
  ["load ratio", "Ladeverhältnis", "taux de chargement", "rapporto di caricamento"],
  ["burnt powder", "verbranntem Pulver", "poudre brûlée", "polvere bruciata"],
  ["efficiency", "Wirkungsgrad", "rendement", "efficienza"],
  ["Live diagram", "Live-Diagramm", "Diagramme en direct", "Diagramma in tempo reale"],
  ["Show out-of-spec results", "Ergebnisse außerhalb der Vorgaben anzeigen", "Afficher les résultats hors spécifications", "Mostra risultati fuori specifica"],
  ["Fill", "Füllung", "Remplissage", "Riempimento"],
  ["Burnt", "Verbrannt", "Brûlé", "Bruciato"],
  ["Eff.", "Wirk.", "Rend.", "Eff."],
  ["Results: Text", "Ergebnisse: Text", "Résultats : texte", "Risultati: testo"],
  ["Results: HTML", "Ergebnisse: HTML", "Résultats : HTML", "Risultati: HTML"],
  ["Start synthesis…", "Synthese starten…", "Démarrer la synthèse…", "Avvia sintesi…"],
  ["Cancel process", "Vorgang abbrechen", "Annuler le processus", "Annulla processo"],
  ["Save configuration…", "Konfiguration speichern…", "Enregistrer la configuration…", "Salva configurazione…"],
  ["Open configuration…", "Konfiguration öffnen…", "Ouvrir la configuration…", "Apri configurazione…"],
  ["Configuration loaded.", "Konfiguration geladen.", "Configuration chargée.", "Configurazione caricata."],
  ["Unsupported configuration file", "Nicht unterstützte Konfigurationsdatei", "Fichier de configuration non pris en charge", "File di configurazione non supportato"],
  ["Cannot read configuration: %1", "Konfiguration kann nicht gelesen werden: %1", "Impossible de lire la configuration : %1", "Impossibile leggere la configurazione: %1"],
  ["Out of spec. tolerance", "Außerhalb der Toleranzvorgabe", "Hors tolérance spécifiée", "Fuori dalla tolleranza specificata"],
  ["Select a synthesis result for its preview.", "Ein Syntheseergebnis für die Vorschau auswählen.", "Sélectionnez un résultat de synthèse pour afficher son aperçu.", "Seleziona un risultato di sintesi per l'anteprima."],
  ["Testing: %1", "Test: %1", "Test : %1", "Test: %1"],
  ["Select at least one complete tolerance window and check its limits.", "Mindestens ein vollständiges Toleranzfenster auswählen und seine Grenzen prüfen.", "Sélectionnez au moins une fenêtre de tolérance complète et vérifiez ses limites.", "Seleziona almeno una finestra di tolleranza completa e controllane i limiti."],
  ["Enter valid limits for every enabled result filter.", "Für jeden aktivierten Ergebnisfilter gültige Grenzen eingeben.", "Saisissez des limites valides pour chaque filtre de résultats activé.", "Inserisci limiti validi per ogni filtro risultati abilitato."],
  ["Add at least one propellant to the synthesis list.", "Mindestens eine Treibladung zur Syntheseliste hinzufügen.", "Ajoutez au moins un propulsif à la liste de synthèse.", "Aggiungi almeno un propellente all'elenco di sintesi."],
  ["The synthesis contains %1 propellants and may take a long time. Continue?", "Die Synthese enthält %1 Treibladungen und kann lange dauern. Fortfahren?", "La synthèse contient %1 propulsifs et peut prendre beaucoup de temps. Continuer ?", "La sintesi contiene %1 propellenti e potrebbe richiedere molto tempo. Continuare?"],
  ["cancelled (%1 results)", "abgebrochen (%1 Ergebnisse)", "annulé (%1 résultats)", "annullato (%1 risultati)"],
  ["finished (%1 results)", "fertig (%1 Ergebnisse)", "terminé (%1 résultats)", "terminato (%1 risultati)"],
  ["Mass (%1)", "Masse (%1)", "Masse (%1)", "Massa (%1)"],
  ["Load ratio (%)", "Ladeverhältnis (%)", "Taux de chargement (%)", "Rapporto di caricamento (%)"],
  ["Burnt (%)", "Verbrannt (%)", "Brûlé (%)", "Bruciato (%)"],
  ["Efficiency (%)", "Wirkungsgrad (%)", "Rendement (%)", "Efficienza (%)"],
  ["Energy (%1)", "Energie (%1)", "Énergie (%1)", "Energia (%1)"],
  ["Parametric Powder Search results", "Ergebnisse der parametrischen Pulversuche", "Résultats de la recherche paramétrique de poudre", "Risultati della ricerca parametrica della polvere"],
  ["Result diagrams", "Ergebnisdiagramme", "Diagrammes de résultats", "Diagrammi dei risultati"],
  ["Applied synthesis result: %1", "Syntheseergebnis angewendet: %1", "Résultat de synthèse appliqué : %1", "Risultato della sintesi applicato: %1"]
];

const menu: readonly Localized[] = [
  ["&Wizard", "&Assistent", "&Assistant", "&Procedura guidata"],
  ["&Propellant Mass…", "&Treibladungsmasse…", "&Masse de propulsif…", "&Massa del propellente…"],
  ["Parametric Powder Search…", "Parametrische Pulversuche…", "Recherche paramétrique de poudre…", "Ricerca parametrica della polvere…"]
];

const languageIndex: Record<AppLanguage, number> = { en_US: 0, de_DE: 1, fr_FR: 2, it_IT: 3 };
const contexts = new Map<string, readonly Localized[]>([
  ["MainWindow", menu],
  ["PropellantMassWizard", [...shared, ...propellantMass]],
  ["ParametricPowderWizard", [...shared, ...parametric]]
]);

export function webCatalogText(language: AppLanguage, context: string, source: string): string | undefined {
  if (language === "en_US") return undefined;
  const message = contexts.get(context)?.find(([candidate]) => candidate === source);
  return message?.[languageIndex[language]];
}

export function webCatalogSources(context: string): readonly string[] {
  return contexts.get(context)?.map(([source]) => source) ?? [];
}

