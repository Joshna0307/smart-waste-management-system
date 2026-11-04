<?php
// Legacy dashboard route. The current dashboard is served by the main application.
header('Location: /', true, 302);
exit;
