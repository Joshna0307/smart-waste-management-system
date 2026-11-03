# JOY University Smart Waste Management System

A simple PHP + MySQL web application for recording, segregating and monitoring waste generated across JOY University.

## Main features
- User registration and login
- Admin and user dashboards
- Campus block, hostel, SAC and canteen waste records
- Waste categories: biodegradable, recyclable, reusable, craft-suitable and residual
- Collection, transport and storage tracking
- Recycling/reuse partner directory
- Craft-product sales, expenses, income and profit reports
- Interactive 2D campus map (schematic based on the campus notice-board image)

## Technology
HTML, CSS, JavaScript, PHP and MySQL. Chart.js will be used for reports.

## Setup (Linux / XAMPP)
1. Install PHP 8+, MySQL/MariaDB and a local web server (Apache).
2. Copy this project folder into your server's web root (for example, `htdocs`).
3. Create a MySQL database named `joy_waste_management`.
4. Import `database/schema.sql` using phpMyAdmin or the MySQL command line.
5. Update database credentials in `config/database.php`.
6. Open the project through your local server, for example `http://localhost/smart-waste-management-system/`.

## Important
The campus map will be a schematic 2D representation. Verify exact bin positions on campus before using it operationally. Do not enter real student personal information in a demonstration database.

## Current status
Initial project structure and database schema. More modules will be added step by step.
