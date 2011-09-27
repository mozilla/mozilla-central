#! /bin/sh
# $Id: elf_amd64_test.sh 1137 2004-09-04 01:24:57Z peter $
${srcdir}/out_test.sh elf_amd64_test modules/objfmts/elf/tests/amd64 "elf-amd64 objfmt" "-m amd64 -f elf" ".o"
exit $?
