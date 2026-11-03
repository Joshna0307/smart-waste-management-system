<?php
session_start();
if (isset($_SESSION['user_id'])) {
    header('Location: ' . ($_SESSION['role'] === 'admin' ? 'admin/dashboard.php' : 'user/dashboard.php'));
    exit;
}
$error = $_SESSION['login_error'] ?? '';
unset($_SESSION['login_error']);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JOY University | Smart Waste Management</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="login-page">
  <main class="login-card">
    <div class="brand-mark">JOY</div>
    <p class="eyebrow">JOY UNIVERSITY</p>
    <h1>Smart Waste Management</h1>
    <p class="muted">A cleaner campus starts with responsible waste segregation.</p>
    <?php if ($error): ?><div class="alert"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <form action="auth/login.php" method="post">
      <label>Email address<input type="email" name="email" required autocomplete="username"></label>
      <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="button" type="submit">Sign in</button>
    </form>
    <p class="small">New to the system? <a href="register.php">Create a user account</a></p>
  </main>
</body>
</html>
