# $Id: Makefile.inc 1183 2004-12-01 07:49:18Z peter $

libyasm_a_SOURCES += modules/dbgfmts/stabs/stabs-dbgfmt.c

YASM_MODULES += dbgfmt_stabs

EXTRA_DIST += modules/dbgfmts/stabs/tests/Makefile.inc
include modules/dbgfmts/stabs/tests/Makefile.inc
