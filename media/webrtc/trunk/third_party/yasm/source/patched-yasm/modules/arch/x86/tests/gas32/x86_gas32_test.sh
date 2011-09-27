#! /bin/sh
# $Id: x86_gas32_test.sh 1255 2005-09-29 05:13:26Z peter $
${srcdir}/out_test.sh x86_gas32_test modules/arch/x86/tests/gas32 "x86 gas format" "-f elf32 -p gas" ".o"
exit $?
