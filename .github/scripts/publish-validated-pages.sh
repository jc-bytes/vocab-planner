#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GitHub publication token required}"
: "${GITHUB_REPOSITORY:?Repository required}"
: "${GITHUB_SHA:?Validated source revision required}"
artifact_dir=$(cd "${1:?Validated site directory required}" && pwd)
branch=codex/sparks-pages
for file in student.html teacher.html student-sw.js vocabularies/manifest.json; do
  test -s "$artifact_dir/$file" || { echo "Missing validated file: $file" >&2; exit 1; }
done
settings=$(gh api "repos/$GITHUB_REPOSITORY/pages")
test "$(jq -r .build_type <<< "$settings")" = legacy
test "$(jq -r .source.branch <<< "$settings")" = "$branch"
test "$(jq -r .source.path <<< "$settings")" = /
site_url=$(jq -r .html_url <<< "$settings")
[[ "$site_url" == https://* ]]

publish_dir=$(mktemp -d)
trap 'rm -rf "$publish_dir"' EXIT
git -C "$publish_dir" init -q
git -C "$publish_dir" config user.name 'github-actions[bot]'
git -C "$publish_dir" config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git -C "$publish_dir" config credential.helper '!gh auth git-credential'
git -C "$publish_dir" remote add origin "https://github.com/$GITHUB_REPOSITORY.git"
git -C "$publish_dir" fetch -q --depth=1 origin "$branch"
git -C "$publish_dir" checkout -q -B "$branch" FETCH_HEAD
rsync -a --delete --exclude='.git/' "$artifact_dir/" "$publish_dir/"
touch "$publish_dir/.nojekyll"
git -C "$publish_dir" add --all
if ! git -C "$publish_dir" diff --cached --quiet; then
  git -C "$publish_dir" commit -qm "Publish validated Sparks source $GITHUB_SHA"
  # A concurrent branch edit causes a normal push rejection, never a force push.
  git -C "$publish_dir" push origin "HEAD:refs/heads/$branch"
fi
published_commit=$(git -C "$publish_dir" rev-parse HEAD)
# GITHUB_TOKEN pushes do not automatically build branch-based Pages sites.
gh api --method POST "repos/$GITHUB_REPOSITORY/pages/builds" > "$publish_dir/build-request.json"
for attempt in $(seq 1 60); do
  # The legacy build endpoint can remain "building" after a successful deployment.
  # Match the deployment to the exact artifact-branch commit as well.
  deployment=$(gh api "repos/$GITHUB_REPOSITORY/pages/deployments/$published_commit" 2>/dev/null || printf '{}')
  if test "$(jq -r '.status // empty' <<< "$deployment")" = succeed; then break; fi
  build=$(gh api "repos/$GITHUB_REPOSITORY/pages/builds/latest")
  if test "$(jq -r .commit <<< "$build")" = "$published_commit"; then
    status=$(jq -r .status <<< "$build")
    if test "$status" = built; then break; fi
    if test "$status" = errored; then
      jq -r '.error.message // "GitHub Pages build failed"' <<< "$build" >&2
      exit 1
    fi
  fi
  if test "$attempt" = 60; then echo 'Timed out waiting for Pages publication.' >&2; exit 1; fi
  sleep 10
done
# A successful build is insufficient: check the public entry points too.
for attempt in $(seq 1 30); do
  matched=true
  for file in student.html teacher.html student-sw.js; do
    if ! curl --fail --silent --show-error --max-time 30 -H 'Cache-Control: no-cache' \
      "${site_url}${file}?release=${published_commit}" -o "$publish_dir/check-$file" \
      || ! cmp -s "$artifact_dir/$file" "$publish_dir/check-$file"; then matched=false; fi
  done
  if "$matched"; then
    echo "Published and verified $published_commit at $site_url"
    if test -n "${GITHUB_OUTPUT:-}"; then printf 'page_url=%s\n' "$site_url" >> "$GITHUB_OUTPUT"; fi
    exit 0
  fi
  sleep 10
done
echo 'Public entry points do not match the validated artifact.' >&2
exit 1
