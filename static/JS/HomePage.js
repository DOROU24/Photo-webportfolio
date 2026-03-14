document.addEventListener('DOMContentLoaded', function() {
    let currentDate = new Date();
    let currentWeekStart = getMonday(currentDate);

    // Длительности в часах для каждого тарифа
    const tariffDurations = {
        MINI: 1,       // 30 минут → округляем до 1 часа
        STANDARD: 2,   // 1.5 часа → округляем до 2 часов
        PREMIUM: 4     // 4 часа (без изменений)
    };

    // Цены тарифов для отображения
    const tariffPrices = {
        MINI: '13 000 ₽',
        STANDARD: '20 000 ₽',
        PREMIUM: '65 000 ₽'
    };

    // Переменные для хранения выбранных данных
    let selectedTariff = 'STANDARD'; // По умолчанию STANDARD
    let selectedTime = null;
    let selectedDate = null;

    // Часы работы (почасовые слоты)
    const workHours = {
        start: 10,
        end: 20,
        interval: 1 // 1 час интервалы
    };

    const weekTitleEl = document.getElementById('week-title');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const todayBtn = document.getElementById('today');
    const weekCalendarEl = document.getElementById('week-calendar');
    const bookingModal = document.getElementById('booking-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelBookingBtn = document.getElementById('cancel-booking');
    const bookingForm = document.getElementById('booking-form');
    const pastDayError = document.getElementById('past-day-error');
    const tariffSelect = document.getElementById('tariff'); // Элемент select из формы

    const dataElement = document.getElementById('flask-data');
    let bookings = JSON.parse(dataElement.dataset.appointments);

    // Обработчики для кнопок тарифов в блоке цен
    document.querySelectorAll('.price-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectedTariff = btn.dataset.tariff;

            // Убираем подсветку со всех кнопок
            document.querySelectorAll('.price-btn').forEach(b => {
                b.classList.remove('active');
            });
            // Добавляем подсветку выбранной кнопке
            btn.classList.add('active');

            // Если в форме есть select для тарифа - устанавливаем значение
            if (tariffSelect) {
                tariffSelect.value = selectedTariff;
                // Триггерим событие change чтобы обновить время
                tariffSelect.dispatchEvent(new Event('change'));
            }

            // Прокручиваем к календарю
            const lightBlock = document.querySelector('.light-block');
            if (lightBlock) {
                lightBlock.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Функция для получения названия тарифа
    function getTariffName(tariffCode) {
        const names = {
            MINI: 'MINI',
            STANDARD: 'STANDARD',
            PREMIUM: 'PREMIUM EXPERIENCE'
        };
        return names[tariffCode] || tariffCode;
    }

    // Функция для получения цены тарифа
    function getTariffPrice(tariffCode) {
        return tariffPrices[tariffCode] || '';
    }

    // Функция для получения длительности тарифа
    function getTariffDuration(tariffCode) {
        return tariffDurations[tariffCode] || 2;
    }

    // Инициализация календаря
    function initCalendar() {
        currentDate = new Date();
        currentWeekStart = getMonday(currentDate);
        renderWeekCalendar(currentWeekStart);
        updateWeekTitle();

        // Устанавливаем обработчик изменения тарифа в форме
        if (tariffSelect) {
            tariffSelect.addEventListener('change', (e) => {
                selectedTariff = e.target.value;
                if (selectedDate && selectedTime !== null) {
                    updateTimeDisplay();
                }
            });
        }
    }

    // Проверка, является ли дата прошедшей или сегодняшней
    function isPastDay(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        return checkDate < today;
    }

    // Проверка, является ли время прошедшим для сегодняшнего дня
    function isPastTime(date, time) {
        const now = new Date();
        const checkDateTime = new Date(date);
        checkDateTime.setHours(Math.floor(time), 0, 0, 0);

        return checkDateTime <= now;
    }

    // Обновление отображения времени в модальном окне
    function updateTimeDisplay() {
        if (selectedDate && selectedTime !== null) {
            // Получаем выбранный тариф из формы или используем сохраненный
            const currentTariff = tariffSelect ? tariffSelect.value : selectedTariff;

            if (!currentTariff) {
                document.getElementById('start-time').value = 'Выберите тариф';
                return;
            }

            const duration = getTariffDuration(currentTariff);
            const endTime = selectedTime + duration;

            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const dayStr = selectedDate.toLocaleDateString('ru-RU', options);

            const startHour = Math.floor(selectedTime);
            const endHour = Math.floor(endTime);

            // Отображаем время в формате: Дата, ЧЧ:00 - ЧЧ:00
            document.getElementById('start-time').value =
                `${dayStr}, ${padTime(startHour)}:00 - ${padTime(endHour)}:00`;

            // Устанавливаем длительность в скрытое поле для отправки на бек
            document.getElementById('booking-duration').value = duration;

            // Проверка на прошедшую дату/время
            const dateStr = formatDate(selectedDate);
            const isPast = isPastDay(dateStr) || (isSameDay(dateStr, new Date()) && isPastTime(dateStr, selectedTime));
            pastDayError.style.display = isPast ? 'block' : 'none';

            // Обновляем текст в заголовке модального окна
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Запись на ${getTariffName(currentTariff)} (${getTariffPrice(currentTariff)})`;
            }
        }
    }

    // Проверка, является ли дата сегодняшним днем
    function isSameDay(dateStr, compareDate) {
        const date = new Date(dateStr);
        return date.getDate() === compareDate.getDate() &&
               date.getMonth() === compareDate.getMonth() &&
               date.getFullYear() === compareDate.getFullYear();
    }

    // Обновление заголовка с датами недели
    function updateWeekTitle() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 5);

        const startMonth = currentWeekStart.getMonth() + 1;
        const endMonth = weekEnd.getMonth() + 1;
        const year = currentWeekStart.getFullYear();

        let title;
        if (startMonth === endMonth) {
            title = `${GetNameOfMonth(startMonth)} ${year}`;
        } else {
            const startYear = currentWeekStart.getFullYear();
            const endYear = weekEnd.getFullYear();

            if (startYear === endYear) {
                title = `${GetNameOfMonth(startMonth)} - ${GetNameOfMonth(endMonth)} ${year}`;
            } else {
                title = `${GetNameOfMonth(startMonth)} ${startYear} - ${GetNameOfMonth(endMonth)} ${endYear}`;
            }
        }

        weekTitleEl.textContent = `${title}`;

        // Обновляем даты в заголовках дней
        const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const options = { day: 'numeric', month: 'numeric' };

        dayIds.forEach((day, index) => {
            const dayDate = addDays(currentWeekStart, index);
            document.getElementById(`${day}-date`).textContent =
                dayDate.toLocaleDateString('ru-RU', options);
        });
    }

    function GetNameOfMonth(monthNumber) {
        const months = [
            "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
            "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
        ];
        return months[monthNumber - 1] || "";
    }

    // Рендеринг недельного календаря (почасового)
    function renderWeekCalendar(startDate) {
        const timeColumn = weekCalendarEl.querySelector('.time-column');
        const dayColumns = [
            document.getElementById('mon-col'),
            document.getElementById('tue-col'),
            document.getElementById('wed-col'),
            document.getElementById('thu-col'),
            document.getElementById('fri-col'),
            document.getElementById('sat-col')
        ];

        // Очищаем временные слоты (оставляем первый пустой)
        while (timeColumn.children.length > 1) {
            timeColumn.removeChild(timeColumn.lastChild);
        }

        // Очищаем все колонки дней (оставляем только заголовки)
        dayColumns.forEach(column => {
            while (column.children.length > 1) {
                column.removeChild(column.lastChild);
            }
        });

        // Создаем временные слоты с шагом 1 час
        for (let hour = workHours.start; hour < workHours.end; hour += workHours.interval) {
            // Добавляем в колонку времени
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = `${padTime(hour)}:00`;
            timeSlot.dataset.time = hour;
            timeColumn.appendChild(timeSlot);

            // Добавляем в каждую колонку дня
            dayColumns.forEach((column, dayIndex) => {
                const dayDate = addDays(startDate, dayIndex);
                const dateStr = formatDate(dayDate);

                const zap = document.createElement('div');
                zap.className = 'slot-zapis';
                zap.dataset.day = dateStr;
                zap.dataset.time = hour;
                zap.title = `Нажмите для записи на ${padTime(hour)}:00`;

                // Проверяем бронирование
                const booking = findBooking(dayDate, hour);
                if (booking) {
                    zap.classList.add('booked');
                    const bookingBlock = document.createElement('div');
                    bookingBlock.className = 'booking-block';
                    bookingBlock.textContent = `Занято`;
                    zap.appendChild(bookingBlock);
                } else {
                    // Проверяем, является ли время прошедшим
                    const isPast = isPastDay(dateStr) || (isSameDay(dateStr, new Date()) && isPastTime(dateStr, hour));
                    if (isPast) {
                        zap.classList.add('past-time');
                    } else {
                        // Добавляем обработчик клика
                        zap.addEventListener('click', () => {
                            openBookingModal(dayDate, hour);
                        });
                    }
                }

                column.appendChild(zap);
            });
        }
    }

    // Открытие модального окна для бронирования
    function openBookingModal(dayDate, startTime) {
        const dateStr = formatDate(dayDate);

        // Проверка на прошедшую дату/время
        if (isPastDay(dateStr) || (isSameDay(dateStr, new Date()) && isPastTime(dateStr, startTime))) {
            alert('Нельзя записаться на прошедшую дату или сегодняшний день!');
            return;
        }

        selectedDate = dayDate;
        selectedTime = startTime;

        // Заполняем скрытые поля
        document.getElementById('booking-day').value = dateStr;
        document.getElementById('booking-start-time').value = startTime;

        // Если тариф уже выбран - устанавливаем его
        if (selectedTariff && tariffSelect) {
            tariffSelect.value = selectedTariff;
        }

        // Обновляем отображение
        updateTimeDisplay();

        // ПОКАЗЫВАЕМ МОДАЛЬНОЕ ОКНО
        bookingModal.style.display = 'flex';
        bookingModal.style.opacity = '1';

        // Добавляем класс для анимации
        setTimeout(() => {
            bookingModal.classList.add('modal-visible');
        }, 10);
    }

    // Поиск бронирования
    function findBooking(dayDate, hour) {
        const dateStr = formatDate(dayDate);

        return bookings.find(b => {
            // Преобразуем строки времени в числа (часы)
            const bookingStartHour = parseInt(b.startTime.split(':')[0]);
            const bookingEndHour = parseInt(b.endTime.split(':')[0]);

            // Проверяем совпадение дня и времени
            const isSameDay = b.day === dateStr;
            const isTimeOverlap = hour >= bookingStartHour && hour < bookingEndHour;

            return isSameDay && isTimeOverlap;
        });
    }

    // Проверка доступности времени для всей длительности
    function isTimeAvailable(dayDate, startTime, duration) {
        const dateStr = formatDate(dayDate);
        const endTime = startTime + duration;

        // Проверка на прошедшую дату/время
        if (isPastDay(dateStr) || (isSameDay(dateStr, new Date()) && isPastTime(dateStr, startTime))) {
            return false;
        }

        // Проверяем, что время укладывается в рабочие часы
        if (endTime > workHours.end) {
            return false;
        }

        // Проверяем пересечение с существующими бронированиями
        return !bookings.some(b => {
            if (b.day !== dateStr) return false;

            // Преобразуем строки времени в числа
            const bStart = parseInt(b.startTime.split(':')[0]);
            const bEnd = parseInt(b.endTime.split(':')[0]);

            // Проверяем пересечение временных интервалов
            return (startTime < bEnd && endTime > bStart);
        });
    }

    // Сохранение бронирования
    function saveBooking() {
        if (!selectedDate || selectedTime === null) {
            alert('Пожалуйста, выберите дату и время');
            return;
        }

        // Получаем тариф из формы
        const currentTariff = tariffSelect ? tariffSelect.value : selectedTariff;
        if (!currentTariff) {
            alert('Пожалуйста, выберите тариф');
            return;
        }

        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const phone = document.getElementById('phone').value;
        const notes = document.getElementById('notes').value;

        // Получаем длительность на основе тарифа
        const duration = getTariffDuration(currentTariff);
        const endTime = selectedTime + duration;

        // Проверка доступности времени
        if (!isTimeAvailable(selectedDate, selectedTime, duration)) {
            alert(`Время ${padTime(selectedTime)}:00 уже занято или недоступно для записи на ${duration} час(а/ов). Пожалуйста, выберите другое время.`);
            return;
        }

        // Форматируем время для отправки
        const startTimeStr = `${padTime(selectedTime)}:00`;
        const endTimeStr = `${padTime(endTime)}:00`;

        const bookingData = {
            firstName: firstName,
            lastName: lastName,
            day: formatDate(selectedDate),
            startTime: startTimeStr,
            endTime: endTimeStr,
            duration: duration, // Отправляем длительность на бек
            tariff: currentTariff, // Отправляем тариф на бек
            phone: phone,
            notes: currentTariff +"<br>"+ notes,
            tariffName: getTariffName(currentTariff), // Для отображения
            tariffPrice: getTariffPrice(currentTariff) // Для отображения
        };

        console.log('Отправка данных на сервер:', bookingData);

        fetch('/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`✅ Запись успешно сохранена!\n\n👤 ${firstName} ${lastName}\n📅 ${selectedDate.toLocaleDateString('ru-RU')}\n⏰ ${startTimeStr} - ${endTimeStr}\n💰 Тариф: ${getTariffName(currentTariff)} (${getTariffPrice(currentTariff)})\n⏱️ Длительность: ${duration} час(а/ов)\n\n📞 С вами свяжутся для подтверждения!`);

                // Закрываем модальное окно
                closeModal();

                // Обновляем список бронирований и календарь
                bookings.push({
                    day: bookingData.day,
                    startTime: bookingData.startTime,
                    endTime: bookingData.endTime,
                    firstName: firstName,
                    lastName: lastName,
                    tariff: currentTariff,
                    duration: duration
                });

                // Сбрасываем выбранные значения
                selectedDate = null;
                selectedTime = null;

                // Перерисовываем календарь
                renderWeekCalendar(currentWeekStart);
            } else {
                alert('❌ Ошибка при сохранении записи: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('❌ Ошибка при сохранении записи. Пожалуйста, попробуйте еще раз.');
        });
    }

    // Функция для закрытия модального окна
    function closeModal() {
        bookingModal.style.opacity = '0';
        bookingModal.classList.remove('modal-visible');

        setTimeout(() => {
            bookingModal.style.display = 'none';
            bookingForm.reset();
            // Сбрасываем выбранные значения (кроме тарифа)
            selectedDate = null;
            selectedTime = null;
        }, 300);
    }

    // Вспомогательные функции
    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function formatDate(date) {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    function padTime(num) {
        return Math.floor(num).toString().padStart(2, '0');
    }

    // Обработчики событий календаря
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderWeekCalendar(currentWeekStart);
        updateWeekTitle();
    });

    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderWeekCalendar(currentWeekStart);
        updateWeekTitle();
    });

    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        currentWeekStart = getMonday(currentDate);
        renderWeekCalendar(currentWeekStart);
        updateWeekTitle();
    });

    // Обработчики модального окна
    closeModalBtn.addEventListener('click', closeModal);
    cancelBookingBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === bookingModal) {
            closeModal();
        }
    });

    // Валидация формы при отправке
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Проверяем все обязательные поля
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const phone = document.getElementById('phone').value;

        if (!firstName || !lastName || !phone) {
            alert('Пожалуйста, заполните все обязательные поля');
            return;
        }

        // Проверяем валидность телефона
        const phoneRegex = /^[\+]\d{1,3}\s?[\(]?\d{1,4}[\)]?\s?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}$/;
        if (!phoneRegex.test(phone)) {
            alert('Пожалуйста, введите корректный номер телефона');
            return;
        }

        // Проверяем выбран ли тариф
        const currentTariff = tariffSelect ? tariffSelect.value : null;
        if (!currentTariff) {
            alert('Пожалуйста, выберите тариф');
            return;
        }

        saveBooking();
    });



    // Добавьте в функцию initCalendar или в конец DOMContentLoaded в HomePage.js
function scrollToCurrentDay() {
    if (window.innerWidth <= 768) {
        const today = new Date().getDay(); // 0 (вс) - 6 (сб)
        const dayIndex = today === 0 ? 5 : today - 1; // Корректировка под ваш календарь (пн-сб)
        const dayCols = ['mon-col', 'tue-col', 'wed-col', 'thu-col', 'fri-col', 'sat-col'];
        const currentCol = document.getElementById(dayCols[dayIndex]);

        if (currentCol) {
            currentCol.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }
}
 initCalendar();

renderWeekCalendar(currentWeekStart);
scrollToCurrentDay();
});