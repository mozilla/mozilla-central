#! /bin/sh
# $Id: macho64_test.sh 1732 2007-01-13 19:34:04Z peter $
${srcdir}/out_test.sh macho_test modules/objfmts/macho/tests/nasm64 "64-bit macho objfmt" "-f macho64" ".o"
exit $?
