document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const localVideo = document.getElementById('localVideo');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const streamsContainer = document.getElementById('streamsContainer');
    const connectionStatus = document.getElementById('connectionStatus');
    const activeUsers = document.getElementById('activeUsers');
    
    // Connect to socket.io server
    const socket = io();
    
    // Stream variables
    let localStream = null;
    const remoteStreams = {};
    let activeUserCount = 0;
    
    // Socket connection event handlers
    socket.on('connect', () => {
      connectionStatus.textContent = `Connected as: ${socket.id}`;
      console.log('Connected to server with ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
      connectionStatus.textContent = 'Disconnected from server';
      console.log('Disconnected from server');
    });
    
    socket.on('new-user', (userId) => {
      console.log('New user connected:', userId);
      updateActiveUserCount(1);
    });
    
    socket.on('existing-users', (userIds) => {
      console.log('Existing users:', userIds);
      updateActiveUserCount(userIds.length);
    });
    
    socket.on('user-disconnected', (userId) => {
      console.log('User disconnected:', userId);
      
      // Remove user's stream if it exists
      if (remoteStreams[userId]) {
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
          videoElement.parentNode.remove();
        }
        delete remoteStreams[userId];
      }
      
      updateActiveUserCount(-1);
      
      // Show "no streams" message if no streams are available
      if (streamsContainer.children.length === 0) {
        const noStreamsMsg = document.createElement('p');
        noStreamsMsg.className = 'no-streams';
        noStreamsMsg.textContent = 'No active streams yet';
        streamsContainer.appendChild(noStreamsMsg);
      }
    });
    
    socket.on('stream', (data) => {
      // Create video element for the remote stream if it doesn't exist
      if (!remoteStreams[data.userId]) {
        // Remove "no streams" message if present
        const noStreamsMsg = streamsContainer.querySelector('.no-streams');
        if (noStreamsMsg) {
          noStreamsMsg.remove();
        }
        
        createRemoteVideoElement(data.userId);
      }
      
      // Update the remote video with new frame data
      const remoteVideo = document.getElementById(`video-${data.userId}`);
      if (remoteVideo) {
        // Convert base64 image data to blob URL and set as src
        if (data.data) {
          remoteVideo.src = data.data;
        }
      }
    });
    
    // Button event handlers
    startButton.addEventListener('click', startStreaming);
    stopButton.addEventListener('click', stopStreaming);
    
    // Functions
    async function startStreaming() {
      try {
        // Request access to webcam
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false  // No audio for simplicity
        });
        
        // Display local video stream
        localVideo.srcObject = localStream;
        
        // Enable/disable buttons
        startButton.disabled = true;
        stopButton.disabled = false;
        
        // Set up canvas for capturing frames
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const videoTrack = localStream.getVideoTracks()[0];
        const { width, height } = videoTrack.getSettings();
        
        canvas.width = width;
        canvas.height = height;
        
        // Start sending frames to server
        const frameInterval = setInterval(() => {
          // Draw video frame to canvas
          context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to data URL
          const frameData = canvas.toDataURL('image/jpeg', 0.5);  // Lower quality for better performance
          
          // Send frame data to server
          socket.emit('stream', frameData);
        }, 100);  // Send frames approximately 10 times per second
        
        // Store interval ID for cleanup
        localVideo.dataset.frameInterval = frameInterval;
        
        console.log('Streaming started');
      } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Could not access webcam. Please check your permissions.');
      }
    }
    
    function stopStreaming() {
      if (localStream) {
        // Stop all tracks
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        
        // Clear frame sending interval
        clearInterval(localVideo.dataset.frameInterval);
        
        // Enable/disable buttons
        startButton.disabled = false;
        stopButton.disabled = true;
        
        console.log('Streaming stopped');
      }
    }
    
    function createRemoteVideoElement(userId) {
      // Create container for remote video
      const videoContainer = document.createElement('div');
      videoContainer.className = 'remote-video-container';
      videoContainer.id = `container-${userId}`;
      
      // Create image element for remote stream (using img instead of video for data URL streaming)
      const remoteVideo = document.createElement('img');
      remoteVideo.id = `video-${userId}`;
      
      // Create user ID label
      const userIdLabel = document.createElement('div');
      userIdLabel.className = 'user-id';
      userIdLabel.textContent = userId;
      
      // Add elements to container
      videoContainer.appendChild(remoteVideo);
      videoContainer.appendChild(userIdLabel);
      
      // Add container to streams container
      streamsContainer.appendChild(videoContainer);
      
      // Store reference to remote stream
      remoteStreams[userId] = true;
      
      return remoteVideo;
    }
    
    function updateActiveUserCount(change) {
      if (typeof change === 'number') {
        activeUserCount += change;
      } else {
        activeUserCount = change + 1;  // +1 for current user
      }
      
      activeUsers.textContent = `Active users: ${activeUserCount}`;
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Clear intervals
      if (localVideo.dataset.frameInterval) {
        clearInterval(localVideo.dataset.frameInterval);
      }
    });
  });