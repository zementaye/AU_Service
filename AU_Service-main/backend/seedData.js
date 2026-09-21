const bcrypt = require("bcryptjs");

const DEMO_USERS = [
  { name: "Selam Bekele", email: "s.bekele@au.int", deptId: "ict", role: "Super Admin" },
  { name: "Dawit Tesfaye", email: "d.tesfaye@au.int", deptId: "ict", role: "Focal Point" },
  { name: "Hanna Girma", email: "h.girma@au.int", deptId: "ict", role: "Handler" },
  { name: "Robel Kassa", email: "r.kassa@au.int", deptId: "ict", role: "Staff" },
  { name: "Amina Yusuf", email: "a.yusuf@au.int", deptId: "ahrm", role: "Focal Point" },
  { name: "Tarek Haile", email: "t.haile@au.int", deptId: "ahrm", role: "Handler" },
  { name: "Meron Alemu", email: "m.alemu@au.int", deptId: "ahrm", role: "Staff" },
  { name: "Kwame Owusu", email: "k.owusu@au.int", deptId: "pbfa", role: "Staff" },
  { name: "Fatima Diallo", email: "f.diallo@au.int", deptId: "pbfa", role: "Focal Point" },
  { name: "Julius Mwangi", email: "j.mwangi@au.int", deptId: "paps", role: "Staff" },
];

const DEMO_PASSWORD = "ChangeMe123!"; // every seeded account shares this — rotate on first login in production

async function runSeed(pool) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let inserted = 0;
  for (const u of DEMO_USERS) {
    const { rowCount } = await pool.query(
      `INSERT INTO users (name, email, password_hash, department_id, role)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.deptId, u.role]
    );
    inserted += rowCount;
  }
  return { inserted, total: DEMO_USERS.length, password: DEMO_PASSWORD };
}

module.exports = { DEMO_USERS, DEMO_PASSWORD, runSeed };
