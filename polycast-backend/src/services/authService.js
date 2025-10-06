const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../profile-data/pool');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function createUser({ username, password, nativeLanguage, targetLanguage, proficiencyLevel = 3 }) {
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const sql = `INSERT INTO profiles (username, password_hash, native_language, target_language, proficiency_level)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, username, native_language, target_language, proficiency_level, created_at, updated_at`;
  const { rows } = await pool.query(sql, [username, passwordHash, nativeLanguage, targetLanguage, proficiencyLevel]);
  return rows[0];
}

async function findUserByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM profiles WHERE username=$1', [username]);
  return rows[0] || null;
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function issueToken(profile) {
  return jwt.sign({ sub: profile.id, username: profile.username }, JWT_SECRET, { expiresIn: '7d' });
}

async function getProfileById(id) {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, native_language, target_language, proficiency_level, created_at, updated_at FROM profiles WHERE id=$1',
      [id]
    );
    return rows[0] || null;
  } catch (e) {
    // Fallback for deployments where migration hasn't added proficiency_level yet
    try {
      const { rows } = await pool.query(
        'SELECT id, username, native_language, target_language, created_at, updated_at FROM profiles WHERE id=$1',
        [id]
      );
      if (rows[0]) {
        return { ...rows[0], proficiency_level: 3 };
      }
      return null;
    } catch (_) {
      throw e;
    }
  }
}

async function updateProfileLanguages(id, { nativeLanguage, targetLanguage, proficiencyLevel }) {
  const fields = ['native_language', 'target_language'];
  const values = [nativeLanguage, targetLanguage];
  if (Number.isFinite(proficiencyLevel)) {
    fields.push('proficiency_level');
    values.push(proficiencyLevel);
  }
  const setClause = fields.map((f, i) => `${f}=$${i + 1}`).join(', ') + ', updated_at=now()';
  const sql = `UPDATE profiles SET ${setClause} WHERE id=$${values.length + 1} RETURNING id, username, native_language, target_language, proficiency_level, created_at, updated_at`;
  const { rows } = await pool.query(sql, [...values, id]);
  return rows[0];
}

async function deleteProfile(id) {
  const { rowCount } = await pool.query('DELETE FROM profiles WHERE id=$1', [id]);
  return rowCount > 0;
}

module.exports = {
  createUser,
  findUserByUsername,
  verifyPassword,
  issueToken,
  getProfileById,
  updateProfileLanguages,
  deleteProfile,
};


