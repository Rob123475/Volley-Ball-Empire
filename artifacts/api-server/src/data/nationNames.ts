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
  // 1.1.2 (Rob, 21 Oct): nations the FIXED new senior pictures bring that the game had no athletes of.
  // Kiribati and Micronesia: names as their women athletes and public figures carry them (Christian
  // given names, often in the local spelling, and family names); worth a look by someone who knows.
  Ukraine: {
    first: ["Anna", "Oksana", "Olena", "Iryna", "Nataliia", "Yuliia", "Kateryna", "Tetiana", "Svitlana", "Mariia",
      "Viktoriia", "Dariia", "Sofiia", "Anastasiia", "Khrystyna", "Halyna", "Liudmyla", "Nadiia", "Olha", "Valentyna",
      "Yana", "Alina", "Diana", "Zoriana", "Solomiia", "Bohdana", "Veronika", "Ivanna", "Larysa", "Inna", "Roksolana", "Marta"],
    last: ["Shevchenko", "Kovalenko", "Bondarenko", "Tkachenko", "Kravchenko", "Melnyk", "Boiko", "Kovalchuk",
      "Oliinyk", "Lysenko", "Marchenko", "Rudenko", "Savchenko", "Petrenko", "Klymenko", "Pavlenko", "Moroz",
      "Levchenko", "Kharchenko", "Ponomarenko", "Sydorenko", "Polishchuk", "Tkachuk", "Hrytsenko", "Yakovenko",
      "Kuzmenko", "Zinchenko", "Ostapenko", "Romanenko", "Bilyk", "Koval", "Didenko"],
  },
  Mauritius: {
    first: ["Aisha", "Anjali", "Priya", "Kavita", "Nadia", "Sabrina", "Marie", "Jessica", "Vanessa", "Shalini", "Deepa",
      "Natasha", "Sarika", "Pooja", "Leena", "Anoushka", "Émilie", "Laetitia", "Christelle", "Mélissa", "Yasmine",
      "Fatima", "Rekha", "Sneha", "Kamini", "Nisha", "Divya", "Sandrine", "Stéphanie", "Karine", "Mélanie", "Ravina"],
    last: ["Ramgoolam", "Jugnauth", "Duval", "Bhujun", "Ramdin", "Seegobin", "Gopaul", "Ramsamy", "Moonsamy",
      "Pillay", "Appadoo", "Lutchmun", "Soobrayen", "Boodhun", "Dookhun", "Ramphul", "Nundlall", "Hossen", "Peerally",
      "Joomun", "Rughoobur", "Govinden", "Chung", "Lebon", "Laval", "Perrine", "Bégué", "Fanchette", "Ramkissoon",
      "Beeharry", "Ah-Kee", "Bérenger"],
  },
  "Sri Lanka": {
    first: ["Nimali", "Dilani", "Chamari", "Sanduni", "Tharushi", "Kavindi", "Ishara", "Nadeesha", "Hasini", "Sachini",
      "Piumi", "Dinithi", "Amaya", "Hiruni", "Nethmi", "Oshadi", "Sewwandi", "Thilini", "Udeshika", "Kaushalya",
      "Malsha", "Nirosha", "Shashikala", "Inoka", "Anushka", "Harshitha", "Imesha", "Chathurika", "Dulani", "Gayani",
      "Madhavi", "Yasodara"],
    last: ["Perera", "Fernando", "de Silva", "Jayasuriya", "Wickramasinghe", "Bandara", "Gunawardena", "Senanayake",
      "Jayawardena", "Dissanayake", "Herath", "Ratnayake", "Wijesinghe", "Kumari", "Mendis", "Rathnayake",
      "Weerasinghe", "Samarasinghe", "Karunaratne", "Atapattu", "Liyanage", "Abeysekera", "Gamage", "Siriwardena",
      "Peiris", "Amarasinghe", "Ekanayake", "Wijeratne", "Ranasinghe", "Hettiarachchi", "Kodikara", "Rajapaksa"],
  },
  Guatemala: {
    first: ["María", "Ana", "Lucía", "Sofía", "Valeria", "Gabriela", "Daniela", "Andrea", "Fernanda", "Alejandra", "Carmen",
      "Rosa", "Paola", "Mariela", "Jimena", "Isabel", "Camila", "Mónica", "Brenda", "Karla", "Ingrid", "Claudia", "Wendy",
      "Heidy", "Ximena", "Lourdes", "Elena", "Patricia", "Marisol", "Yesenia", "Dulce", "Glenda"],
    last: ["López", "García", "Pérez", "Hernández", "González", "Rodríguez", "Morales", "Ramírez", "Méndez", "Castillo",
      "Cruz", "Ajú", "Xicay", "Tzoc", "Chávez", "Juárez", "Barrios", "Orellana", "Estrada", "Monterroso", "Cifuentes",
      "Aguilar", "Rosales", "Ordóñez", "Solórzano", "Recinos", "Coyoy", "Velásquez", "Sandoval", "Arévalo", "Batz", "Quiñónez"],
  },
  "Trinidad and Tobago": {
    first: ["Keisha", "Shania", "Kerry-Ann", "Alicia", "Natalie", "Aaliyah", "Michelle", "Simone", "Kimberly", "Shivani",
      "Anisa", "Priya", "Reshma", "Candice", "Jodi", "Tricia", "Shanice", "Nadia", "Kelly-Ann", "Ayana", "Jessica",
      "Danielle", "Tamika", "Rhea", "Kristen", "Sasha", "Alana", "Chelsea", "Nikita", "Asha", "Leah", "Celeste"],
    last: ["Mohammed", "Ramdass", "Baptiste", "Charles", "Joseph", "Phillip", "Williams", "Ali", "Rampersad", "Persad",
      "Maharaj", "Singh", "Boodram", "Seepersad", "Gopaul", "Alexander", "Pierre", "Thomas", "George", "Roberts",
      "Hosein", "Ramlal", "Lewis", "Rodney", "Bishop", "De Freitas", "Cudjoe", "Gonzales", "Mitchell", "Ramsaran",
      "Sookdeo", "Mahabir"],
  },
  Kiribati: {
    first: ["Meeri", "Ruta", "Tereza", "Mareta", "Kataraina", "Taabita", "Ioana", "Raieta", "Teretia", "Rosarina",
      "Tiare", "Marita", "Aanaa", "Rebeka", "Eretita", "Akineti", "Teresia", "Kaiea", "Riitia", "Bwenawa", "Teanna",
      "Rotia", "Tabwena", "Nemoa", "Tiabo", "Kiaeta", "Uriata", "Tekarei", "Erenaite", "Toaua", "Mataia", "Bitiana"],
    last: ["Tong", "Tito", "Maamau", "Tabai", "Teannaki", "Katoatau", "Mwemweata", "Tekeraoi", "Kaitu", "Kirata",
      "Tabuaka", "Iererua", "Teiwaki", "Bureimoa", "Taoaba", "Nenem", "Kabuati", "Tebano", "Tetabea", "Uriam",
      "Teburoro", "Ioane", "Kiriata", "Tekanene", "Namoriki", "Tiaon", "Nakekea", "Taburuea", "Mwea", "Tekeua",
      "Teinamati", "Arobati"],
  },
  Micronesia: {
    first: ["Mary", "Rose", "Grace", "Faith", "Joyleen", "Merleen", "Kerleen", "Lerleen", "Erleen", "Shirleen", "Josie",
      "Lisa", "Marilyn", "Ellen", "Teresa", "Lorrina", "Carmen", "Julie", "Anna", "Elina", "Sherleen", "Kathy", "Mercy",
      "Debbie", "Tina", "Rosalinda", "Maryann", "Evelyn", "Gertrude", "Lucy", "Sylvia", "Annie"],
    last: ["Mori", "Panuelo", "Christian", "Robert", "Falcam", "Urusemal", "Killion", "Edwin", "Hadley", "Moses",
      "Alik", "Fritz", "Hebel", "Ioanis", "Elias", "Halbert", "Sigrah", "Jackson", "Ehsa", "Etscheit", "Santos",
      "Joseph", "Ruben", "Andon", "Yinug", "Neth", "Ludwig", "George", "Narruhn", "Billimont", "Gallen", "Nakamura"],
  },
  Paraguay: {
    first: ["María", "Ana", "Lucía", "Sofía", "Camila", "Valentina", "Fátima", "Rocío", "Gabriela", "Natalia", "Belén",
      "Leticia", "Liz", "Lorena", "Mirian", "Nathalia", "Andrea", "Fernanda", "Mariana", "Alicia", "Graciela", "Raquel",
      "Teresa", "Viviana", "Jazmín", "Araceli", "Lourdes", "Celeste", "Dahiana", "Tamara", "Rossana", "Gisela"],
    last: ["Benítez", "González", "Martínez", "Giménez", "Ramírez", "Acosta", "Ortiz", "Duarte", "Vera", "Cáceres",
      "Sanabria", "Báez", "Villalba", "Ayala", "Ojeda", "Rojas", "Cabrera", "Fernández", "Insfrán", "Riquelme",
      "Paredes", "Gamarra", "Domínguez", "Cardozo", "Escobar", "Florentín", "Aquino", "Brítez", "Galeano", "Ledesma",
      "Amarilla", "Zárate"],
  },
  Suriname: {
    first: ["Shanti", "Priya", "Anjali", "Sharmila", "Natasha", "Chantal", "Jennifer", "Esther", "Ilse", "Naomi",
      "Kimberly", "Rachel", "Sabrina", "Anisha", "Sita", "Radha", "Indra", "Yvonne", "Marlies", "Melanie", "Gianna",
      "Kiran", "Reshma", "Ayasha", "Wendy", "Romy", "Sarita", "Nadia", "Shirley", "Ruth", "Gerda", "Inge"],
    last: ["Ramdin", "Venetiaan", "Santokhi", "Brunswijk", "Wijdenbosch", "Sedney", "Kartosen", "Pinas", "Biswamitre",
      "Sardjoe", "Ramsaran", "Jagernath", "Ramlakhan", "Soekhoe", "Kromodimedjo", "Wongsodikromo", "Abdoel", "Doekhie",
      "Kanhai", "Mahabier", "Bhagwandin", "Tjin-A-Djie", "Fung-A-Loi", "Linger", "Pengel", "Ronde", "Lachmon",
      "Misiekaba", "Somohardjo", "Adhin", "Moestadja", "Lie-A-Ling"],
  },
};
