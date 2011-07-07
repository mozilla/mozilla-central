#!/bin/sh

ac_add_options() {
  return
}

mk_add_options() {
  echo "mk_add_options:" "$@"
}

MOZCONFIG=${MOZCONFIG:-./.mozconfig}
topsrcdir=${topsrcdir:-$PWD}

source $MOZCONFIG
