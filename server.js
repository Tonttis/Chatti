import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active users in each room (in-memory for real-time tracking)
const roomUsers = new Map();

// Default rooms
const defaultRooms = ['General', 'Technology', 'Random', 'Support'];

// Initialize default rooms in database
database.initDefaultRooms(defaultRooms);

// Serve static files from the dist folder (for production)
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint to get available rooms
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = database.getAllRooms().map(room => ({
      name: room.name,
      userCount: roomUsers.get(room.name)?.size || 0,
      messageCount: database.getMessageCount(room.name)
    }));
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// API endpoint to get message history for a specific room
app.get('/api/rooms/:roomName/messages', (req, res) => {
  try {
    const { roomName } = req.params;
    const messages = database.getMessagesByRoom(roomName);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Generate anonymous username
  const username = `Anonymous-${Math.floor(Math.random() * 10000)}`;
  socket.data.username = username;
  socket.data.currentRoom = null;

  // Send available rooms to the newly connected user
  try {
    const rooms = database.getAllRooms().map(room => ({
      name: room.name,
      userCount: roomUsers.get(room.name)?.size || 0,
      messageCount: database.getMessageCount(room.name)
    }));
    socket.emit('rooms_list', rooms);
  } catch (error) {
    console.error('Error sending rooms list:', error);
  }

  // Handle user joining a room
  socket.on('join_room', (roomName) => {
    try {
      const previousRoom = socket.data.currentRoom;
      
      // Leave previous room if any
      if (previousRoom && previousRoom !== roomName) {
        socket.leave(previousRoom);
        roomUsers.get(previousRoom)?.delete(socket.id);
        
        // Notify others in the previous room
        socket.to(previousRoom).emit('user_left', {
          username: socket.data.username,
          message: `${socket.data.username} left the room`,
          timestamp: new Date().toISOString()
        });
        
        // Update user count for previous room
        io.emit('room_updated', {
          name: previousRoom,
          userCount: roomUsers.get(previousRoom)?.size || 0,
          messageCount: database.getMessageCount(previousRoom)
        });
      }

      // Check if room exists in database
      const room = database.getRoomByName(roomName);
      if (!room) {
        socket.emit('error', { message: 'Room does not exist' });
        return;
      }

      // Join new room
      socket.join(roomName);
      socket.data.currentRoom = roomName;
      
      // Initialize room users if not exists
      if (!roomUsers.has(roomName)) {
        roomUsers.set(roomName, new Set());
      }
      
      roomUsers.get(roomName).add(socket.id);

      // Send message history from database
      const messageHistory = database.getMessagesByRoom(roomName);
      socket.emit('message_history', messageHistory);

      // Notify user they've joined the room
      socket.emit('joined_room', {
        room: roomName,
        username: socket.data.username
      });

      // Notify others in the room about the new user
      socket.to(roomName).emit('user_joined', {
        username: socket.data.username,
        message: `${socket.data.username} joined the room`,
        timestamp: new Date().toISOString()
      });

      // Update user count for the room
      io.emit('room_updated', {
        name: roomName,
        userCount: roomUsers.get(roomName)?.size || 0,
        messageCount: database.getMessageCount(roomName)
      });

      console.log(`${socket.data.username} joined room: ${roomName}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    try {
      const currentRoom = socket.data.currentRoom;
      
      if (!currentRoom) {
        socket.emit('error', { message: 'You must join a room first' });
        return;
      }

      // Save message to database
      const savedMessage = database.saveMessage(
        currentRoom,
        socket.data.username,
        data.text
      );

      if (!savedMessage) {
        socket.emit('error', { message: 'Failed to save message' });
        return;
      }

      const messageData = {
        id: savedMessage.id,
        text: data.text,
        username: socket.data.username,
        room: currentRoom,
        timestamp: savedMessage.timestamp
      };

      // Broadcast message to all users in the room
      io.to(currentRoom).emit('new_message', messageData);

      // Update message count
      io.emit('room_updated', {
        name: currentRoom,
        userCount: roomUsers.get(currentRoom)?.size || 0,
        messageCount: database.getMessageCount(currentRoom)
      });

      console.log(`Message in ${currentRoom} from ${socket.data.username}: ${data.text}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    try {
      const currentRoom = socket.data.currentRoom;
      if (currentRoom) {
        socket.to(currentRoom).emit('user_typing', {
          username: socket.data.username,
          isTyping
        });
      }
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  });

  // Handle creating a new room
  socket.on('create_room', (roomName) => {
    try {
      // Check if room already exists
      if (database.roomExists(roomName)) {
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      // Create room in database
      const created = database.createRoom(roomName);
      
      if (!created) {
        socket.emit('error', { message: 'Failed to create room' });
        return;
      }

      // Initialize room users
      roomUsers.set(roomName, new Set());
      
      // Notify all users about the new room
      io.emit('room_created', {
        name: roomName,
        userCount: 0,
        messageCount: 0
      });
      
      socket.emit('room_created_success', { roomName });
      console.log(`Room created: ${roomName}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      const currentRoom = socket.data.currentRoom;
      
      if (currentRoom) {
        roomUsers.get(currentRoom)?.delete(socket.id);
        
        // Notify others in the room
        socket.to(currentRoom).emit('user_left', {
          username: socket.data.username,
          message: `${socket.data.username} left the room`,
          timestamp: new Date().toISOString()
        });
        
        // Update user count
        io.emit('room_updated', {
          name: currentRoom,
          userCount: roomUsers.get(currentRoom)?.size || 0,
          messageCount: database.getMessageCount(currentRoom)
        });
      }
      
      console.log(`User disconnected: ${socket.id}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: SQLite (chat.db)`);
  console.log(`Socket.io ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  database.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  database.close();
  process.exit(0);
});
