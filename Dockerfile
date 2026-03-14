# 1. Базовый образ с Python (версия 3.11, slim — это облегченная версия)
FROM python:3.11-slim

# 2. Устанавливаем в систему библиотеки, нужные для работы с PostgreSQL
# Это нужно, чтобы пакет psycopg2 мог собраться внутри контейнера
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 3. Указываем рабочую папку внутри контейнера (там будет жить твой код)
WORKDIR /app

# 4. Копируем файл со списком библиотек
COPY requirements.txt .

# 5. Устанавливаем библиотеки из списка
RUN pip install --no-cache-dir -r requirements.txt

# 6. Копируем все файлы из твоей папки проекта в контейнер
COPY . .

# 7. Открываем порт 5000 (стандартный для Flask)
EXPOSE 5000

# 8. Команда для запуска приложения
CMD ["python", "app.py"]