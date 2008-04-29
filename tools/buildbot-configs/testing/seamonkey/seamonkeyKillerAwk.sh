/bin/kill -f `ps -s -W | awk '/.*seamonkey.exe/ { print $1 } '`
