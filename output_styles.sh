#!/bin/sh
if [ ! -f "./styles/README.md" ]; then
    git clone https://github.com/citation-style-language/styles.git styles
fi
if [ -d "./styles" ]; then
    cd styles
    git pull origin master
    ls *.csl |
    sed 's/\.[^.]*$//' | # remove extension
    sed 's/\(.*\)/"\1"/g' | # wrap each style in double quotes
    tr '\n' ',' | # replace line-breaks with commas
    sed 's/\(.\).$/\1];/g' | # replace last comma with: ];
    sed 's/^/var\ allStyles\ =\ [/g' > ../cite_styles.js # insert variable name and [ at start
else
    echo "Unable to clone styles repository."
fi

