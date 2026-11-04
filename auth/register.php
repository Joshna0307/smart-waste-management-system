<?php
session_start();
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../register.php');
    exit;
}

$name = trim($_POST['name'] ?? '');
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$password = $_POST['password'] ?? '';

if ($name === '' || !$email || strlen($password) < 8) {
    $_SESSION['register_error'] = 'Enter a valid name and email. Password must be at least 8 characters.';
    header('Location: ../register.php');
    exit;
}

try {
    $stmt = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        $email,
        password_hash($password, PASSWORD_DEFAULT),
        'user'
    ]);

    header('Location: ../index.php');
    exit;
} catch (PDOException $e) {
    error_log('Registration failed: ' . $e->getMessage());
    $_SESSION['register_error'] = 'That email may already be registered. Please try another.';
    header('Location: ../register.php');
    exit;
}
