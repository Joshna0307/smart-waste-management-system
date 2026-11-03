<?php session_start(); $error = $_SESSION['register_error'] ?? ''; unset($_SESSION['register_error']); ?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Register | JOY Waste Management</title><link rel="stylesheet" href="assets/css/style.css"></head>
<body class="login-page"><main class="login-card"><div class="brand-mark">JOY</div><p class="eyebrow">USER REGISTRATION</p><h1>Create account</h1>
<?php if ($error): ?><div class="alert"><?= htmlspecialchars($error) ?></div><?php endif; ?>
<form action="auth/register.php" method="post">
<label>Full name<input name="name" maxlength="100" required></label>
<label>Email address<input type="email" name="email" maxlength="150" required></label>
<label>Password<input type="password" name="password" minlength="8" required></label>
<button class="button" type="submit">Register</button></form><p class="small"><a href="index.php">Back to login</a></p></main></body></html>
