const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Notify all users when a new user connects
  socket.broadcast.emit('new-user', socket.id);
  
  // Send existing users to the newly connected user
  socket.emit('existing-users', 
    Object.keys(io.sockets.sockets).filter(id => id !== socket.id)
  );
  
  // Handle new stream data
  socket.on('stream', (data) => {
    // Broadcast stream to all other users
    socket.broadcast.emit('stream', {
      userId: socket.id,
      data: data
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socket.broadcast.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});