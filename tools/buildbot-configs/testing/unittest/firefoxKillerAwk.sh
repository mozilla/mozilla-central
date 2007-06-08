/bin/kill -f `ps -s -W | awk '/.*firefox.exe/ { print $1 } '`
