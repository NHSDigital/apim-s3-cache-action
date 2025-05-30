#!/usr/bin/env bash

# this explains the action that needs to happen on restore of a virtual env ..

set -e

virtual_env_dir="${1-.././}"
virtual_env_dir="$(realpath ${virtual_env_dir})"


if [[ ! -f "${virtual_env_dir}/bin/python" ]]; then
    exit 0
fi

for file in $(find "${virtual_env_dir}/bin" -type f -print0 | xargs -0 file | grep 'Python script' |  cut -d: -f1 ); do
    if ! (head -n 1 ${file} | grep -Eq '#!.*python' > /dev/null); then
        continue
    fi
    echo sed -i -E "s|#!.*python|#!${virtual_env_dir}/bin/python|" ${file}
done

