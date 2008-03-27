<?php
// If this is not from command line, exit.
if (!empty($_SERVER['HTTP_HOST'])) {
    exit;
}

require_once('inc/config.php');
require_once('inc/memcaching.php');
$m = new Memcaching();
$m->flush();
echo "Flushing memcache entries... \n";
echo "Updated stats:  \n\n";
print_r($m->getExtendedStats());
echo "\n";
?>
