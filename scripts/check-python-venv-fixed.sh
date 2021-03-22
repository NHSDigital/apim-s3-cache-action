#!/usr/bin/env bash

# this checks the shebang lines are fixed after caching python virtual envs

set -e

virtual_env_dir="$VIRTUAL_ENV_PATH"
virtual_env_dir="$(realpath ${virtual_env_dir})"

echo "${virtual_env_dir}"

if [ ! -f "${virtual_env_dir}/bin/python" ]; then
    echo "bin/python doesn't exist"
    exit 0
fi

for file in $(find "${virtual_env_dir}/bin" -type f -print0 | xargs -0 file | grep 'Python script' |  cut -d: -f1 ); do
    echo "Checking file: ${file}"
    if (head -n 1 ${file} | grep -Eq '#!.*python'); then
        echo "python path fixed for ${file}"
        continue
    elif (head -n 1 ${file} | grep -Eq "#!${virtual_env_dir}/bin/python"); then
        exit 1
    else 
        echo "no python path to fix for ${file}"
    fi
done
