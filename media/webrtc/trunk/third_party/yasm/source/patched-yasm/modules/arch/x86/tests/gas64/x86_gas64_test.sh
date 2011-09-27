#! /bin/sh
# $Id: x86_gas64_test.sh 1241 2005-09-25 20:23:40Z peter $
${srcdir}/out_test.sh x86_gas64_test modules/arch/x86/tests/gas64 "amd64 gas format" "-f elf -m amd64 -p gas" ".o"
exit $?
