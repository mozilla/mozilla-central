#! /bin/sh
# $Id: nasm_worphan_test.sh 1137 2004-09-04 01:24:57Z peter $
${srcdir}/out_test.sh nasm_test modules/parsers/nasm/tests/worphan "nasm-compat parser" "-Worphan-labels -f bin" ""
exit $?
