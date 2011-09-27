#! /bin/sh
# $Id: coff_test.sh 1137 2004-09-04 01:24:57Z peter $
${srcdir}/out_test.sh coff_test modules/objfmts/coff/tests "coff objfmt" "-f coff" ".o"
exit $?
