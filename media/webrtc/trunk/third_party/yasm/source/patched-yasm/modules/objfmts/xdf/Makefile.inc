# $Id: Makefile.inc 1183 2004-12-01 07:49:18Z peter $

libyasm_a_SOURCES += modules/objfmts/xdf/xdf-objfmt.c

YASM_MODULES += objfmt_xdf

EXTRA_DIST += modules/objfmts/xdf/tests/Makefile.inc

include modules/objfmts/xdf/tests/Makefile.inc
