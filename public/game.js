// Creates a new WebSocket connection to the specified URL.
const protocol = (location.protocol === 'http:' ? 'ws' : 'wss');
const socket = new WebSocket(`${protocol}://${location.host}`);
// Executes when the connection is successfully established.

socket.addEventListener('open', event => {
  socket.send(JSON.stringify({ type: 'create' }));
});

// Listen for messages and executes when a message is received from the server.
socket.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  console.log('received', msg);
});

// Executes when the connection is closed, providing the close code and reason.
socket.addEventListener('close', event => {
  console.log('WebSocket connection closed:', event.code, event.reason);
});

// Executes if an error occurs during the WebSocket communication.
socket.addEventListener('error', error => {
  console.error('WebSocket error:', error);
});