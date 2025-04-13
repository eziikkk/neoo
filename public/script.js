document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const socket = io();
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const leaveButton = document.getElementById('leaveChat');
    const chatStatus = document.querySelector('.chat-status span');
    const statusIndicator = document.querySelector('.status-indicator');
    const soundToggle = document.getElementById('soundToggle');
    const chatContainer = document.querySelector('.chat-container');

    // Состояния
    let isChatActive = false;
    let currentStatus = 'searching';
    let soundEnabled = true;
    let audioContext;
    let audioBuffer;
    let isAudioReady = false;

    // Инициализация аудио
    async function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Предзагрузка звука
            const response = await fetch('/uv.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            isAudioReady = true;
            
            // Для мобильных: активация при первом взаимодействии
            document.body.addEventListener('click', resumeAudioContext, { once: true });
        } catch (e) {
            console.warn("Ошибка инициализации звука:", e);
            soundEnabled = false;
            if (soundToggle) soundToggle.disabled = true;
        }
    }

    function resumeAudioContext() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext активирован');
            });
        }
    }

    // Воспроизведение звука
    function playNotificationSound() {
        if (!soundEnabled || !isAudioReady) return;

        try {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            // Настройки громкости
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.2;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            source.start(0);
        } catch (e) {
            console.log("Ошибка воспроизведения:", e);
            soundEnabled = false;
        }
    }

    // Управление звуком
    function setupSoundToggle() {
        if (!soundToggle) return;
        
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            soundToggle.classList.toggle('muted', !soundEnabled);
            soundToggle.title = soundEnabled ? 'Отключить звук' : 'Включить звук';
            
            // Сохранение в localStorage
            localStorage.setItem('soundEnabled', soundEnabled);
            
            if (soundEnabled && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        });

        // Восстановление состояния
        const savedSoundPref = localStorage.getItem('soundEnabled');
        if (savedSoundPref !== null) {
            soundEnabled = savedSoundPref === 'true';
            soundToggle.classList.toggle('muted', !soundEnabled);
        }
    }

    // Отправка сообщения
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || !isChatActive) return;
        
        socket.emit('send-message', { text: message });
        messageInput.value = '';
        messageInput.focus();
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

    // Системные сообщения
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

    // Прокрутка вниз
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Обновление статуса
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

    // Инициализация
    initAudio();
    setupSoundToggle();
    updateChatControls();
    updateStatusIndicator();
    chatContainer.classList.add('searching');

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

    // Socket.io обработчики
    socket.on('new-message', (data) => {
        addMessage(data, false);
    });

    socket.on('message-sent', (data) => {
        addMessage(data, true);
    });

    socket.on('system-message', (data) => {
        addSystemMessage(data.text, data.time);
    });

    socket.on('status-change', (data) => {
        currentStatus = data.status;
        updateStatusIndicator();
        
        if (data.message) {
            addSystemMessage(data.message, new Date().toISOString());
        }
    });

    socket.on('chat-started', () => {
        isChatActive = true;
        updateChatControls();
        chatContainer.classList.remove('searching');
        chatContainer.classList.add('online');
    });

    socket.on('chat-ended', () => {
        isChatActive = false;
        updateChatControls();
        chatContainer.classList.remove('online');
        chatContainer.classList.add('searching');
    });
});