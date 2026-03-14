-- Таблица clients_pred
CREATE TABLE IF NOT EXISTS public.clients_pred
(
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT false,
    phone_number VARCHAR(12)
);

ALTER TABLE public.clients_pred OWNER TO postgres;

-- Таблица clients
CREATE TABLE IF NOT EXISTS public.clients
(
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT false,
    phone_number VARCHAR(20)
);

ALTER TABLE public.clients OWNER TO postgres;