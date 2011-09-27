#! /bin/sh
# $Id: gas_macho32_test.sh 1782 2007-02-21 06:45:39Z peter $
${srcdir}/out_test.sh macho_test modules/objfmts/macho/tests/gas32 "GAS 32-bit macho objfmt" "-f macho32 -p gas" ".o"
exit $?
