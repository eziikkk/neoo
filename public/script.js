document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const leaveButton = document.getElementById('leaveChat');
    const chatStatus = document.querySelector('.chat-status span');
    const statusIndicator = document.querySelector('.status-indicator');
  
    // Состояния чата
    let isChatActive = false;
    let currentStatus = 'searching'; // 'searching' или 'online'
  
    // Функция отправки сообщения
    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || !isChatActive) return;
      
      socket.emit('send-message', { text: message });
      messageInput.value = '';
      messageInput.focus();
    }
  
    // Обработчики событий
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  
    leaveButton.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите выйти из чата?')) {
        socket.emit('leave-chat');
      }
    });
  
    // Обработка сообщений
    socket.on('new-message', (data) => {
      addMessage(data, false);
    });
  
    socket.on('message-sent', (data) => {
      addMessage(data, true);
    });
  
    socket.on('system-message', (data) => {
      addSystemMessage(data.text, data.time);
    });
  
    // Обработка изменения статуса
    socket.on('status-change', (data) => {
      currentStatus = data.status;
      updateStatusIndicator();
      
      if (data.message) {
        addSystemMessage(data.message, new Date().toISOString());
      }
    });
  
    // Изменение состояния чата
    socket.on('chat-started', () => {
      isChatActive = true;
      updateChatControls();
      document.querySelector('.chat-container').classList.remove('searching');
      document.querySelector('.chat-container').classList.add('online');
    });
  
    socket.on('chat-ended', () => {
      isChatActive = false;
      updateChatControls();
      document.querySelector('.chat-container').classList.remove('online');
      document.querySelector('.chat-container').classList.add('searching');
    });
  
    // Обновление индикатора статуса
    function updateStatusIndicator() {
      statusIndicator.style.backgroundColor = currentStatus === 'online' ? '#2ecc71' : '#f39c12';
      chatStatus.textContent = currentStatus === 'online' 
        ? 'Анонимный чат · онлайн' 
        : 'Анонимный чат · поиск собеседника';
    }
  
    // Обновление элементов управления
    function updateChatControls() {
      messageInput.disabled = !isChatActive;
      sendButton.disabled = !isChatActive;
      leaveButton.disabled = !isChatActive;
      
      if (isChatActive) {
        messageInput.focus();
      }
    }
  
    // Добавление сообщения в чат
    function addMessage(data, isOwn) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${isOwn ? 'sent' : 'received'}`;
      
      const time = new Date(data.time);
      const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      messageElement.innerHTML = `
        ${data.text}
        <div class="message-time">${timeString}</div>
      `;
      
      messagesContainer.appendChild(messageElement);
      scrollToBottom();
      
      if (!isOwn) {
        messageElement.classList.add('new-message');
        playNotificationSound();
      }
    }
  
    function addSystemMessage(text, time) {
      const systemElement = document.createElement('div');
      systemElement.className = 'message system';
      
      const timeObj = new Date(time);
      const timeString = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      systemElement.innerHTML = `
        <div class="system-text">${text}</div>
        <div class="message-time">${timeString}</div>
      `;
      
      messagesContainer.appendChild(systemElement);
      scrollToBottom();
    }
  
    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  
    function playNotificationSound() {
      // Можно добавить звук уведомления
      // new Audio('/notification.mp3').play().catch(e => console.log(e));
    }
  
    // Инициализация
    updateChatControls();
    updateStatusIndicator();
    document.querySelector('.chat-container').classList.add('searching');
});