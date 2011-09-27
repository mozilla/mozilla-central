# $Id: Makefile.inc 1653 2006-10-17 06:58:41Z peter $

libyasm_a_SOURCES += modules/objfmts/rdf/rdf-objfmt.c

YASM_MODULES += objfmt_rdf

EXTRA_DIST += modules/objfmts/rdf/tests/Makefile.inc

include modules/objfmts/rdf/tests/Makefile.inc
