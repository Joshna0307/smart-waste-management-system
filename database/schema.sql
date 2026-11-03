CREATE DATABASE IF NOT EXISTS joy_waste_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE joy_waste_management;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campus_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_code VARCHAR(20) NOT NULL UNIQUE,
  location_name VARCHAR(120) NOT NULL,
  location_type ENUM('block','hostel','canteen','sac','other') NOT NULL,
  map_x DECIMAL(6,2) NULL,
  map_y DECIMAL(6,2) NULL,
  is_high_priority TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS waste_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id INT NOT NULL,
  waste_category ENUM('biodegradable','recyclable','reusable','craft','residual','e_waste') NOT NULL,
  quantity_kg DECIMAL(10,2) NOT NULL,
  collection_status ENUM('pending','collected','stored','processed','transferred') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  recorded_by INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES campus_locations(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_name VARCHAR(150) NOT NULL,
  partner_type ENUM('recycling_company','reuse_center','municipal_service','composting_unit','other') NOT NULL,
  accepted_materials VARCHAR(255) NULL,
  location VARCHAR(255) NULL,
  contact VARCHAR(100) NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  waste_category VARCHAR(40) NOT NULL,
  quantity_kg DECIMAL(10,2) NOT NULL,
  amount_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  transferred_on DATE NOT NULL,
  notes TEXT NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
);

CREATE TABLE IF NOT EXISTS craft_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(120) NOT NULL,
  material_used VARCHAR(150) NULL,
  quantity_sold INT NOT NULL DEFAULT 1,
  sale_amount DECIMAL(10,2) NOT NULL,
  expense_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  sold_on DATE NOT NULL,
  notes TEXT NULL
);

-- Initial campus locations based on the uploaded campus directory board.
-- Coordinates are placeholders for the first schematic map and must be verified.
INSERT IGNORE INTO campus_locations (location_code, location_name, location_type, map_x, map_y, is_high_priority) VALUES
('B01','Administrative Block','block',50,20,0),
('B02','Gino Block','block',42,35,0),
('B03','Soosai-A Block','block',25,35,0),
('B04','Soosai-B Block','block',29,38,0),
('B05','Selvam Block','block',33,40,0),
('B06','St. Lourdes Chapel','other',35,25,0),
('B07','Adhikaram Block','block',39,30,0),
('B08','S.A. Raja Memorial Block','block',43,30,0),
('B09','Ghana Prakasam Block','block',48,31,0),
('B10','Annam Block','block',54,29,0),
('B11','Grace Block','block',57,33,0),
('B12','Celin Block','block',60,35,0),
('B13','Joe Block','block',62,39,0),
('B14','Arul Block','block',65,40,0),
('B15','S.A. Raja Convention Hall','other',68,45,0),
('B16','Pushpam Block','block',71,42,0),
('B17','Mithuraj Block','block',74,35,0),
('B18','Cricket Ground','other',80,30,0),
('B19','Francis Block','block',76,48,0),
('B20','Store & Maintenance','other',78,55,0),
('B21','Student Activity Centre (SAC)','sac',82,62,1),
('B22','Manickam Block','block',85,49,0),
('B23','Football Turf','other',88,42,0),
('B24','JU Arena','other',91,35,0),
('B25','Joshua Block','block',88,25,0),
('B26','Joveena Block','block',83,20,0),
('B27','Julliana Block','block',78,18,0),
('B28','Security Office','other',73,15,0),
('B29','Waiting Hall','other',69,18,0),
('B30','Canteen','canteen',60,70,1),
('B31','Outside Parking','other',35,75,0),
('B32','Inside Parking','other',45,65,0),
('HA','Sophia Hostel','hostel',15,20,1),
('HB','Green Field Entrance / Hostel Area','hostel',20,25,1),
('HC','Green Field Stadium / Hostel Area','hostel',24,20,1),
('HD','Cecily Hostel','hostel',90,65,1),
('HE','Theresa Hostel','hostel',94,60,1),
('HF','Devasahayam Hostel','hostel',96,55,1);
