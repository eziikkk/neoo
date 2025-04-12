const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Очередь ожидающих пользователей
const waitingQueue = [];
// Пары пользователей
const pairs = {};
// Информация о пользователях
const users = new Map();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`Новое соединение: ${socket.id}`);
  
  // Генерация анонимного имени
  const username = `Аноним-${Math.floor(1000 + Math.random() * 9000)}`;
  users.set(socket.id, { username });
  
  // Приветственное сообщение и статус
  socket.emit('system-message', {
    text: `Добро пожаловать, ${username}! Ищем собеседника...`,
    time: new Date().toISOString()
  });
  socket.emit('status-change', {
    status: 'searching',
    message: 'Поиск собеседника...'
  });

  // Добавление в очередь
  addToQueue(socket.id);

  // Обработка сообщений
  socket.on('send-message', (message) => {
    if (!message.text || message.text.trim() === '') return;
    
    const recipient = pairs[socket.id];
    if (!recipient || !io.sockets.sockets.has(recipient)) {
      handlePartnerDisconnection(socket);
      return;
    }
    
    // Отправка сообщения партнеру
    io.to(recipient).emit('new-message', {
      text: message.text,
      time: new Date().toISOString()
    });
    
    // Подтверждение отправителю
    socket.emit('message-sent', {
      text: message.text,
      time: new Date().toISOString(),
      isOwn: true
    });
  });

  // Обработка выхода из чата
  socket.on('leave-chat', () => {
    handleLeaveChat(socket.id);
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log(`Отключение: ${socket.id}`);
    handleDisconnection(socket.id);
  });
});

// Функции обработки

function addToQueue(socketId) {
  if (!waitingQueue.includes(socketId)) {
    waitingQueue.push(socketId);
    tryPairUsers();
  }
}

function tryPairUsers() {
  while (waitingQueue.length >= 2) {
    const user1 = waitingQueue.shift();
    const user2 = waitingQueue.shift();
    
    // Проверка активности сокетов
    if (!isSocketActive(user1)) {
      if (isSocketActive(user2)) waitingQueue.unshift(user2);
      continue;
    }
    if (!isSocketActive(user2)) {
      if (isSocketActive(user1)) waitingQueue.unshift(user1);
      continue;
    }
    
    // Создание пары
    pairs[user1] = user2;
    pairs[user2] = user1;
    
    // Уведомление пользователей
    const message = 'Собеседник найден! Начинайте общение.';
    const time = new Date().toISOString();
    
    // Для первого пользователя
    io.to(user1).emit('system-message', { text: message, time });
    io.to(user1).emit('status-change', {
      status: 'online',
      message: 'Собеседник подключен'
    });
    io.to(user1).emit('chat-started');
    
    // Для второго пользователя
    io.to(user2).emit('system-message', { text: message, time });
    io.to(user2).emit('status-change', {
      status: 'online',
      message: 'Собеседник подключен'
    });
    io.to(user2).emit('chat-started');
  }
}

function handleLeaveChat(socketId) {
  if (!users.has(socketId)) return;
  
  const partner = pairs[socketId];
  if (partner) {
    io.to(partner).emit('system-message', {
      text: 'Собеседник покинул чат. Ищем нового...',
      time: new Date().toISOString()
    });
    io.to(partner).emit('status-change', {
      status: 'searching',
      message: 'Поиск нового собеседника'
    });
    io.to(partner).emit('chat-ended');
    delete pairs[partner];
    addToQueue(partner);
  }
  
  delete pairs[socketId];
  io.to(socketId).emit('status-change', {
    status: 'searching',
    message: 'Вы вышли из чата'
  });
  io.to(socketId).emit('chat-ended');
  addToQueue(socketId);
}

function handleDisconnection(socketId) {
  handleLeaveChat(socketId);
  users.delete(socketId);
}

function handlePartnerDisconnection(socket) {
  socket.emit('system-message', {
    text: 'Собеседник покинул чат. Ищем нового...',
    time: new Date().toISOString()
  });
  socket.emit('status-change', {
    status: 'searching',
    message: 'Поиск нового собеседника'
  });
  socket.emit('chat-ended');
  addToQueue(socket.id);
}

function isSocketActive(socketId) {
  return io.sockets.sockets.has(socketId);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// ... (остальной код сервера)

io.on('connection', (socket) => {
    // Получаем параметры из localStorage клиента
    socket.on('user-preferences', (prefs) => {
        users.set(socket.id, {
            username: `Аноним-${Math.floor(1000 + Math.random() * 9000)}`,
            preferences: prefs
        });
        
        // Логика подбора пары с учетом preferences
        matchUsers(socket.id, prefs);
    });
});

function matchUsers(socketId, prefs) {
    // Улучшенный алгоритм подбора пары с учетом предпочтений
    for (let i = 0; i < waitingQueue.length; i++) {
        const otherId = waitingQueue[i];
        const otherUser = users.get(otherId);
        
        if (isCompatible(prefs, otherUser.preferences)) {
            // Создаем пару
            pairs[socketId] = otherId;
            pairs[otherId] = socketId;
            
            // Удаляем из очереди
            waitingQueue.splice(i, 1);
            
            // Уведомляем пользователей
            notifyMatch(socketId, otherId);
            return;
        }
    }
    
    // Если пара не найдена, добавляем в очередь
    waitingQueue.push(socketId);
}