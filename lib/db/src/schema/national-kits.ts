/**
 * 1.1.3 (brief A4b, A5): every nation's kit, the colours its pair wears in the
 * Empire Nations Cup on the 3D court and on the podium (primary, secondary).
 *
 * "card": the national colours the AI club cards already wear (scripts/portraits/
 * ai-senior-cards.json, pictures brief 10 Oct); "flag": the nation's flag's two
 * main colours (flag-icons, public/images/flags), for a nation no card wears.
 * One line per nation continents.ts knows (harness/nations-cup.mjs checks it).
 * Pure data, no imports.
 */
export const NATIONAL_KITS: Readonly<Record<string, readonly [string, string]>> = {
  "Argentina": ["#74ACDF", "#1E3A8A"],   // card
  "Australia": ["#00843D", "#00843D"],   // card
  "Austria": ["#C01830", "#FFFFFF"],   // flag
  "Bahamas": ["#00D8D8", "#000000"],   // flag
  "Belgium": ["#000000", "#F01830"],   // flag
  "Bolivia": ["#D83018", "#007830"],   // flag
  "Brazil": ["#009C3B", "#002776"],   // card
  "Bulgaria": ["#009078", "#FFFFFF"],   // flag
  "Burkina Faso": ["#D80000", "#30A800"],   // flag
  "Canada": ["#D80621", "#D80621"],   // card
  "Chile": ["#D52B1E", "#0039A6"],   // card
  "China": ["#DE2910", "#DE2910"],   // card
  "Colombia": ["#FCD116", "#003893"],   // card
  "Cook Islands": ["#000060", "#C01830"],   // flag
  "Costa Rica": ["#0000C0", "#D80000"],   // flag
  "Croatia": ["#181890", "#FF0000"],   // flag
  "Cuba": ["#002A8F", "#CF142B"],   // card
  "Czech Republic": ["#D81818", "#FFFFFF"],   // flag
  "Denmark": ["#C01830", "#FFFFFF"],   // flag
  "Dominican Republic": ["#003060", "#D81830"],   // flag
  "Ecuador": ["#FFF000", "#D80018"],   // flag
  "Egypt": ["#CE1126", "#151515"],   // card
  "Ethiopia": ["#309000", "#F01818"],   // flag
  "Fiji": ["#0B2A6F", "#0B2A6F"],   // card
  "Finland": ["#003078", "#FFFFFF"],   // flag
  "France": ["#002395", "#ED2939"],   // card
  "Germany": ["#DD0000", "#151515"],   // card
  "Ghana": ["#FCD116", "#006B3F"],   // card
  "Greece": ["#0D5EAF", "#0D5EAF"],   // card
  "Hungary": ["#D83018", "#FFFFFF"],   // flag
  "Slovakia": ["#F01830", "#FFFFFF"],   // flag
  "Guinea": ["#FF0000", "#009000"],   // flag
  "Guatemala": ["#4890D8", "#FFFFFF"],   // flag
  "Guyana": ["#309000", "#D81818"],   // flag
  "Iceland": ["#003090", "#D83030"],   // flag
  "India": ["#0A1F6B", "#0A1F6B"],   // card
  "Indonesia": ["#CE1126", "#CE1126"],   // card
  "Iran": ["#D80000", "#FFFFFF"],   // flag
  "Ireland": ["#009048", "#FF7800"],   // flag
  "Italy": ["#0066CC", "#0066CC"],   // card
  "Ivory Coast": ["#FF9000", "#00D800"],   // flag
  "Jamaica": ["#009000", "#000000"],   // flag
  "Japan": ["#BC002D", "#BC002D"],   // card
  "Jordan": ["#FF0000", "#000000"],   // flag
  "Kiribati": ["#F04830", "#006090"],   // flag
  "Sri Lanka": ["#901830", "#FFC000"],   // flag
  "Kenya": ["#151515", "#BB0000"],   // card
  "Laos": ["#D81830", "#003060"],   // flag
  "Latvia": ["#901830", "#FFFFFF"],   // flag
  "Lebanon": ["#F01818", "#FFFFFF"],   // flag
  "Madagascar": ["#FF4830", "#FFFFFF"],   // flag
  "Malaysia": ["#CC0001", "#010066"],   // card
  "Maldives": ["#D81830", "#007830"],   // flag
  "Malta": ["#D81830", "#FFFFFF"],   // flag
  "Mauritius": ["#F03030", "#181878"],   // flag
  "Mexico": ["#006847", "#006847"],   // card
  "Micronesia": ["#6090D8", "#FFFFFF"],   // flag
  "Monaco": ["#F01830", "#FFFFFF"],   // flag
  "Morocco": ["#C1272D", "#006233"],   // card
  "Mozambique": ["#FFC000", "#009000"],   // flag
  "Netherlands": ["#FF6F00", "#FF6F00"],   // card
  "New Zealand": ["#151515", "#151515"],   // card
  "Nigeria": ["#008751", "#008751"],   // card
  "Norway": ["#F03030", "#003060"],   // flag
  "Oman": ["#F03030", "#009030"],   // flag
  "Pakistan": ["#186000", "#FFFFFF"],   // flag
  "Panama": ["#0000A8", "#FFFFFF"],   // flag
  "Papua New Guinea": ["#000000", "#FF0000"],   // flag
  "Paraguay": ["#D83018", "#0030A8"],   // flag
  "Peru": ["#D91023", "#D91023"],   // card
  "Philippines": ["#0038A8", "#CE1126"],   // card
  "Poland": ["#DC143C", "#DC143C"],   // card
  "Portugal": ["#FF0000", "#006000"],   // flag
  "Puerto Rico": ["#0050F0", "#ED0000"],   // card
  "Qatar": ["#901848", "#FFFFFF"],   // flag
  "Russia": ["#0030A8", "#FFFFFF"],   // flag
  "Samoa": ["#C8102E", "#C8102E"],   // card
  "Senegal": ["#007830", "#C00000"],   // flag
  "Serbia": ["#C03048", "#FFFFFF"],   // flag
  "Singapore": ["#D80000", "#FFFFFF"],   // flag
  "Solomon Islands": ["#0000D8", "#006000"],   // flag
  "South Africa": ["#007749", "#151515"],   // card
  "South Korea": ["#CD2E3A", "#0047A0"],   // card
  "Spain": ["#C60B1E", "#C60B1E"],   // card
  "Sudan": ["#000000", "#FF0000"],   // flag
  "Suriname": ["#307848", "#C00030"],   // flag
  "Sweden": ["#FECC02", "#006AA7"],   // card
  "Switzerland": ["#FF0000", "#FFFFFF"],   // flag
  "Tahiti": ["#D81818", "#FFFFFF"],   // flag
  "Taiwan": ["#FF0000", "#000090"],   // flag
  "Tanzania": ["#000000", "#009000"],   // flag
  "Thailand": ["#241D4F", "#241D4F"],   // card
  "Tonga": ["#C10000", "#151515"],   // card
  "Trinidad and Tobago": ["#D80000", "#000000"],   // flag
  "Tunisia": ["#F00018", "#FFFFFF"],   // flag
  "Turkey": ["#D80018", "#FFFFFF"],   // flag
  "Ukraine": ["#0060C0", "#FFD800"],   // flag
  "Uruguay": ["#6CACE4", "#6CACE4"],   // card
  "USA": ["#1B2A4A", "#B22234"],   // card
  "Vanuatu": ["#D21034", "#151515"],   // card
  "Venezuela": ["#FFCC00", "#00247D"],   // card
  "Vietnam": ["#D83018", "#FFFF00"],   // flag
  "United Kingdom": ["#C01830", "#FFFFFF"],   // flag
  "Zimbabwe": ["#006000", "#FFD800"],   // flag
  "UAE": ["#00732F", "#EF3340"],   // card
  "Saudi Arabia": ["#006C35", "#006C35"],   // card
  "Algeria": ["#006030", "#FFFFFF"],   // flag
  "Bahrain": ["#D81830", "#FFFFFF"],   // flag
  "Bangladesh": ["#006048", "#F03048"],   // flag
  "Cape Verde": ["#001878", "#FFFFFF"],   // flag
  "Estonia": ["#1890FF", "#000000"],   // flag
  "Haiti": ["#D81830", "#0018A8"],   // flag
  "Israel": ["#0030C0", "#FFFFFF"],   // flag
  "Kazakhstan": ["#00A8C0", "#FFF030"],   // flag
  "Kuwait": ["#00D848", "#F01830"],   // flag
  "Marshall Islands": ["#3060A8", "#FFFFFF"],   // flag
  "Mongolia": ["#D81830", "#0060A8"],   // flag
  "Nauru": ["#001878", "#FFA818"],   // flag
  "Palau": ["#48A8D8", "#FFD800"],   // flag
  "Romania": ["#0030A8", "#D81818"],   // flag
  "Rwanda": ["#00A8D8", "#F0D800"],   // flag
  "Slovenia": ["#D80000", "#0000C0"],   // flag
  "Tuvalu": ["#00A8C0", "#C01830"],   // flag
  "Uganda": ["#FFF000", "#000000"],   // flag
  "Uzbekistan": ["#18C030", "#FFFFFF"],   // flag
  "England": ["#D81830", "#FFFFFF"],   // flag
  "Scotland": ["#0060C0", "#FFFFFF"],   // flag
  "Wales": ["#00A830", "#FFFFFF"],   // flag
};

/** A nation's kit, or null (the caller then paints its plain fallback, loudly). */
export function nationalKit(nation: string | null | undefined): { primary: string; secondary: string } | null {
  const k = nation ? NATIONAL_KITS[nation] : undefined;
  return k ? { primary: k[0], secondary: k[1] } : null;
}
