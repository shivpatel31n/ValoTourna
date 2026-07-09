import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "..", "data", "users.json");

function readUsers() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "[]");
  }
  let raw = fs.readFileSync(DB_FILE, "utf-8");
  // Strip a UTF-8 BOM if present (some editors save files with it, which breaks JSON.parse)
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw || "[]");
}

function writeUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

export function findUserByEmail(email) {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(user) {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
  return user;
}

export function getAllUsers() {
  return readUsers();
}