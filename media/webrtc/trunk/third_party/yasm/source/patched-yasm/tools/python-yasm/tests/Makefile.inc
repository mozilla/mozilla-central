# $Id: Makefile.inc 1951 2007-09-14 05:19:10Z peter $

EXTRA_DIST += tools/python-yasm/tests/python_test.sh
EXTRA_DIST += tools/python-yasm/tests/__init__.py
EXTRA_DIST += tools/python-yasm/tests/test_bytecode.py
EXTRA_DIST += tools/python-yasm/tests/test_expr.py
EXTRA_DIST += tools/python-yasm/tests/test_intnum.py
EXTRA_DIST += tools/python-yasm/tests/test_symrec.py

if HAVE_PYTHON_BINDINGS

TESTS_ENVIRONMENT += PYTHON=${PYTHON}
TESTS += tools/python-yasm/tests/python_test.sh

endif
