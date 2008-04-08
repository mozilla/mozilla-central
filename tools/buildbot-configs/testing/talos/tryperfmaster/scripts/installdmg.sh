#!/bin/sh

mkdir -p mnt
echo "y" | PAGER="/bin/cat" hdiutil attach -verbose -noautoopen -mountpoint ./mnt $1
rsync -a ./mnt/* .
hdiutil detach mnt
