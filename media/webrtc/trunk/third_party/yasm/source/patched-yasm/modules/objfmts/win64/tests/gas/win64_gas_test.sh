#! /bin/sh
# $Id: win64_gas_test.sh 2082 2008-05-09 06:46:02Z peter $
${srcdir}/out_test.sh win64_gas_test modules/objfmts/win64/tests/gas "win64 objfmt" "-f win64 -p gas -r nasm" ".obj"
exit $?
