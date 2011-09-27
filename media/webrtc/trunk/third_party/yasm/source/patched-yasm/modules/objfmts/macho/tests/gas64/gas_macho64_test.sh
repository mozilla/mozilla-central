#! /bin/sh
# $Id: gas_macho64_test.sh 1782 2007-02-21 06:45:39Z peter $
${srcdir}/out_test.sh macho_test modules/objfmts/macho/tests/gas64 "GAS 64-bit macho objfmt" "-f macho64 -p gas" ".o"
exit $?
