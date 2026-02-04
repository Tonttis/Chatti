import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Send, 
  Plus, 
  LogIn,
  MoreVertical,
  Smile,
  Paperclip,
  WifiOff,
  Server,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import './App.css';

// Types
interface Message {
  id: string;
  text: string;
  username: string;
  room: string;
  timestamp: string;
}

interface Room {
  name: string;
  userCount: number;
  messageCount: number;
}

interface TypingUser {
  username: string;
  isTyping: boolean;
}

// Default rooms to show when offline
const DEFAULT_ROOMS: Room[] = [
  { name: 'General', userCount: 0, messageCount: 0 },
  { name: 'Technology', userCount: 0, messageCount: 0 },
  { name: 'Random', userCount: 0, messageCount: 0 },
  { name: 'Support', userCount: 0, messageCount: 0 }
];

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [username, setUsername] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const connectSocket = () => {
      try {
        // Determine the server URL
        const serverUrl = import.meta.env.DEV 
          ? 'http://localhost:3000' 
          : window.location.origin;
        
        const newSocket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
          setIsConnected(true);
          toast.success('Connected to chat server');
        });

        newSocket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          setIsConnected(false);
          toast.error('Failed to connect to server');
        });

        newSocket.on('disconnect', (reason) => {
          setIsConnected(false);
          toast.error(`Disconnected: ${reason}`);
        });

        newSocket.on('rooms_list', (roomsList: Room[]) => {
          if (roomsList.length > 0) {
            setRooms(roomsList);
          }
        });

        newSocket.on('message_history', (history: Message[]) => {
          setMessages(history);
        });

        newSocket.on('new_message', (message: Message) => {
          setMessages(prev => [...prev, message]);
        });

        newSocket.on('joined_room', (data: { room: string; username: string }) => {
          setCurrentRoom(data.room);
          setUsername(data.username);
          toast.success(`Joined room: ${data.room}`);
        });

        newSocket.on('user_joined', (data: { username: string; message: string }) => {
          toast.info(data.message);
        });

        newSocket.on('user_left', (data: { username: string; message: string }) => {
          toast.info(data.message);
        });

        newSocket.on('user_typing', (data: TypingUser) => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (data.isTyping) {
              newSet.add(data.username);
            } else {
              newSet.delete(data.username);
            }
            return newSet;
          });
        });

        newSocket.on('room_created', (room: Room) => {
          setRooms(prev => [...prev, room]);
        });

        newSocket.on('room_updated', (updatedRoom: Room) => {
          setRooms(prev => 
            prev.map(r => r.name === updatedRoom.name ? updatedRoom : r)
          );
        });

        newSocket.on('room_created_success', (data: { roomName: string }) => {
          toast.success(`Room "${data.roomName}" created successfully`);
          setShowCreateRoomDialog(false);
          setNewRoomName('');
        });

        newSocket.on('error', (error: { message: string }) => {
          toast.error(error.message);
        });

        setSocket(newSocket);

        return () => {
          newSocket.close();
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
      }
    };

    connectSocket();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle joining a room
  const handleJoinRoom = (roomName: string) => {
    if (!isConnected) {
      toast.error('Not connected to server. Please run the backend locally.');
      return;
    }
    if (socket && roomName !== currentRoom) {
      socket.emit('join_room', roomName);
    }
  };

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    if (socket && messageInput.trim() && currentRoom) {
      socket.emit('send_message', { text: messageInput.trim() });
      setMessageInput('');
      socket.emit('typing', false);
    }
  };

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setMessageInput(value);
    
    if (socket && currentRoom && isConnected) {
      socket.emit('typing', value.length > 0);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator after 2 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', false);
      }, 2000);
    }
  };

  // Handle creating a new room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    if (socket && newRoomName.trim()) {
      socket.emit('create_room', newRoomName.trim());
    }
  };

  // Retry connection
  const handleRetryConnection = () => {
    if (socket) {
      socket.connect();
    } else {
      window.location.reload();
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get typing indicator text
  const getTypingText = () => {
    const users = Array.from(typingUsers);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users.length} people are typing...`;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar - Room List */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Chat Rooms</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs text-white/80">
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Error Banner */}
        {!isConnected && (
          <div className="p-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-800 font-medium">
                  Server not connected
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Run <code className="bg-amber-100 px-1 rounded">npm run server</code> locally
                </p>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                onClick={handleRetryConnection}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Create Room Button */}
        <div className="p-4">
          <Button 
            onClick={() => isConnected ? setShowCreateRoomDialog(true) : toast.error('Server not connected')}
            disabled={!isConnected}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </div>

        {/* Room List */}
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Rooms
            </div>
            {rooms.map((room) => (
              <button
                key={room.name}
                onClick={() => handleJoinRoom(room.name)}
                disabled={!isConnected}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentRoom === room.name 
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 shadow-sm' 
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  currentRoom === room.name 
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'
                }`}>
                  <Hash className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-medium ${
                    currentRoom === room.name ? 'text-indigo-900' : 'text-slate-700'
                  }`}>
                    {room.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="w-3 h-3" />
                    <span>{room.userCount} online</span>
                    <span className="text-slate-300">•</span>
                    <span>{room.messageCount} msgs</span>
                  </div>
                </div>
                {currentRoom === room.name && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* User Info */}
        {username && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-md">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">{username}</div>
                <div className="text-xs text-slate-500">Anonymous User</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">{currentRoom}</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users className="w-4 h-4" />
                    <span>
                      {rooms.find(r => r.name === currentRoom)?.userCount || 0} members
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No messages yet</p>
                    <p className="text-sm">Be the first to send a message!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isOwnMessage = message.username === username;
                    const showAvatar = index === 0 || messages[index - 1].username !== message.username;
                    
                    return (
                      <div 
                        key={message.id} 
                        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                      >
                        {showAvatar ? (
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold shadow-md ${
                            isOwnMessage 
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-500' 
                              : 'bg-gradient-to-br from-slate-400 to-slate-500'
                          }`}>
                            {message.username.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-9 flex-shrink-0" />
                        )}
                        <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                          {showAvatar && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-600">
                                {message.username}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                            isOwnMessage 
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md' 
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                          }`}>
                            <p className="text-sm leading-relaxed">{message.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="px-6 py-2">
                <span className="text-xs text-slate-500 italic flex items-center gap-2">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {getTypingText()}
                </span>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  disabled={!isConnected}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    value={messageInput}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder={isConnected ? "Type a message..." : "Connect to server to send messages..."}
                    disabled={!isConnected}
                    className="pr-12 py-6 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-300 focus:ring-indigo-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                  />
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon"
                    disabled={!isConnected}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  >
                    <Smile className="w-5 h-5" />
                  </Button>
                </div>
                <Button 
                  type="submit"
                  disabled={!messageInput.trim() || !isConnected}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          /* Empty State - No Room Selected */
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                {isConnected ? (
                  <LogIn className="w-12 h-12 text-indigo-500" />
                ) : (
                  <Server className="w-12 h-12 text-slate-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {isConnected ? 'Welcome to Chat Rooms' : 'Server Not Connected'}
              </h2>
              <p className="text-slate-500 mb-8 max-w-md">
                {isConnected 
                  ? 'Select a room from the sidebar to start chatting, or create a new room to begin a conversation.'
                  : 'To use the chat application, you need to run the backend server locally.'
                }
              </p>
              
              {!isConnected && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-md mx-auto mb-6">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-500" />
                    Local Setup Instructions
                  </h3>
                  <ol className="text-left text-sm text-slate-600 space-y-2">
                    <li className="flex gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                      <span>Open terminal in project folder</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                      <span>Run <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">npm run server</code></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                      <span>Open <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">http://localhost:3000</code></span>
                    </li>
                  </ol>
                </div>
              )}
              
              {isConnected && (
                <div className="flex gap-3 justify-center">
                  {rooms.slice(0, 3).map(room => (
                    <Button
                      key={room.name}
                      variant="outline"
                      onClick={() => handleJoinRoom(room.name)}
                      className="border-slate-300 hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <Hash className="w-4 h-4 mr-2" />
                      {room.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoomDialog} onOpenChange={setShowCreateRoomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-500" />
              Create New Room
            </DialogTitle>
            <DialogDescription>
              Enter a name for your new chat room. This room will be available for all users.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRoom}>
            <div className="py-4">
              <Input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (e.g., 'Project Discussion')"
                className="w-full"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateRoomDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={!newRoomName.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
              >
                Create Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
