<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') { header('Location: ../index.php'); exit; }
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin Dashboard | JOY</title><link rel="stylesheet" href="../assets/css/style.css"></head>
<body><main class="dashboard"><header class="topbar"><div><p class="eyebrow">JOY UNIVERSITY</p><h1>Admin Dashboard</h1></div><a href="../auth/logout.php">Logout</a></header>
<section class="panel"><span class="pill">ADMINISTRATOR</span><h2>Waste management overview</h2><p class="muted">Campus map, block-wise collection, segregation, transport, recycling partners and income reports will be managed here.</p></section></main></body></html>
