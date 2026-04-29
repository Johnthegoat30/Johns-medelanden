let currentUserId = null;
let currentUsername = null;
let ws = null;

// Kontrollera om användare är inloggad vid sidladdning
document.addEventListener('DOMContentLoaded', () => {
  checkUserSession();
  setupWebSocket();
});

// Kolla om användare är inloggad
async function checkUserSession() {
  try {
    const response = await fetch('/user');
    const data = await response.json();
    
    if (data.success) {
      currentUserId = data.userId;
      currentUsername = data.username;
      showChatInterface();
    } else {
      showAuthInterface();
    }
  } catch (err) {
    console.error('Sessionkontroll misslyckades:', err);
    showAuthInterface();
  }
}

// Visa autentiseringsgränssnitt
function showAuthInterface() {
  document.getElementById('auth-container').classList.add('active');
  document.getElementById('chat-container').classList.remove('active');
}

// Visa chattgränssnitt
function showChatInterface() {
  document.getElementById('auth-container').classList.remove('active');
  document.getElementById('chat-container').classList.add('active');
  document.getElementById('current-user').textContent = currentUsername;
}

// Växla mellan login och register
function toggleTab(event) {
  event.preventDefault();
  document.getElementById('register-tab').classList.toggle('active');
  document.getElementById('login-tab').classList.toggle('active');
}

// Registrering
async function handleRegister(event) {
  event.preventDefault();
  
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, confirmPassword })
    });
    
    const data = await response.json();
    const messageEl = document.getElementById('auth-message');
    
    if (data.success) {
      messageEl.textContent = data.message;
      messageEl.className = 'message success';
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-confirm-password').value = '';
    } else {
      messageEl.textContent = data.message;
      messageEl.className = 'message error';
    }
  } catch (err) {
    console.error('Registreringsfel:', err);
  }
}

// Inloggning
async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    const messageEl = document.getElementById('auth-message');
    
    if (data.success) {
      currentUserId = data.userId;
      currentUsername = data.username;
      messageEl.textContent = data.message;
      messageEl.className = 'message success';
      setTimeout(() => showChatInterface(), 500);
    } else {
      messageEl.textContent = data.message;
      messageEl.className = 'message error';
    }
  } catch (err) {
    console.error('Inloggningsfel:', err);
  }
}

// Logga ut
async function handleLogout() {
  try {
    await fetch('/logout', { method: 'POST' });
    currentUserId = null;
    currentUsername = null;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showAuthInterface();
  } catch (err) {
    console.error('Utloggningsfel:', err);
  }
}

// Setupera WebSocket
function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('Ansluten till server');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'message') {
      displayMessage(data);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket-fel:', err);
  };

  ws.onclose = () => {
    console.log('Frånkopplad från server');
    // Försök att återansluta efter 3 sekunder
    setTimeout(setupWebSocket, 3000);
  };
}

// Skicka meddelande
function sendMessage() {
  const friendUsername = document.getElementById('friend-username').value;
  const messageText = document.getElementById('message-input').value;

  if (!friendUsername || !messageText) {
    alert('Vänligen fyll i alla fält');
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert('Inte ansluten till servern. Vänta lite...');
    return;
  }

  // Skicka via WebSocket
  ws.send(JSON.stringify({
    fromUserId: currentUserId,
    fromUsername: currentUsername,
    toUsername: friendUsername,
    message: messageText
  }));

  // Rensa inputfält
  document.getElementById('message-input').value = '';
}

// Visa meddelande i chatten
function displayMessage(data) {
  const messagesDiv = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = data.fromUserId === currentUserId ? 'message-box sent' : 'message-box received';
  
  messageEl.innerHTML = `
    <div class="message-header">
      <strong>${data.fromUsername}</strong>
      <span class="timestamp">${data.timestamp}</span>
    </div>
    <div class="message-text">${escapeHtml(data.message)}</div>
  `;

  messagesDiv.appendChild(messageEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Säker HTML-rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Enter-tangent för att skicka
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.getElementById('chat-container').classList.contains('active')) {
    e.preventDefault();
    sendMessage();
  }
});
