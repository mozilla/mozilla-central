#! /bin/sh
# $Id: win32_gas_test.sh 2166 2009-01-02 08:33:21Z peter $
${srcdir}/out_test.sh win32_gas_test modules/objfmts/win32/tests/gas "win32 objfmt" "-f win32 -p gas" ".obj"
exit $?
