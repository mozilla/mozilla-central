# $Id: Makefile.inc 1378 2006-02-12 01:27:39Z peter $

libyasm_a_SOURCES += modules/dbgfmts/dwarf2/dwarf2-dbgfmt.h
libyasm_a_SOURCES += modules/dbgfmts/dwarf2/dwarf2-dbgfmt.c
libyasm_a_SOURCES += modules/dbgfmts/dwarf2/dwarf2-line.c
libyasm_a_SOURCES += modules/dbgfmts/dwarf2/dwarf2-aranges.c
libyasm_a_SOURCES += modules/dbgfmts/dwarf2/dwarf2-info.c

YASM_MODULES += dbgfmt_dwarf2

EXTRA_DIST += modules/dbgfmts/dwarf2/tests/Makefile.inc
include modules/dbgfmts/dwarf2/tests/Makefile.inc
