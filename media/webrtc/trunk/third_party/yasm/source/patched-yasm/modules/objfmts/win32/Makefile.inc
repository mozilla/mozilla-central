# $Id: Makefile.inc 1183 2004-12-01 07:49:18Z peter $

# Assume objfmt_coff is included

YASM_MODULES += objfmt_win32

EXTRA_DIST += modules/objfmts/win32/tests/Makefile.inc

include modules/objfmts/win32/tests/Makefile.inc
