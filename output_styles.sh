#!/bin/bash

# Copyright (C) 2016 Matthew D. Mower
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
    local RET=$?
    TAGNAME=${ENTITY%% *}
    ATTRIBUTES=${ENTITY#* }
    return $RET
}

if [ ! -d "styles" ]; then
    git clone https://github.com/citation-style-language/styles.git styles
    cd styles
else
    cd styles
    git pull origin master
fi
if [ -f "README.md" ]; then
    printf '{"cite_styles":[' > ../tmp.json

    declare -a cslfiles
    cslfiles=(*.csl)
    lastcslpos=$(( ${#cslfiles[*]} - 1 ))
    lastcsl=${cslfiles[$lastcslpos]}

    for FILE in "${cslfiles[@]}"; do
        TITLE=""
        locale_regex=".*default-locale=\"([^\"]+)\".*"
        while read_dom; do
            if [[ $TAGNAME = "style" ]]; then
                if [[ "$ATTRIBUTES" =~ $locale_regex ]]; then
                    DEFAULT_LOCALE="${BASH_REMATCH[1]}"
                fi
            elif [[ $TAGNAME = "title" ]]; then
                TITLE=$CONTENT
                break
            fi
        done < $FILE

        CODE="${FILE%.*}"

        if [ ! -z "$TITLE" ] && [ ! -z "$CODE" ]; then
            # Replace double quotes in title with escaped double quotes
            if [[ $TITLE == *\"* ]]; then
              TITLE=$(echo $TITLE | sed 's/\"/\\"/g')
            fi

            if [[ $FILE == $lastcsl ]]; then
                printf '{"code":"%s","title":"%s","default_locale":"%s"}]}' "$CODE" "$TITLE" "$DEFAULT_LOCALE" >> ../tmp.json
            else
                printf '{"code":"%s","title":"%s","default_locale":"%s"},' "$CODE" "$TITLE" "$DEFAULT_LOCALE" >> ../tmp.json
            fi
        fi
    done

    mv ../tmp.json ../cite_styles.json
else
    echo "Styles repository unavailable"
fi
