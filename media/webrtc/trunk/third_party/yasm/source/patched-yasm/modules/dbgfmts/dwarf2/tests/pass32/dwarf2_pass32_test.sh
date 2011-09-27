#! /bin/sh
# $Id: dwarf2_pass32_test.sh 1350 2006-01-29 21:11:03Z peter $
${srcdir}/out_test.sh dwarf2_pass32_test modules/dbgfmts/dwarf2/tests/pass32 "dwarf2 dbgfmt pass32" "-f elf -p gas -g dwarf2" ".o"
exit $?
