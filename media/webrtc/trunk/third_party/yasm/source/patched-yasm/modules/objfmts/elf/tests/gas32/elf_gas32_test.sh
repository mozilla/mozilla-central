#! /bin/sh
# $Id: elf_gas32_test.sh 2036 2008-02-09 04:06:47Z peter $
${srcdir}/out_test.sh elf_gas32_test modules/objfmts/elf/tests/gas32 "GAS elf-x86 objfmt" "-f elf32 -p gas" ".o"
exit $?
