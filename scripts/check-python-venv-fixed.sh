#!/usr/bin/env bash
# Check that python console scripts in a cached venv do not hard-pin the venv path
# and use a Python 3 interpreter in the shebang.

set -Eeuo pipefail

virtual_env_dir="${VIRTUAL_ENV_PATH:-.venv}"

# Resolve the path portably
if command -v realpath >/dev/null 2>&1; then
  virtual_env_dir="$(realpath -- "${virtual_env_dir}")"
else
  pushd "${virtual_env_dir}" >/dev/null || {
    echo "ERROR: Cannot cd into VIRTUAL_ENV_PATH=${virtual_env_dir}" >&2
    exit 1
  }
  virtual_env_dir="$(pwd -P)"
  popd >/dev/null
fi

echo "VENV: ${virtual_env_dir}"

# If there's no python in the venv, nothing to check; succeed.
if [[ ! -x "${virtual_env_dir}/bin/python" && ! -x "${virtual_env_dir}/bin/python3" ]]; then
  echo "No python interpreter found under ${virtual_env_dir}/bin; skipping."
  exit 0
fi

bad_count=0

# Find all regular files under venv/bin and inspect shebangs safely (NUL-terminated)
while IFS= read -r -d '' file; do
  # Only consider files with a shebang
  read -r firstline < "${file}" || firstline=""
  [[ "${firstline}" == \#!* ]] || continue

  # Normalize shebang for checks
  shebang="${firstline#\#!}"

  # 1) Fail if shebang embeds the cached venv path (python, python3, pythonX.Y)
  if grep -Eq "^${virtual_env_dir}/bin/python([0-9]+(\.[0-9]+)?)?$" <<< "${shebang}"; then
    echo "FAIL: ${file} has pinned venv interpreter in shebang: ${firstline}"
    ((bad_count++))
    continue
  fi

  # 2) Accept portable or system python3 shebangs
  if grep -Eq '^/usr/bin/env[[:space:]]+python3([0-9]+)?$' <<< "${shebang}"; then
    echo "OK:   ${file} uses /usr/bin/env python3"
    continue
  fi
  if grep -Eq '^/usr/bin/python3([0-9]+)?$' <<< "${shebang}"; then
    echo "OK:   ${file} uses /usr/bin/python3"
    continue
  fi

  # 3) Warn on ambiguous "python" (could be Python 2 on some systems)
  if grep -Eq '^(/usr/bin/env[[:space:]]+python|/usr/bin/python)$' <<< "${shebang}"; then
    echo "WARN: ${file} uses generic python; prefer python3 for clarity"
    continue
  fi

  # 4) Any other python shebang: allow but flag
  if grep -Eq 'python' <<< "${shebang}"; then
    echo "WARN: ${file} has uncommon python shebang: ${firstline}"
    continue
  fi

  # Not a python script; ignore silently
done < <(find "${virtual_env_dir}/bin" -type f -print0)

if (( bad_count > 0 )); then
  echo "Found ${bad_count} script(s) pinned to the cached venv path; failing."
  exit 1
fi

echo "All console scripts look relocatable (no pinned venv shebangs)."
