#! /bin/sh
# $Id: elf_test.sh 1137 2004-09-04 01:24:57Z peter $
# copied from yasm/modules/objfmts/coff/tests/coff_test.sh ; s/coff/elf/g
${srcdir}/out_test.sh elf_test modules/objfmts/elf/tests "elf objfmt" "-f elf" ".o"
exit $?
