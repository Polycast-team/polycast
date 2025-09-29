const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../profile-data/pool');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function createUser({ username, password, nativeLanguage, targetLanguage }) {
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const sql = `INSERT INTO profiles (username, password_hash, native_language, target_language)
               VALUES ($1, $2, $3, $4)
               RETURNING id, username, native_language, target_language, created_at, updated_at`;
  const { rows } = await pool.query(sql, [username, passwordHash, nativeLanguage, targetLanguage]);
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
  const { rows } = await pool.query('SELECT id, username, native_language, target_language, created_at, updated_at FROM profiles WHERE id=$1', [id]);
  return rows[0] || null;
}

async function updateProfileLanguages(id, { nativeLanguage, targetLanguage }) {
  const { rows } = await pool.query(
    'UPDATE profiles SET native_language=$1, target_language=$2, updated_at=now() WHERE id=$3 RETURNING id, username, native_language, target_language, created_at, updated_at',
    [nativeLanguage, targetLanguage, id]
  );
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


