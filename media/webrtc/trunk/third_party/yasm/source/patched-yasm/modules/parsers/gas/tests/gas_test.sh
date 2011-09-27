#! /bin/sh
# $Id: gas_test.sh 1239 2005-09-25 04:25:26Z peter $
${srcdir}/out_test.sh gas_test modules/parsers/gas/tests "gas-compat parser" "-f elf -p gas" ".o"
exit $?
