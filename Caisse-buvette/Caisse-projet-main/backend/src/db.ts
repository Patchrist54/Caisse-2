// backend/src/db.ts — accès SQLite (sql.js : moteur WebAssembly, aucune compilation native,
// fonctionne à l'identique sous Windows, macOS, Linux et StackBlitz).
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlValue } from 'sql.js';
import { creerSchema, insererDonneesFictives } from './seed';

export const DB_FILE = path.resolve(__dirname, '../data/caisse.sqlite');

let db: Database;

export async function ouvrirBase(): Promise<void> {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
    console.log(`Base chargée : ${DB_FILE}`);
  } else {
    db = new SQL.Database();
    reinitialiserBase();
    console.log(`Base créée avec des données fictives : ${DB_FILE}`);
  }
  db.exec('PRAGMA foreign_keys = ON');
}

/** Efface tout et recrée la base de démonstration. */
export function reinitialiserBase(): void {
  db.exec(`
    DROP TABLE IF EXISTS lignes_vente;
    DROP TABLE IF EXISTS ventes;
    DROP TABLE IF EXISTS produits;
    DROP TABLE IF EXISTS categories;
  `);
  creerSchema(db);
  insererDonneesFictives(db);
  sauvegarder();
}

/** Écrit la base sur disque (écriture atomique : fichier temporaire puis renommage). */
export function sauvegarder(): void {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, DB_FILE);
}

type Params = SqlValue[] | Record<string, SqlValue>;

export function lire<T>(sql: string, params: Params = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const lignes: T[] = [];
    while (stmt.step()) lignes.push(stmt.getAsObject() as T);
    return lignes;
  } finally {
    stmt.free();
  }
}

export function lireUn<T>(sql: string, params: Params = []): T | undefined {
  return lire<T>(sql, params)[0];
}

export function executer(sql: string, params: Params = []): number {
  db.run(sql, params);
  return Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
}

/** Exécute fn dans une transaction ; la base n'est écrite sur disque qu'en cas de succès. */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const resultat = fn();
    db.exec('COMMIT');
    sauvegarder();
    return resultat;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
