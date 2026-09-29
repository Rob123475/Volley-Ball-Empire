/**
 * Unity brief item 18 (Rob, 29 Sep): the starter DB's 72 academy players were
 * renamed (all women now: Eleni Stavrou, Litia Vakatale...), but existing saves
 * kept the old rows (Rob's: Katarina Novak, Marco Ricci, Tomas Krejci...) with
 * demonym nationalities ("Croatian"): the boot-time reference sync never
 * touches a player's name or nationality, because the player can edit them.
 *
 * The same approach as staff (P-11, utils/staffNameHistory.ts): if a save still
 * holds a [name, nationality] pair the STARTER DB itself shipped for that id,
 * nobody typed it, and ensureReferenceData() brings the row up to date (name,
 * nationality, position and continent together). Any other name is the
 * player's and is left alone.
 *
 * Built from every committed version of lib/db/volleyball-empire.sqlite
 * (55 versions, first-seen order), not from memory. Whenever a youth player's
 * name changes in the starter DB, add the pair it had here.
 */
export const PREVIOUS_YOUTH_IDENTITIES: Readonly<Record<number, readonly (readonly [string, string | null])[]>> = {
  211: [["Katarina Novak", "Croatian"], ["Katarina Novak", "Croatia"]],   // now Eleni Stavrou (Greece)
  212: [["Lena Fischer", "German"]],   // now Lena Fischer (Germany)
  213: [["Marco Ricci", "Italian"]],   // now Litia Vakatale (Fiji)
  214: [["Sofia Andersen", "Danish"], ["Sofia Andersen", "Denmark"]],   // now Lea Brunner (Switzerland)
  215: [["Tomáš Krejčí", "Czech"]],   // now Naomi Kaupa (Papua New Guinea)
  216: [["Maja Larsson", "Swedish"]],   // now Maja Larsson (Sweden)
  217: [["Pierre Dubois", "French"]],   // now Ana Halatanu (Tonga)
  218: [["Elena Kozlova", "Russian"], ["Elena Kozlova", "Russia"]],   // now Chiara Moretti (Italy)
  219: [["Nikos Papadopoulos", "Greek"]],   // now Rosalyn Kenneth (Vanuatu)
  220: [["Inês Santos", "Portuguese"]],   // now Inês Santos (Portugal)
  221: [["Lukas Weber", "Swiss"]],   // now Elsie Aru (Solomon Islands)
  222: [["Agnieszka Wiśniewska", "Polish"], ["Agnieszka Wiśniewska", "Poland"]],   // now Amelia Whitfield (England)
  223: [["Bart van der Berg", "Dutch"]],   // now Teuira Tepava (Cook Islands)
  224: [["Karin Egilsdóttir", "Icelandic"], ["Karin Egilsdóttir", "Iceland"]],   // now Sanne de Jong (Netherlands)
  225: [["Dmitri Volkov", "Ukrainian"], ["Oksana Volkova", "Ukraine"]],   // now Camille Laurent (France)
  226: [["Valentina Iordanova", "Bulgarian"], ["Valentina Iordanova", "Bulgaria"]],   // now Johanna Vogt (Germany)
  227: [["Søren Christiansen", "Danish"], ["Freja Christiansen", "Denmark"]],   // now Giulia Fontana (Italy)
  228: [["Miriam Almeida", "Spanish"]],   // now Miriam Almeida (Spain)
  229: [["Gabriel Ferreira", "Brazilian"]],   // now Gabriela Ferreira (Brazil)
  230: [["Valentina Cruz", "Argentine"]],   // now Valentina Cruz (Argentina)
  231: [["Diego Mendoza", "Colombian"]],   // now Daniela Mendoza (Colombia)
  232: [["Fernanda Lima", "Brazilian"]],   // now Fernanda Lima (Brazil)
  233: [["Santiago Vega", "Peruvian"]],   // now Sofía Vega (Peru)
  234: [["Camila Torres", "Chilean"]],   // now Catalina Torres (Chile)
  235: [["Lucas Oliveira", "Brazilian"]],   // now Luciana Mamani (Bolivia)
  236: [["Mariana Salazar", "Ecuadorian"]],   // now Mariana Salazar (Ecuador)
  237: [["Rodrigo Castillo", "Venezuelan"]],   // now Rosalba Castillo (Venezuela)
  238: [["Ana Paula Nascimento", "Brazilian"]],   // now Paola Duarte (Uruguay)
  239: [["Emilio Vargas", "Paraguayan"]],   // now Shonette Persaud (Guyana)
  240: [["Isabella Ramos", "Argentine"]],   // now Isabella Ramos (Argentina)
  241: [["Yuki Tanaka", "Japanese"]],   // now Yuki Tanaka (Japan)
  242: [["Hao Chen", "Chinese"]],   // now Shanice Beckford (Jamaica)
  243: [["Min-Ji Park", "South Korean"]],   // now Chanya Suwannarat (Thailand)
  244: [["Ravi Sharma", "Indian"]],   // now Yarelis Colón (Puerto Rico)
  245: [["Nguyen Thi Lan", "Vietnamese"]],   // now Nguyen Thi Lan (Vietnam)
  246: [["Kenji Watanabe", "Japanese"]],   // now Rin Watanabe (Japan)
  247: [["Li Wei", "Chinese"]],   // now Lin Xiaowei (China)
  248: [["Arjun Mehta", "Indian"]],   // now Ananya Mehta (India)
  249: [["Park Ji-Young", "South Korean"]],   // now Hsu Mei-Ling (Taiwan)
  250: [["Muhammad Fariz", "Malaysian"]],   // now Nurul Fariza (Malaysia)
  251: [["Sakura Yamamoto", "Japanese"]],   // now Siti Rahmawati (Indonesia)
  252: [["Chen Ming", "Chinese"]],   // now Chen Yuxuan (China)
  253: [["Priya Nair", "Indian"]],   // now Kristine Reyes (Philippines)
  254: [["Tran Minh Duc", "Vietnamese"]],   // now Souphaphone Vongsa (Laos)
  255: [["Tyler Johnson", "American"]],   // now Taylor Johnson (USA)
  256: [["Alexis Rivera", "Mexican"]],   // now Alexis Rivera (Mexico)
  257: [["Connor MacLeod", "Canadian"]],   // now Chloe MacLeod (Canada)
  258: [["Gabriela Flores", "Mexican"]],   // now Kaydene Ferguson (Bahamas)
  259: [["Mason Brooks", "American"]],   // now Madison Brooks (USA)
  260: [["Sofia Hernandez", "Cuban"]],   // now Sofia Hernandez (Cuba)
  261: [["Jake Henderson", "American"]],   // now Valeria Jiménez (Costa Rica)
  262: [["Natalie Tremblay", "Canadian"]],   // now Natalie Tremblay (Canada)
  263: [["Carlos Ortega", "Dominican"]],   // now Carla Ortega (Dominican Republic)
  264: [["Mia Lawson", "American"]],   // now Danelys Batista (Panama)
  265: [["Amara Diallo", "Senegalese"], ["Amara Diallo", "Senegal"]],   // now Ana Chissano (Mozambique)
  266: [["Kwame Asante", "Ghanaian"]],   // now Hina Teriipaia (Tahiti)
  267: [["Fatima Nkosi", "South African"]],   // now Fatima Nkosi (South Africa)
  268: [["Ibrahim Koné", "Ivorian"]],   // now Anahera Ngata (New Zealand)
  269: [["Zola Dlamini", "South African"]],   // now Zola Dlamini (South Africa)
  270: [["Emmanuel Osei", "Ghanaian"], ["Abena Owusu", "Ghana"]],   // now Sarra Bouazizi (Tunisia)
  271: [["Aissatou Balde", "Guinean"], ["Aissatou Balde", "Guinea"]],   // now Wanjiru Kamau (Kenya)
  272: [["Samuel Mensah", "Ghanaian"], ["Efua Boateng", "Ghana"]],   // now Hasina Rakoto (Madagascar)
  273: [["Nadia Ouedraogo", "Burkinabe"], ["Nadia Ouedraogo", "Burkina Faso"]],   // now Rudo Chikafu (Zimbabwe)
  274: [["Chidi Okafor", "Nigerian"]],   // now Chiamaka Okafor (Nigeria)
  275: [["Callum O'Brien", "Australian"]],   // now Caitlin O’Brien (Australia)
  276: [["Aroha Tane", "New Zealander"]],   // now Aroha Tane (New Zealand)
  277: [["Jayden Walsh", "Australian"]],   // now Jayda Walsh (Australia)
  278: [["Moana Faleolo", "Samoan"]],   // now Moana Faleolo (Samoa)
  279: [["Omar Hassan", "Egyptian"]],   // now Nadia Hassan (Egypt)
  280: [["Layla Al-Rashid", "Jordanian"], ["Layla Al-Rashid", "Jordan"]],   // now Neema Mwakalinga (Tanzania)
  281: [["Karim Mansour", "Moroccan"]],   // now Yasmine Mansour (Morocco)
  282: [["Reem Al-Farsi", "Omani"], ["Reem Al-Farsi", "Oman"]],   // now Habiba Farouk (Egypt)
};
