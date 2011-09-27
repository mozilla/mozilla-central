#! /bin/sh
# $Id: stabs_test.sh 1794 2007-02-24 21:30:08Z peter $
# copied from yasm/modules/objfmts/coff/tests/coff_test.sh ; s/coff/stabs/g
${srcdir}/out_test.sh stabs_test modules/dbgfmts/stabs/tests "stabs dbgfmt" "-f elf -g stabs" ".o"
exit $?
