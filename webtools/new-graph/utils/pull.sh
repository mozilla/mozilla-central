#!/bin/bash

ROOTURL="http://build-graphs.mozilla.org/db"
OLDDIR=/path/to/utils/old
IMPORTPY=/path/to/utils/import.py

TESTS="dhtml pageload pageload2 render rendergfx startup xulwinopen refcnt_leaks trace_malloc_leaks codesize codesize_embed"

MACHINEINFO="bl-bldlnx03_fx-linux-tbox-head linux 1.9
fxdbug-linux-tbox.build.mozilla.org linux 1.9
xserve08.build.mozilla.org_fx-trunk macOSX 1.9
bm-xserve11.build.mozilla.org macOSX 1.9
bl-bldxp01 winnt 1.9
balsa-1_8 linux 1.8
bl-bldlnx03.office.mozilla.org_mozilla_1_8_branch linux 1.8
bm-xserve02.mozilla.org_mozilla_1_8_branch macOSX 1.8
bl-bldxp01_mozilla_1_8_branch winnt 1.8
"

echo Downloading...
for test in $TESTS; do
        echo -n $test
        mkdir -p $OLDDIR/$test
        cd $OLDDIR/$test
        IFS=$'\n'
        for line in $MACHINEINFO; do
                IFS=" "
                set -- $line
                m=$1
                echo -n .
                wget -q -c $ROOTURL/$test/$m
        done
done
echo done.

echo Importing...
IFS=" "
for test in $TESTS; do
        echo $test
        #for m in $MACHINES; do
        IFS=$'\n'
        for line in $MACHINEINFO; do
                IFS=" "
                set -- $line
                m=$1
                mtype=$2
                branch=$3
                echo "working with $m $mtype $branch"
                if [ -f $OLDDIR/$test/$m ]; then
                        echo -n .

                        mm=`echo $m | sed 's,\(\.build\|\.office\|\)\.mozilla\.org,,'`
                        mm=`echo $mm | sed 's,\(_head\|-trunk\),,'`
                        mm=`echo $mm | sed 's,_mozilla_1_8_branch,-18,'`

                        mm=$mm\_$mtype
                        # individual machine renames go here
                        case $mm in
                            *) ;;
                        esac

                        echo $m -- $mm
                        python $IMPORTPY $test $mm $mtype $branch < $OLDDIR/$test/$m
                fi
        done
done
echo done.

