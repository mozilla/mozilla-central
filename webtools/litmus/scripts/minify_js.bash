#!/bin/bash

minify=`which jsmin 2>/dev/null`
if [ "XXX$minify" == "XXX" -o ! -e "$minify" ]; then
    echo "jsmin not found in \$PATH. Skipping JS minification"
    exit 0
fi

# Create a single master JS file out of our littler files.
# This cuts down the number of HTTP requests, and with content 
# deflation (gzip) the initial download still isn't that bad.

if [ ! -d "js" ]; then 
  echo "Couldn't find your js/ dir. Did you run the script from your root Litmus dir? You should."
  exit 1
fi

cd js
cat Help.js \
    prototype.lite.js \
    json.js moo.fx.js \
    moo.fx.pack.js \
    MochiKit/MochiKit.js \
    FormPersist.js \
    FormValidation.js \
    Search.js \
    SelectBoxes.js \
    SelectSort.js \
    TestRunCoverage.js \
  > Litmus.js

# Back up original js files, and then minimize them.
#
# Note: this will cause subsequent 'cvs update' calls to complain.
# You'll want something like the following to cleanout your JS dir 
# prior to a cvs update (remember to backup any local changes first!):
#
# From js/:
# for i in `find . | grep '\.js'`; do rm $i;  done; cvs update -dP

for i in `find . -name \*.js -print 2>/dev/null`; do 
    echo -n "Minifying  $i..."
    cp $i $i.preminify
    $minify <$i.preminify >$i
    echo "Done."
done
