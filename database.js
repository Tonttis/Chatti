import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const db = new Database(path.join(__dirname, 'chat.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
`);

// Prepared statements
const statements = {
  // Room operations
  createRoom: db.prepare('INSERT OR IGNORE INTO rooms (name) VALUES (?)'),
  getRoomByName: db.prepare('SELECT * FROM rooms WHERE name = ?'),
  getAllRooms: db.prepare('SELECT * FROM rooms ORDER BY created_at'),
  deleteRoom: db.prepare('DELETE FROM rooms WHERE name = ?'),

  // Message operations
  saveMessage: db.prepare('INSERT INTO messages (room_id, username, text) VALUES (?, ?, ?)'),
  getMessagesByRoom: db.prepare(`
    SELECT m.*, r.name as room_name 
    FROM messages m 
    JOIN rooms r ON m.room_id = r.id 
    WHERE r.name = ? 
    ORDER BY m.timestamp 
    LIMIT 100
  `),
  getMessageCount: db.prepare(`
    SELECT COUNT(*) as count 
    FROM messages m 
    JOIN rooms r ON m.room_id = r.id 
    WHERE r.name = ?
  `),
  deleteOldMessages: db.prepare(`
    DELETE FROM messages 
    WHERE room_id = ? 
    AND id NOT IN (
      SELECT id FROM messages 
      WHERE room_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    )
  `),
};

// Database operations
export const database = {
  // Room operations
  createRoom(name) {
    try {
      const result = statements.createRoom.run(name);
      return result.changes > 0;
    } catch (error) {
      console.error('Error creating room:', error);
      return false;
    }
  },

  getRoomByName(name) {
    return statements.getRoomByName.get(name);
  },

  getAllRooms() {
    return statements.getAllRooms.all();
  },

  roomExists(name) {
    const room = statements.getRoomByName.get(name);
    return !!room;
  },

  // Message operations
  saveMessage(roomName, username, text) {
    try {
      const room = statements.getRoomByName.get(roomName);
      if (!room) {
        console.error('Room not found:', roomName);
        return null;
      }

      const result = statements.saveMessage.run(room.id, username, text);
      
      // Clean up old messages (keep only last 100)
      statements.deleteOldMessages.run(room.id, room.id);

      return {
        id: result.lastInsertRowid.toString(),
        room_id: room.id,
        username,
        text,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  },

  getMessagesByRoom(roomName) {
    try {
      const rows = statements.getMessagesByRoom.all(roomName);
      return rows.map(row => ({
        id: row.id.toString(),
        text: row.text,
        username: row.username,
        room: row.room_name,
        timestamp: row.timestamp
      }));
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },

  getMessageCount(roomName) {
    try {
      const result = statements.getMessageCount.get(roomName);
      return result ? result.count : 0;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  },

  // Initialize default rooms
  initDefaultRooms(defaultRooms) {
    defaultRooms.forEach(roomName => {
      this.createRoom(roomName);
    });
  },

  // Close database connection
  close() {
    db.close();
  }
};

export default database;
