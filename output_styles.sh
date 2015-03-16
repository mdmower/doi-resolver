#!/bin/bash

# Copyright (C) 2015 Matthew D. Mower
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

read_dom () {
    local IFS=\>
    read -d \< ENTITY CONTENT
}

if [ ! -d "styles" ]; then
    git clone https://github.com/citation-style-language/styles.git styles
    cd styles
else
    cd styles
    git pull origin master
fi
if [ -f "README.md" ]; then
    # Retain only the license header and one blank line (16 lines)
    head -16 ../cite_styles.js > ../tmp.js
    printf 'var allStyleTitles = [' >> ../tmp.js

    declare -a cslfiles
    cslfiles=(*.csl)
    lastcslpos=$(( ${#cslfiles[*]} - 1 ))
    lastcsl=${cslfiles[$lastcslpos]}

    for FILE in "${cslfiles[@]}"; do
        TITLE=""
        while read_dom; do
            if [[ $ENTITY = "title" ]]; then
                TITLE=$CONTENT
                break
            fi
        done < $FILE

        if [ ! -z "$TITLE" ]; then
            # Replace double quotes in title with escaped double quotes
            if [[ $TITLE == *\"* ]]; then
              TITLE=$(echo $TITLE | sed 's/\"/\\"/g')
            fi

            if [[ $FILE == $lastcsl ]]; then
                printf '"%s"];\n' "$TITLE" >> ../tmp.js
            else
                printf '"%s",' "$TITLE" >> ../tmp.js
            fi
        fi
    done

    printf 'var allStyleCodes = [' >> ../tmp.js
    for FILE in "${cslfiles[@]}"; do
        TITLE=""
        while read_dom; do
            if [[ $ENTITY = "title" ]]; then
                TITLE=$CONTENT
                break
            fi
        done < $FILE

        if [ ! -z "$TITLE" ]; then
            # filename.csl --> filename
            STYLE="${FILE%.*}"

            if [[ $FILE == $lastcsl ]]; then
                printf '"%s"];\n' "$STYLE" >> ../tmp.js
            else
                printf '"%s",' "$STYLE" >> ../tmp.js
            fi
        fi
    done
    mv ../tmp.js ../cite_styles.js
else
    echo "Styles repository unavailable"
fi
