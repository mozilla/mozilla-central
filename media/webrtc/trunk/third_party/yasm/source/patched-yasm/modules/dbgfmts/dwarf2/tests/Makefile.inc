# $Id: Makefile.inc 1350 2006-01-29 21:11:03Z peter $

EXTRA_DIST += modules/dbgfmts/dwarf2/tests/pass32/Makefile.inc
EXTRA_DIST += modules/dbgfmts/dwarf2/tests/pass64/Makefile.inc
EXTRA_DIST += modules/dbgfmts/dwarf2/tests/passwin64/Makefile.inc
include modules/dbgfmts/dwarf2/tests/pass32/Makefile.inc
include modules/dbgfmts/dwarf2/tests/pass64/Makefile.inc
include modules/dbgfmts/dwarf2/tests/passwin64/Makefile.inc

