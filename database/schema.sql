-- PostgreSQL schema for local PostgreSQL and Neon.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS campus_locations (
  id BIGSERIAL PRIMARY KEY, location_code VARCHAR(20) NOT NULL UNIQUE,
  location_name VARCHAR(120) NOT NULL,
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('block','hostel','canteen','sac','other')),
  map_x NUMERIC(6,2), map_y NUMERIC(6,2), is_high_priority BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS waste_records (
  id BIGSERIAL PRIMARY KEY, location_id BIGINT NOT NULL REFERENCES campus_locations(id),
  waste_category VARCHAR(30) NOT NULL CHECK (waste_category IN ('biodegradable','recyclable','reusable','craft','residual','e_waste')),
  quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg >= 0),
  collection_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (collection_status IN ('pending','collected','stored','processed','transferred')),
  notes TEXT, recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  image_data BYTEA, image_mime VARCHAR(40), image_name VARCHAR(255),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS partners (
  id BIGSERIAL PRIMARY KEY, partner_name VARCHAR(150) NOT NULL,
  partner_type VARCHAR(30) NOT NULL CHECK (partner_type IN ('recycling_company','reuse_center','municipal_service','composting_unit','other')),
  accepted_materials VARCHAR(255), location VARCHAR(255), contact VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partners(id),
  waste_category VARCHAR(40) NOT NULL, quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg >= 0),
  amount_received NUMERIC(10,2) NOT NULL DEFAULT 0, transferred_on DATE NOT NULL, notes TEXT
);
CREATE TABLE IF NOT EXISTS craft_sales (
  id BIGSERIAL PRIMARY KEY, product_name VARCHAR(120) NOT NULL,
  material_used VARCHAR(150), quantity_sold INTEGER NOT NULL DEFAULT 1 CHECK (quantity_sold >= 0),
  sale_amount NUMERIC(10,2) NOT NULL CHECK (sale_amount >= 0),
  expense_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (expense_amount >= 0),
  sold_on DATE NOT NULL, notes TEXT
);
CREATE TABLE IF NOT EXISTS collection_requests (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES campus_locations(id),
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  waste_category VARCHAR(30) NOT NULL CHECK (waste_category IN ('biodegradable','recyclable','reusable','craft','residual','e_waste')),
  quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','in_progress','collected','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Campus locations; repeated setup does not create duplicates.
INSERT INTO campus_locations (location_code, location_name, location_type, map_x, map_y, is_high_priority) VALUES
('B01','Administrative Block','block',50,20,FALSE),('B02','Gino Block','block',42,35,FALSE),
('B03','Soosai-A Block','block',25,35,FALSE),('B04','Soosai-B Block','block',29,38,FALSE),
('B05','Selvam Block','block',33,40,FALSE),('B06','St. Lourdes Chapel','other',35,25,FALSE),
('B07','Adhikaram Block','block',39,30,FALSE),('B08','S.A. Raja Memorial Block','block',43,30,FALSE),
('B09','Ghana Prakasam Block','block',48,31,FALSE),('B10','Annam Block','block',54,29,FALSE),
('B11','Grace Block','block',57,33,FALSE),('B12','Celin Block','block',60,35,FALSE),
('B13','Joe Block','block',62,39,FALSE),('B14','Arul Block','block',65,40,FALSE),
('B15','S.A. Raja Convention Hall','other',68,45,FALSE),('B16','Pushpam Block','block',71,42,FALSE),
('B17','Mithuraj Block','block',74,35,FALSE),('B18','Cricket Ground','other',80,30,FALSE),
('B19','Francis Block','block',76,48,FALSE),('B20','Store & Maintenance','other',78,55,FALSE),
('B21','Student Activity Centre (SAC)','sac',82,62,TRUE),('B22','Manickam Block','block',85,49,FALSE),
('B23','Football Turf','other',88,42,FALSE),('B24','JU Arena','other',91,35,FALSE),
('B25','Joshua Block','block',88,25,FALSE),('B26','Joveena Block','block',83,20,FALSE),
('B27','Julliana Block','block',78,18,FALSE),('B28','Security Office','other',73,15,FALSE),
('B29','Waiting Hall','other',69,18,FALSE),('B30','Canteen','canteen',60,70,TRUE),
('B31','Outside Parking','other',35,75,FALSE),('B32','Inside Parking','other',45,65,FALSE),
('HA','Sophia Hostel','hostel',15,20,TRUE),('HB','Green Field Entrance / Hostel Area','hostel',20,25,TRUE),
('HC','Green Field Stadium / Hostel Area','hostel',24,20,TRUE),('HD','Cecily Hostel','hostel',90,65,TRUE),
('HE','Theresa Hostel','hostel',94,60,TRUE),('HF','Devasahayam Hostel','hostel',96,55,TRUE)
ON CONFLICT (location_code) DO NOTHING;
