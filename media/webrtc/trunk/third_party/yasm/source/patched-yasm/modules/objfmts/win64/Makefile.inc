# $Id: Makefile.inc 1331 2006-01-15 22:48:55Z peter $

# Assume objfmt_coff is included

YASM_MODULES += objfmt_win64 objfmt_x64

EXTRA_DIST += modules/objfmts/win64/tests/Makefile.inc

include modules/objfmts/win64/tests/Makefile.inc
