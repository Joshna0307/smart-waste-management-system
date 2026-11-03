<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'user') { header('Location: ../index.php'); exit; }
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>User Dashboard | JOY</title><link rel="stylesheet" href="../assets/css/style.css"></head>
<body><main class="dashboard"><header class="topbar"><div><p class="eyebrow">JOY UNIVERSITY</p><h1>Welcome, <?= htmlspecialchars($_SESSION['user_name']) ?></h1></div><a href="../auth/logout.php">Logout</a></header>
<section class="panel"><span class="pill">USER DASHBOARD</span><h2>Campus waste information</h2><p class="muted">The campus map, waste information and collection request features will appear here.</p></section></main></body></html>
