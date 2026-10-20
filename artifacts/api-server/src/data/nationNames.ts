/**
 * 1.1.1 (Rob, 18 Oct): real women's first names and surnames for nations Rob's new senior pictures
 * bring that the game had no athletes of, so a picture player of that nation gets a real name of
 * her own country (utils/youthIntake.ts intakeNamePoolTx recombines these, as it does the shipped
 * athletes' names). At least 30 of each. A nation with athletes in the game is not listed: her name
 * comes from them, as every youth's does.
 */
export const NATION_NAMES: Readonly<Record<string, { first: readonly string[]; last: readonly string[] }>> = {
  Croatia: {
    first: ["Ana", "Ivana", "Petra", "Marija", "Lucija", "Ema", "Mia", "Sara", "Lana", "Nika", "Katarina", "Martina",
      "Iva", "Tea", "Dora", "Paula", "Lea", "Marta", "Klara", "Maja", "Nikolina", "Antonija", "Josipa", "Kristina",
      "Tena", "Mateja", "Helena", "Barbara", "Valentina", "Gabrijela", "Jelena", "Sanja"],
    last: ["Horvat", "Kovačević", "Babić", "Marić", "Jurić", "Novak", "Kovačić", "Knežević", "Vuković", "Marković",
      "Petrović", "Matić", "Tomić", "Pavlović", "Božić", "Blažević", "Grgić", "Pavić", "Radić", "Perić", "Kovač",
      "Šarić", "Lovrić", "Vidović", "Bošnjak", "Jukić", "Filipović", "Brkić", "Mlinarić", "Barišić", "Rukavina", "Galić"],
  },
  Finland: {
    first: ["Aino", "Emma", "Sofia", "Helmi", "Aada", "Ella", "Venla", "Lilja", "Iida", "Siiri", "Oona", "Pihla",
      "Enni", "Elsa", "Kerttu", "Linnea", "Saara", "Noora", "Johanna", "Laura", "Anna", "Maria", "Katja", "Riikka",
      "Tiina", "Hanna", "Satu", "Minna", "Sanna", "Elina", "Emilia", "Jenni"],
    last: ["Korhonen", "Virtanen", "Mäkinen", "Nieminen", "Mäkelä", "Hämäläinen", "Laine", "Heikkinen", "Koskinen",
      "Järvinen", "Lehtonen", "Lehtinen", "Saarinen", "Salminen", "Heinonen", "Niemi", "Heikkilä", "Kinnunen",
      "Salonen", "Turunen", "Salo", "Laitinen", "Tuominen", "Rantanen", "Karjalainen", "Jokinen", "Mattila",
      "Savolainen", "Lahtinen", "Ahonen", "Hiltunen", "Leinonen"],
  },
  Monaco: {
    first: ["Camille", "Charlotte", "Pauline", "Stéphanie", "Caroline", "Gabriella", "Alexandra", "Mélanie", "Léa",
      "Chloé", "Manon", "Inès", "Juliette", "Clara", "Élodie", "Margaux", "Amandine", "Laetitia", "Sophie", "Valentina",
      "Giulia", "Francesca", "Chiara", "Elena", "Océane", "Lucie", "Louise", "Anaïs", "Mathilde", "Coralie", "Victoria", "Emma"],
    last: ["Boéri", "Médecin", "Rey", "Gastaud", "Pastor", "Marsan", "Notari", "Bellando", "Cellario", "Fissore",
      "Gioffredo", "Lorenzi", "Mourou", "Novella", "Orecchia", "Pallanca", "Raimbert", "Sangiorgio", "Settimo",
      "Vatrican", "Viale", "Barral", "Blanchi", "Carpinelli", "Crovetto", "Fautrier", "Gramaglia", "Passeron",
      "Bosio", "Campora", "Pasquier", "Projetti"],
  },
};
