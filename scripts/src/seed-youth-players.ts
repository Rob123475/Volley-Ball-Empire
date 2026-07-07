/**
 * Replaces all youth players (playerType='youth') with 72 V2 card records.
 * One shared image uploaded once, reused for all cards.
 * Run: pnpm --filter @workspace/scripts run seed-youth-players
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");
const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as object,
  projectId: "",
});

async function upload(localFile: string, entityId: string): Promise<string> {
  const privateDir = PRIVATE_OBJECT_DIR.endsWith("/") ? PRIVATE_OBJECT_DIR : `${PRIVATE_OBJECT_DIR}/`;
  const parts = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = parts.indexOf("/");
  const bucketName = slashIdx === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slashIdx);
  const prefix = slashIdx === -1 ? "" : parts.slice(slashIdx + 1);
  await gcs.bucket(bucketName).file(`${prefix}${entityId}`).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `/objects/${entityId}`;
}

function potentialLabel(stars: number): string {
  if (stars >= 4.5) return "Elite";
  if (stars >= 3.5) return "High";
  if (stars >= 2.5) return "Average";
  return "Below Average";
}

function scoutedPotentialLabel(stars: number): string {
  const roll = Math.random();
  if (roll < 0.20) {
    if (stars >= 4.5) return "High";
    if (stars >= 3.5) return "Average";
    return "Below Average";
  }
  if (roll < 0.10) {
    if (stars <= 3.0) return "High";
    if (stars <= 4.0) return "Elite";
  }
  return potentialLabel(stars);
}

type YouthRow = {
  name: string; nationality: string; age: number; gender: string;
  heightCm: number; position: string; currentStars: number; potentialStars: number;
  serve: number; power: number; block: number; defense: number;
  speed: number; stamina: number; morale: number; salary: number;
  contractYears: number; developmentCurve: string; playStyle: string;
};

const PLAYERS: YouthRow[] = [
  // ── EUROPE (18) ───────────────────────────────────────────────────────────
  { name:"Katarina Novak",       nationality:"Croatian",     age:16, gender:"Female", heightCm:173, position:"blocker",     currentStars:2.0, potentialStars:4.0, serve:46, power:50, block:52, defense:44, speed:50, stamina:48, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Lena Fischer",         nationality:"German",       age:17, gender:"Female", heightCm:178, position:"defender",    currentStars:2.5, potentialStars:4.5, serve:50, power:46, block:46, defense:58, speed:60, stamina:56, morale:88, salary:0, contractYears:2, developmentCurve:"Late Bloomer",            playStyle:"Fast Defender"       },
  { name:"Marco Ricci",          nationality:"Italian",      age:18, gender:"Male",   heightCm:189, position:"blocker",     currentStars:3.0, potentialStars:4.0, serve:58, power:64, block:68, defense:52, speed:54, stamina:60, morale:84, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Sofia Andersen",       nationality:"Danish",       age:15, gender:"Female", heightCm:168, position:"all_rounder", currentStars:1.5, potentialStars:3.5, serve:40, power:38, block:38, defense:40, speed:44, stamina:42, morale:80, salary:0, contractYears:1, developmentCurve:"Coach Dependent",        playStyle:"Smart Positioner"    },
  { name:"Tomáš Krejčí",         nationality:"Czech",        age:17, gender:"Male",   heightCm:183, position:"defender",    currentStars:2.0, potentialStars:3.0, serve:44, power:46, block:44, defense:52, speed:54, stamina:50, morale:78, salary:0, contractYears:2, developmentCurve:"Inconsistent Prospect",  playStyle:"Technical Defender"  },
  { name:"Maja Larsson",         nationality:"Swedish",      age:16, gender:"Female", heightCm:175, position:"blocker",     currentStars:2.5, potentialStars:5.0, serve:52, power:56, block:58, defense:46, speed:52, stamina:54, morale:90, salary:0, contractYears:2, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },
  { name:"Pierre Dubois",        nationality:"French",       age:19, gender:"Male",   heightCm:186, position:"all_rounder", currentStars:3.0, potentialStars:3.5, serve:62, power:62, block:58, defense:60, speed:58, stamina:62, morale:82, salary:0, contractYears:3, developmentCurve:"Fast Starter",           playStyle:"All-Rounder"         },
  { name:"Elena Kozlova",        nationality:"Russian",      age:15, gender:"Female", heightCm:170, position:"defender",    currentStars:1.5, potentialStars:4.0, serve:38, power:36, block:36, defense:44, speed:46, stamina:42, morale:80, salary:0, contractYears:1, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Nikos Papadopoulos",   nationality:"Greek",        age:18, gender:"Male",   heightCm:188, position:"blocker",     currentStars:2.5, potentialStars:3.5, serve:54, power:58, block:60, defense:48, speed:50, stamina:56, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Inês Santos",          nationality:"Portuguese",   age:17, gender:"Female", heightCm:172, position:"all_rounder", currentStars:2.0, potentialStars:4.0, serve:46, power:48, block:46, defense:48, speed:52, stamina:50, morale:84, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Smart Positioner"    },
  { name:"Lukas Weber",          nationality:"Swiss",        age:16, gender:"Male",   heightCm:181, position:"defender",    currentStars:1.5, potentialStars:3.0, serve:38, power:40, block:38, defense:44, speed:46, stamina:44, morale:76, salary:0, contractYears:1, developmentCurve:"Inconsistent Prospect",  playStyle:"Fast Defender"       },
  { name:"Agnieszka Wiśniewska", nationality:"Polish",       age:18, gender:"Female", heightCm:176, position:"blocker",     currentStars:3.0, potentialStars:4.5, serve:58, power:62, block:66, defense:50, speed:52, stamina:58, morale:88, salary:0, contractYears:3, developmentCurve:"Big Match Riser",        playStyle:"Power Blocker"       },
  { name:"Bart van der Berg",    nationality:"Dutch",        age:17, gender:"Male",   heightCm:190, position:"all_rounder", currentStars:2.5, potentialStars:4.0, serve:52, power:56, block:54, defense:54, speed:56, stamina:56, morale:84, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Karin Egilsdóttir",    nationality:"Icelandic",    age:15, gender:"Female", heightCm:167, position:"defender",    currentStars:1.5, potentialStars:3.5, serve:36, power:36, block:34, defense:44, speed:46, stamina:42, morale:80, salary:0, contractYears:1, developmentCurve:"Late Bloomer",            playStyle:"Fast Defender"       },
  { name:"Dmitri Volkov",        nationality:"Ukrainian",    age:19, gender:"Male",   heightCm:187, position:"blocker",     currentStars:3.0, potentialStars:3.5, serve:60, power:64, block:68, defense:50, speed:52, stamina:62, morale:80, salary:0, contractYears:3, developmentCurve:"Fast Starter",           playStyle:"Power Blocker"       },
  { name:"Valentina Iordanova",  nationality:"Bulgarian",    age:16, gender:"Female", heightCm:171, position:"all_rounder", currentStars:2.0, potentialStars:4.5, serve:46, power:48, block:46, defense:48, speed:52, stamina:50, morale:86, salary:0, contractYears:2, developmentCurve:"High Ceiling Raw Talent", playStyle:"All-Rounder"         },
  { name:"Søren Christiansen",   nationality:"Danish",       age:18, gender:"Male",   heightCm:185, position:"defender",    currentStars:2.5, potentialStars:3.0, serve:54, power:50, block:48, defense:58, speed:60, stamina:56, morale:78, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Technical Defender"  },
  { name:"Miriam Almeida",       nationality:"Spanish",      age:17, gender:"Female", heightCm:174, position:"blocker",     currentStars:3.5, potentialStars:5.0, serve:66, power:72, block:74, defense:54, speed:56, stamina:64, morale:92, salary:0, contractYears:3, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },

  // ── SOUTH AMERICA (12) ────────────────────────────────────────────────────
  { name:"Gabriel Ferreira",     nationality:"Brazilian",    age:17, gender:"Male",   heightCm:192, position:"blocker",     currentStars:3.5, potentialStars:5.0, serve:68, power:74, block:76, defense:52, speed:58, stamina:66, morale:94, salary:0, contractYears:3, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },
  { name:"Valentina Cruz",       nationality:"Argentine",    age:15, gender:"Female", heightCm:166, position:"defender",    currentStars:1.5, potentialStars:4.0, serve:38, power:36, block:34, defense:44, speed:48, stamina:42, morale:82, salary:0, contractYears:1, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Diego Mendoza",        nationality:"Colombian",    age:18, gender:"Male",   heightCm:184, position:"all_rounder", currentStars:2.5, potentialStars:3.5, serve:54, power:56, block:52, defense:54, speed:56, stamina:58, morale:84, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Fernanda Lima",        nationality:"Brazilian",    age:16, gender:"Female", heightCm:177, position:"blocker",     currentStars:3.0, potentialStars:4.5, serve:58, power:64, block:66, defense:48, speed:52, stamina:60, morale:88, salary:0, contractYears:2, developmentCurve:"Big Match Riser",        playStyle:"Power Blocker"       },
  { name:"Santiago Vega",        nationality:"Peruvian",     age:17, gender:"Male",   heightCm:182, position:"defender",    currentStars:2.0, potentialStars:3.5, serve:44, power:46, block:44, defense:52, speed:56, stamina:50, morale:80, salary:0, contractYears:2, developmentCurve:"Inconsistent Prospect",  playStyle:"Fast Defender"       },
  { name:"Camila Torres",        nationality:"Chilean",      age:19, gender:"Female", heightCm:172, position:"all_rounder", currentStars:2.5, potentialStars:4.0, serve:52, power:52, block:50, defense:54, speed:58, stamina:56, morale:84, salary:0, contractYears:3, developmentCurve:"Steady Improver",        playStyle:"Smart Positioner"    },
  { name:"Lucas Oliveira",       nationality:"Brazilian",    age:15, gender:"Male",   heightCm:180, position:"blocker",     currentStars:1.5, potentialStars:4.5, serve:38, power:42, block:44, defense:36, speed:46, stamina:44, morale:84, salary:0, contractYears:1, developmentCurve:"High Ceiling Raw Talent", playStyle:"Raw Athlete"         },
  { name:"Mariana Salazar",      nationality:"Ecuadorian",   age:18, gender:"Female", heightCm:169, position:"defender",    currentStars:2.0, potentialStars:3.0, serve:44, power:44, block:42, defense:52, speed:54, stamina:50, morale:78, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Technical Defender"  },
  { name:"Rodrigo Castillo",     nationality:"Venezuelan",   age:17, gender:"Male",   heightCm:186, position:"all_rounder", currentStars:2.5, potentialStars:3.5, serve:52, power:56, block:52, defense:54, speed:56, stamina:56, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Ana Paula Nascimento", nationality:"Brazilian",    age:16, gender:"Female", heightCm:175, position:"blocker",     currentStars:2.5, potentialStars:4.0, serve:52, power:56, block:58, defense:46, speed:52, stamina:54, morale:86, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Emilio Vargas",        nationality:"Paraguayan",   age:19, gender:"Male",   heightCm:183, position:"defender",    currentStars:3.0, potentialStars:3.5, serve:60, power:58, block:52, defense:64, speed:62, stamina:62, morale:80, salary:0, contractYears:3, developmentCurve:"Fast Starter",           playStyle:"Fast Defender"       },
  { name:"Isabella Ramos",       nationality:"Argentine",    age:15, gender:"Female", heightCm:165, position:"all_rounder", currentStars:1.5, potentialStars:3.5, serve:38, power:38, block:36, defense:42, speed:44, stamina:40, morale:80, salary:0, contractYears:1, developmentCurve:"Late Bloomer",           playStyle:"Smart Positioner"    },

  // ── ASIA (14) ─────────────────────────────────────────────────────────────
  { name:"Yuki Tanaka",          nationality:"Japanese",     age:16, gender:"Female", heightCm:168, position:"defender",    currentStars:2.5, potentialStars:4.0, serve:50, power:46, block:44, defense:58, speed:62, stamina:56, morale:86, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Technical Defender"  },
  { name:"Hao Chen",             nationality:"Chinese",      age:18, gender:"Male",   heightCm:193, position:"blocker",     currentStars:3.0, potentialStars:4.5, serve:58, power:64, block:70, defense:50, speed:52, stamina:60, morale:86, salary:0, contractYears:2, developmentCurve:"Big Match Riser",        playStyle:"Power Blocker"       },
  { name:"Min-Ji Park",          nationality:"South Korean", age:17, gender:"Female", heightCm:171, position:"all_rounder", currentStars:2.0, potentialStars:4.0, serve:46, power:48, block:46, defense:50, speed:54, stamina:50, morale:84, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Smart Positioner"    },
  { name:"Ravi Sharma",          nationality:"Indian",       age:15, gender:"Male",   heightCm:178, position:"defender",    currentStars:1.5, potentialStars:3.0, serve:38, power:38, block:36, defense:44, speed:48, stamina:42, morale:76, salary:0, contractYears:1, developmentCurve:"Inconsistent Prospect",  playStyle:"Fast Defender"       },
  { name:"Nguyen Thi Lan",       nationality:"Vietnamese",   age:19, gender:"Female", heightCm:167, position:"blocker",     currentStars:2.5, potentialStars:3.5, serve:52, power:54, block:58, defense:46, speed:50, stamina:54, morale:80, salary:0, contractYears:3, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Kenji Watanabe",       nationality:"Japanese",     age:16, gender:"Male",   heightCm:182, position:"all_rounder", currentStars:2.0, potentialStars:3.5, serve:46, power:48, block:46, defense:48, speed:52, stamina:50, morale:82, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"All-Rounder"         },
  { name:"Li Wei",               nationality:"Chinese",      age:17, gender:"Female", heightCm:174, position:"defender",    currentStars:3.0, potentialStars:4.5, serve:56, power:52, block:50, defense:64, speed:64, stamina:60, morale:88, salary:0, contractYears:2, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Arjun Mehta",          nationality:"Indian",       age:18, gender:"Male",   heightCm:185, position:"blocker",     currentStars:2.0, potentialStars:3.0, serve:46, power:50, block:52, defense:42, speed:48, stamina:50, morale:78, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Park Ji-Young",        nationality:"South Korean", age:15, gender:"Female", heightCm:166, position:"all_rounder", currentStars:1.5, potentialStars:4.0, serve:36, power:38, block:36, defense:40, speed:44, stamina:40, morale:82, salary:0, contractYears:1, developmentCurve:"High Ceiling Raw Talent", playStyle:"Raw Athlete"         },
  { name:"Muhammad Fariz",       nationality:"Malaysian",    age:17, gender:"Male",   heightCm:180, position:"defender",    currentStars:2.5, potentialStars:3.5, serve:52, power:50, block:48, defense:58, speed:60, stamina:56, morale:80, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Fast Defender"       },
  { name:"Sakura Yamamoto",      nationality:"Japanese",     age:16, gender:"Female", heightCm:170, position:"blocker",     currentStars:2.5, potentialStars:4.5, serve:52, power:56, block:58, defense:46, speed:52, stamina:54, morale:88, salary:0, contractYears:2, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },
  { name:"Chen Ming",            nationality:"Chinese",      age:19, gender:"Male",   heightCm:191, position:"all_rounder", currentStars:3.0, potentialStars:3.5, serve:62, power:62, block:58, defense:58, speed:58, stamina:62, morale:82, salary:0, contractYears:3, developmentCurve:"Fast Starter",           playStyle:"All-Rounder"         },
  { name:"Priya Nair",           nationality:"Indian",       age:15, gender:"Female", heightCm:163, position:"defender",    currentStars:1.5, potentialStars:3.0, serve:36, power:34, block:32, defense:44, speed:46, stamina:40, morale:78, salary:0, contractYears:1, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Tran Minh Duc",        nationality:"Vietnamese",   age:18, gender:"Male",   heightCm:181, position:"blocker",     currentStars:2.5, potentialStars:4.0, serve:54, power:58, block:60, defense:46, speed:52, stamina:56, morale:84, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },

  // ── NORTH AMERICA (10) ────────────────────────────────────────────────────
  { name:"Tyler Johnson",        nationality:"American",     age:18, gender:"Male",   heightCm:190, position:"blocker",     currentStars:3.0, potentialStars:4.0, serve:60, power:64, block:68, defense:50, speed:54, stamina:62, morale:86, salary:0, contractYears:2, developmentCurve:"Big Match Riser",        playStyle:"Power Blocker"       },
  { name:"Alexis Rivera",        nationality:"Mexican",      age:16, gender:"Female", heightCm:169, position:"all_rounder", currentStars:2.0, potentialStars:4.0, serve:46, power:48, block:46, defense:50, speed:54, stamina:50, morale:84, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Smart Positioner"    },
  { name:"Connor MacLeod",       nationality:"Canadian",     age:17, gender:"Male",   heightCm:185, position:"defender",    currentStars:2.5, potentialStars:3.5, serve:52, power:50, block:48, defense:58, speed:60, stamina:56, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Technical Defender"  },
  { name:"Gabriela Flores",      nationality:"Mexican",      age:15, gender:"Female", heightCm:165, position:"blocker",     currentStars:1.5, potentialStars:3.5, serve:38, power:40, block:42, defense:36, speed:44, stamina:42, morale:80, salary:0, contractYears:1, developmentCurve:"High Ceiling Raw Talent", playStyle:"Raw Athlete"         },
  { name:"Mason Brooks",         nationality:"American",     age:19, gender:"Male",   heightCm:188, position:"all_rounder", currentStars:3.0, potentialStars:3.5, serve:62, power:62, block:58, defense:58, speed:58, stamina:62, morale:80, salary:0, contractYears:3, developmentCurve:"Fast Starter",           playStyle:"All-Rounder"         },
  { name:"Sofia Hernandez",      nationality:"Cuban",        age:17, gender:"Female", heightCm:174, position:"defender",    currentStars:2.5, potentialStars:4.5, serve:50, power:48, block:46, defense:60, speed:62, stamina:58, morale:88, salary:0, contractYears:2, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Jake Henderson",       nationality:"American",     age:16, gender:"Male",   heightCm:184, position:"blocker",     currentStars:2.0, potentialStars:4.0, serve:46, power:50, block:52, defense:42, speed:50, stamina:50, morale:84, salary:0, contractYears:2, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },
  { name:"Natalie Tremblay",     nationality:"Canadian",     age:18, gender:"Female", heightCm:176, position:"all_rounder", currentStars:3.0, potentialStars:4.5, serve:58, power:60, block:56, defense:58, speed:60, stamina:60, morale:90, salary:0, contractYears:3, developmentCurve:"Big Match Riser",        playStyle:"All-Rounder"         },
  { name:"Carlos Ortega",        nationality:"Dominican",    age:15, gender:"Male",   heightCm:178, position:"defender",    currentStars:1.5, potentialStars:3.0, serve:36, power:38, block:36, defense:44, speed:46, stamina:42, morale:78, salary:0, contractYears:1, developmentCurve:"Coach Dependent",        playStyle:"Fast Defender"       },
  { name:"Mia Lawson",           nationality:"American",     age:17, gender:"Female", heightCm:173, position:"blocker",     currentStars:2.5, potentialStars:5.0, serve:52, power:58, block:60, defense:46, speed:54, stamina:56, morale:92, salary:0, contractYears:2, developmentCurve:"High Ceiling Raw Talent", playStyle:"Explosive Attacker"  },

  // ── AFRICA (10) ───────────────────────────────────────────────────────────
  { name:"Amara Diallo",         nationality:"Senegalese",   age:17, gender:"Female", heightCm:172, position:"blocker",     currentStars:2.5, potentialStars:4.0, serve:52, power:56, block:58, defense:46, speed:54, stamina:56, morale:86, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Kwame Asante",         nationality:"Ghanaian",     age:16, gender:"Male",   heightCm:183, position:"all_rounder", currentStars:2.0, potentialStars:3.5, serve:46, power:50, block:48, defense:48, speed:54, stamina:52, morale:82, salary:0, contractYears:2, developmentCurve:"Inconsistent Prospect",  playStyle:"Raw Athlete"         },
  { name:"Fatima Nkosi",         nationality:"South African",age:18, gender:"Female", heightCm:175, position:"defender",    currentStars:3.0, potentialStars:4.5, serve:56, power:50, block:48, defense:64, speed:64, stamina:60, morale:88, salary:0, contractYears:2, developmentCurve:"Big Match Riser",        playStyle:"Fast Defender"       },
  { name:"Ibrahim Koné",         nationality:"Ivorian",      age:15, gender:"Male",   heightCm:182, position:"blocker",     currentStars:1.5, potentialStars:3.5, serve:36, power:42, block:44, defense:34, speed:46, stamina:42, morale:80, salary:0, contractYears:1, developmentCurve:"High Ceiling Raw Talent", playStyle:"Raw Athlete"         },
  { name:"Zola Dlamini",         nationality:"South African",age:19, gender:"Female", heightCm:170, position:"all_rounder", currentStars:2.5, potentialStars:3.5, serve:52, power:52, block:50, defense:54, speed:58, stamina:56, morale:82, salary:0, contractYears:3, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Emmanuel Osei",        nationality:"Ghanaian",     age:17, gender:"Male",   heightCm:185, position:"defender",    currentStars:2.0, potentialStars:4.0, serve:44, power:46, block:44, defense:52, speed:56, stamina:52, morale:84, salary:0, contractYears:2, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Aissatou Balde",       nationality:"Guinean",      age:16, gender:"Female", heightCm:167, position:"blocker",     currentStars:2.0, potentialStars:3.5, serve:44, power:48, block:50, defense:42, speed:48, stamina:48, morale:82, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Power Blocker"       },
  { name:"Samuel Mensah",        nationality:"Ghanaian",     age:18, gender:"Male",   heightCm:184, position:"all_rounder", currentStars:2.5, potentialStars:3.0, serve:54, power:54, block:52, defense:54, speed:56, stamina:56, morale:78, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Nadia Ouedraogo",      nationality:"Burkinabe",    age:15, gender:"Female", heightCm:164, position:"defender",    currentStars:1.5, potentialStars:4.0, serve:36, power:34, block:32, defense:44, speed:48, stamina:42, morale:82, salary:0, contractYears:1, developmentCurve:"Late Bloomer",            playStyle:"Fast Defender"       },
  { name:"Chidi Okafor",         nationality:"Nigerian",     age:17, gender:"Male",   heightCm:188, position:"blocker",     currentStars:2.5, potentialStars:3.5, serve:54, power:58, block:60, defense:46, speed:52, stamina:56, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },

  // ── OCEANIA (4) ───────────────────────────────────────────────────────────
  { name:"Callum O'Brien",       nationality:"Australian",   age:18, gender:"Male",   heightCm:189, position:"blocker",     currentStars:3.0, potentialStars:4.0, serve:60, power:64, block:68, defense:50, speed:54, stamina:62, morale:84, salary:0, contractYears:2, developmentCurve:"Big Match Riser",        playStyle:"Power Blocker"       },
  { name:"Aroha Tane",           nationality:"New Zealander",age:16, gender:"Female", heightCm:171, position:"defender",    currentStars:2.0, potentialStars:4.0, serve:44, power:44, block:42, defense:52, speed:56, stamina:50, morale:84, salary:0, contractYears:2, developmentCurve:"Late Bloomer",            playStyle:"Technical Defender"  },
  { name:"Jayden Walsh",         nationality:"Australian",   age:17, gender:"Male",   heightCm:185, position:"all_rounder", currentStars:2.5, potentialStars:3.5, serve:52, power:56, block:52, defense:54, speed:56, stamina:56, morale:82, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Moana Faleolo",        nationality:"Samoan",       age:15, gender:"Female", heightCm:169, position:"blocker",     currentStars:1.5, potentialStars:3.5, serve:38, power:40, block:42, defense:36, speed:46, stamina:44, morale:82, salary:0, contractYears:1, developmentCurve:"High Ceiling Raw Talent", playStyle:"Raw Athlete"         },

  // ── MIDDLE EAST & NORTH AFRICA (4) ────────────────────────────────────────
  { name:"Omar Hassan",          nationality:"Egyptian",     age:19, gender:"Male",   heightCm:184, position:"all_rounder", currentStars:2.5, potentialStars:3.0, serve:54, power:54, block:52, defense:54, speed:56, stamina:58, morale:78, salary:0, contractYears:3, developmentCurve:"Steady Improver",        playStyle:"All-Rounder"         },
  { name:"Layla Al-Rashid",      nationality:"Jordanian",    age:17, gender:"Female", heightCm:168, position:"defender",    currentStars:2.5, potentialStars:4.0, serve:50, power:46, block:44, defense:58, speed:60, stamina:56, morale:84, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Technical Defender"  },
  { name:"Karim Mansour",        nationality:"Moroccan",     age:16, gender:"Male",   heightCm:182, position:"blocker",     currentStars:2.0, potentialStars:3.5, serve:46, power:50, block:52, defense:42, speed:50, stamina:50, morale:80, salary:0, contractYears:2, developmentCurve:"Steady Improver",        playStyle:"Power Blocker"       },
  { name:"Reem Al-Farsi",        nationality:"Omani",        age:18, gender:"Female", heightCm:166, position:"all_rounder", currentStars:2.0, potentialStars:3.5, serve:46, power:46, block:44, defense:48, speed:52, stamina:50, morale:80, salary:0, contractYears:2, developmentCurve:"Coach Dependent",        playStyle:"Smart Positioner"    },
];

async function main() {
  console.log("=== Seed Youth Players V2 ===\n");

  // 1. Upload single shared card image
  const imgLocal = resolve(WORKSPACE_ROOT, "attached_assets", "player_youth_all_01_1783432743064.webp");
  const imgGcsPath = "youth-cards/youth-card-v2.webp";
  console.log("Uploading shared youth card image...");
  const sharedImageUrl = await upload(imgLocal, imgGcsPath);
  console.log(`  ✓ Image → ${sharedImageUrl}\n`);

  // 2. Delete existing youth players
  console.log("Removing existing youth players...");
  await db.delete(playersTable).where(eq(playersTable.playerType, "youth"));
  console.log("  ✓ Cleared.\n");

  // 3. Insert all 72
  console.log(`Inserting ${PLAYERS.length} youth players...\n`);
  let count = 0;
  for (const p of PLAYERS) {
    await db.insert(playersTable).values({
      name: p.name,
      nationality: p.nationality,
      age: p.age,
      height: p.heightCm,
      position: p.position,
      serve: p.serve,
      power: p.power,
      block: p.block,
      defense: p.defense,
      speed: p.speed,
      stamina: p.stamina,
      morale: p.morale,
      salary: p.salary,
      teamId: null,
      imageUrl: sharedImageUrl,
      playerType: "youth",
      isDraftPlayer: false,
      potential: potentialLabel(p.potentialStars),
      scoutedPotential: scoutedPotentialLabel(p.potentialStars),
      academyContractYears: p.contractYears,
      isActive: true,
      fatigue: 0,
      isInjured: false,
      trainingPoints: 0,
      squadRole: "reserve",
      fitness: 100,
      injuryStatus: "Healthy",
      injuryWeeksRemaining: 0,
      consecutiveMatchesPlayed: 0,
    });
    count++;
    const half = p.currentStars % 1 === 0.5 ? "½" : "";
    const stars = "★".repeat(Math.floor(p.currentStars)) + half;
    console.log(`  [${String(count).padStart(2,"0")}/72] ${p.name.padEnd(26)} ${p.nationality.padEnd(15)} ${p.gender.padEnd(7)} ${p.age}y  ${stars.padEnd(5)} → pot:${potentialLabel(p.potentialStars)}`);
  }

  console.log(`\n=== Done — ${count} youth players seeded. ===`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
