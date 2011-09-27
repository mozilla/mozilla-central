#! /bin/sh
# $Id: macho32_test.sh 1732 2007-01-13 19:34:04Z peter $
${srcdir}/out_test.sh macho_test modules/objfmts/macho/tests/nasm32 "32-bit macho objfmt" "-f macho32" ".o"
exit $?
