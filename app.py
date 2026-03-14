import hashlib
import os
from dataclasses import dataclass
from datetime import timedelta
import shutil
from PIL import Image
from flask import Flask, request, render_template, redirect, url_for, session, jsonify
from werkzeug.utils import secure_filename
import psycopg2
from transliterate import translit
import subprocess
app = Flask(__name__)
app.secret_key = os.urandom(24)


ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

SALT = os.getenv("SALT_env").encode('utf-8')

def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host="db",
            port="5432",
            database=os.getenv("DB_NAME"),
            user = os.getenv("DB_USER"),
            password = os.getenv("DB_PASSWORD")
        )
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

def save_optimized_image(file, save_path, max_size=2400, quality=85):

    image = Image.open(file)
    image = image.convert("RGB")  # гарантируем JPEG-совместимость

    data = list(image.get_flattened_data())
    image_without_exif = Image.new(image.mode, image.size)
    image_without_exif.putdata(data)

    # Масштабируем, если слишком большое
    image_without_exif.thumbnail((max_size, max_size), Image.LANCZOS)

    # Сохраняем с оптимизацией
    image_without_exif.save(
        save_path,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True
    )
def delete_user_repository(folder_name):
    """
    Безопасно удаляет папку пользователя внутри static
    """
    # Запрещаем выход за пределы static
    safe_folder = secure_filename(folder_name)
    full_path = os.path.join(os.path.join(os.getenv('BASE_DIR'), safe_folder))

    if not os.path.exists('/bin/rm'):
        return False

    try:
        subprocess.Popen(['/bin/rm', '-rf', full_path],
                         stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)
        return True
    except:
        return False



@dataclass
class Appointment:
    id: int
    day: str
    startTime: str
    endTime: str
    duration: int

def get_monday(date):
    """Возвращает понедельник текущей недели"""
    return date - timedelta(days=date.weekday())

def add_days(date, days):
    """Добавляет дни к дате"""
    return date + timedelta(days=days)

def format_date(date):
    """Форматирует дату в YYYY-MM-DD"""
    return date.strftime('%Y-%m-%d')

@app.route('/', methods=['GET', 'POST'])
def home():

    if request.method == 'POST':
        data = request.get_json()

        # Извлекаем данные
        first_name = data['firstName']
        last_name = data['lastName']
        appointment_date = data['day']
        start_time = str(data['startTime']) + ":00"
        end_time = data['endTime']
        phone_number = data['phone']
        notes = data['notes']

        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                    INSERT INTO clients_pred 
                    (first_name, last_name, appointment_date, start_time, end_time, phone_number, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (first_name, last_name, appointment_date, start_time, end_time, phone_number, notes))

            conn.commit()
            conn.close()
            return jsonify({
                'success': True,
            }), 200
        except:
            return jsonify({
                'success': False,
            }), 500

    appointments = []
    conn = get_db_connection()

    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM clients WHERE appointment_date > CURRENT_DATE - INTERVAL '7 days'")
        clients = cur.fetchall()

        cur.execute("SELECT first_name, last_name, appointment_date, start_time FROM clients WHERE is_public = TRUE")
        projects = cur.fetchall()

        for i, client in enumerate(clients):
            try:

                start_time = client[4]
                end_time = client[5]


                end_hour = end_time.hour
                end_minute = end_time.minute


                rounded_start = f"{start_time.hour:02d}:00"


                if end_minute > 0:
                    end_hour = (end_hour + 1) % 24
                rounded_end = f"{end_hour:02d}:00"


                duration = (end_hour - start_time.hour) % 24

                appointment_day = format_date(client[3])

                # Создаем объект Appointment
                appointment = Appointment(
                    id=client[0],
                    day=appointment_day,  # Используем дату из базы данных
                    startTime=rounded_start,
                    endTime=rounded_end,
                    duration=duration
                )

                appointments.append(appointment)

            except (IndexError, ValueError, AttributeError) as e:
                print(f"Ошибка обработки клиента {client}: {e}")
                continue

    except Exception as e:
        print(f"Ошибка базы данных: {e}")
        return "Ошибка загрузки данных", 500

    finally:
        conn.close()


    appointments_dicts = []
    for a in appointments:
        appointments_dicts.append({
            'id': a.id,
            'day': a.day,  # Дата в формате YYYY-MM-DD
            'startTime': a.startTime,
            'endTime': a.endTime,
            'duration': a.duration,

        })

    finalprojects =[]
    for project in projects:
        project_list = list(project)
        project_list[2] = str(project_list[2])
        project_list[3] = str(project_list[3])
        project_list[3] = secure_filename(project_list[3])
        project_list.append(translit(project_list[0], 'ru', reversed=True))
        project_list.append(translit(project_list[1], 'ru', reversed=True))
        finalprojects.append(project_list)


    conn.close()
    return render_template("rere.html", appointments=appointments_dicts, projects=finalprojects)

@app.route('/login', methods=['GET','POST'])
def login():

    if session.get('authenticated'):
        return redirect('/admin')

    if request.method == 'GET': return render_template("auth.html")

    try:
        log = request.form['first']
        pas = request.form['password']
        if log == os.getenv("KRIS_LOG") and pas == os.getenv("KRIS_PASS"):
            session['authenticated'] = True
            return redirect('/admin')
        else:
            return render_template("auth.html")
    except:
        return render_template("auth.html")

@app.route('/admin', methods=['GET', 'POST'])
def admin():

    if request.method == 'POST':
        namedir = request.form['namedir']
        os.chdir('/app')
        album_path = os.path.join(os.getenv('BASE_DIR'), namedir)

        # Создаем папку, если её нет
        os.makedirs(album_path, exist_ok=True)

        # Обрабатываем каждый загруженный файл
        files = request.files.getlist('file')
        photo_count = len([f for f in os.listdir(album_path) if f.startswith('photo')])

        for i, file in enumerate(files, start=photo_count):
            if file and allowed_file(file.filename):
                filename = f"photo{i}.jpg"
                save_optimized_image(
                    file,
                    os.path.join(album_path, filename),
                    max_size=2400,
                    quality=85
                )

    if not session.get('authenticated'):
        return redirect('/login')

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM clients ORDER BY clients.appointment_date DESC")
    clients = cur.fetchall()

    # Преобразуем каждый кортеж в список
    clients_list = []
    for client in clients:
        if (client[8]):
            client_list = list(client)
            data = translit(client_list[1], 'ru', reversed=True) + "_" + translit(client_list[2], 'ru',
                                                                                  reversed=True) + "_" + secure_filename(
                str(client_list[3])) + "_" + secure_filename(str(client_list[4]))
            client_list.append(data)
            clients_list.append(client_list)
        else:
            client_list = list(client)  # Преобразуем кортеж в список

            # Теперь можем добавлять элементы
            data = (SALT + str(translit(client_list[1], 'ru', reversed=True)).encode('utf-8') +
                    secure_filename(str(client_list[3])).encode('utf-8') +
                    "_".encode('utf-8') +
                    secure_filename(str(client_list[4])).encode('utf-8') +
                    SALT +
                    str(translit(client_list[2], 'ru', reversed=True)).encode('utf-8') +
                    SALT)

            hash_object = hashlib.sha256(data)
            client_list.append(hash_object.hexdigest())
            clients_list.append(client_list)

    cur.execute("SELECT * FROM clients_pred ORDER BY clients_pred.created_at ")
    clients_pred = cur.fetchall()

    cur.execute("SELECT * FROM clients WHERE clients.appointment_date = date(NOW()) ORDER BY clients.start_time")
    segodnya = cur.fetchall()

    segodnya_list = []
    for client in segodnya:
        if (client[8]):
            client_list = list(client)
            data = translit(client_list[1], 'ru', reversed=True) + "_" + translit(client_list[2], 'ru',
                                                                                  reversed=True) + "_" + secure_filename(
                str(client_list[3])) + "_" + secure_filename(str(client_list[4]))
            client_list.append(data)
            segodnya_list.append(client_list)
        else:
            client_list = list(client)  # Преобразуем кортеж в список

            # Теперь можем добавлять элементы
            data = (SALT + str(translit(client_list[1], 'ru', reversed=True)).encode('utf-8') +
                    secure_filename(str(client_list[3])).encode('utf-8') +
                    "_".encode('utf-8') +
                    secure_filename(str(client_list[4])).encode('utf-8') +
                    SALT +
                    str(translit(client_list[2], 'ru', reversed=True)).encode('utf-8') +
                    SALT)

            hash_object = hashlib.sha256(data)
            client_list.append(hash_object.hexdigest())
            segodnya_list.append(client_list)

    conn.close()
    return render_template("admin.html", clients=clients_list, clients_pred=clients_pred,
                               segodnya=segodnya_list)

@app.route('/<string:dir>/<string:name>', methods=['GET'])
def index(name,dir):
    name = name.split('_')
    name = ' '.join(name)

    path = os.path.join(os.getenv('BASE_DIR'), dir)

    existing_images = []
    i = 0
    while len(existing_images) < len(os.listdir(path)) :
        file_path = os.path.join(path, f"photo{i}.jpg")
        if os.path.exists(file_path):
            existing_images.append(i)
        i += 1


    return render_template("home.html", name = name, n = existing_images  , direct = path[4:])


@app.route('/api/<string:table>/<int:id>/<string:rep>', methods=['DELETE'])
def Delete(table,id,rep):
    conn = get_db_connection()
    cur = conn.cursor()

    if(table == 'clients'):
        cur.execute("DELETE FROM clients where id = %s", (id,)  )
    elif(table == 'clients_pred'):
        cur.execute("DELETE FROM clients_pred where id = %s", (id,) )

    try:
         delete_user_repository(rep)
    except:
        rep = 0


    conn.commit()
    conn.close()

    return redirect(url_for('admin'))

@app.route('/api/clients/<int:id>/confirm', methods=['POST'])
def confirm(id):

    date = request.form['date']
    start = request.form['start']
    finish = request.form['finish']
    try:
        private = request.form['private']
        private = True
    except:
        private = False

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM clients_pred WHERE id = %s", (id,) )
    clients_pred = cur.fetchall()

    client_data = list(clients_pred[0])
    client_data[3] = date
    client_data[4] = start
    client_data[5] = finish
    client_data[8] = private

    cur.execute("""
    INSERT INTO public.clients 
    (first_name, last_name, appointment_date, start_time, end_time, notes, is_public, phone_number) 
    
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
""", (client_data[1], client_data[2], client_data[3], client_data[4],client_data[5], client_data[6], client_data[8], client_data[9] ))
    conn.commit()

    cur.execute("DELETE FROM clients_pred where id = %s", (id,))
    conn.commit()

    conn.close()

    return redirect(url_for('admin'))

@app.route('/api/clients', methods=['POST'])
def add_client():

    data = request.get_json()

    # Извлекаем данные
    first_name = data['firstName']
    last_name = data['lastName']
    appointment_date = data['date']
    start_time = data['startTime']
    end_time = data['endTime']
    phone_number = data['phone']
    notes = data['notes']
    private = data['checkbox']

    # Сохраняем в БД
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO clients 
        (first_name, last_name, appointment_date, start_time, end_time, phone_number, notes, is_public) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (first_name, last_name, appointment_date, start_time, end_time, phone_number, notes,private))

    conn.commit()
    conn.close()
    return redirect(url_for('admin'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
